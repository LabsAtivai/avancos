import {
  CanActivate, ExecutionContext, Injectable,
  ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { chaveConfere } from '../common/comparar-chave';

/**
 * Protege /api/credenciais. Única leitura pública: GET da lista sem completo=true
 * (campos sem segredo). Todo o resto exige CREDENCIAIS_API_KEY no header
 * (CREDENCIAIS_API_KEY_HEADER, padrão x-api-key). Sem a chave configurada, fecha.
 */
@Injectable()
export class CredenciaisChaveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const listaPublica =
      req.method === 'GET' &&
      req.path.replace(/\/+$/, '') === '/api/credenciais' &&
      req.query.completo !== 'true';
    if (listaPublica) return true;

    const esperada = process.env.CREDENCIAIS_API_KEY;
    if (!esperada) {
      throw new ServiceUnavailableException('Acesso a credenciais não configurado');
    }
    const header = (process.env.CREDENCIAIS_API_KEY_HEADER || 'x-api-key').toLowerCase();
    if (!chaveConfere(req.headers[header], esperada)) {
      throw new UnauthorizedException('Chave de API ausente ou inválida');
    }
    return true;
  }
}
