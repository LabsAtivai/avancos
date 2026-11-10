import {
  CanActivate, ExecutionContext, HttpException, HttpStatus,
  Injectable, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';

// Janela fixa de rate limit por IP (requisições por minuto), aplicada antes da autenticação.
const JANELA_MS = 60_000;
const MAX_REQ_JANELA = parseInt(process.env.PAINEL_RATE_LIMIT_POR_MIN || '120', 10);

@Injectable()
export class PainelApiKeyGuard implements CanActivate {
  private readonly contagem = new Map<string, { inicio: number; n: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    this.verificarRateLimit(req, res);

    const esperada = process.env.PAINEL_API_KEY;
    if (!esperada) {
      // Fail closed: sem chave configurada, a integração não responde.
      throw new ServiceUnavailableException('Integração do painel não configurada');
    }

    const header = (process.env.PAINEL_API_KEY_HEADER || 'x-api-key').toLowerCase();
    const recebida = req.headers[header];
    if (typeof recebida !== 'string' || recebida.length === 0) {
      throw new UnauthorizedException('Chave de API ausente');
    }

    // Compara digests SHA-256 (mesmo tamanho) em tempo constante; nunca loga a chave.
    const a = createHash('sha256').update(recebida, 'utf8').digest();
    const b = createHash('sha256').update(esperada, 'utf8').digest();
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Chave de API inválida');
    }
    return true;
  }

  private verificarRateLimit(req: Request, res: Response): void {
    const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
    const agora = Date.now();
    const atual = this.contagem.get(ip);

    if (!atual || agora - atual.inicio >= JANELA_MS) {
      this.contagem.set(ip, { inicio: agora, n: 1 });
      this.limparExpirados(agora);
      return;
    }

    atual.n += 1;
    if (atual.n > MAX_REQ_JANELA) {
      const retryAfter = Math.ceil((atual.inicio + JANELA_MS - agora) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
      throw new HttpException('Muitas requisições', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private limparExpirados(agora: number): void {
    if (this.contagem.size < 1000) return;
    for (const [ip, v] of this.contagem) {
      if (agora - v.inicio >= JANELA_MS) this.contagem.delete(ip);
    }
  }
}
