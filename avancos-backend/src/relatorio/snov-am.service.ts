import {
  BadGatewayException, ConflictException, HttpException, Injectable, Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { normalizarNome } from '../common/normalizar-nome';

interface ContaSnovAm {
  id: string;
  email: string;
  description: string | null;
}

/**
 * Fallback de credenciais no snov-am-api (fonte oficial das contas Snov).
 * Usado quando o cliente não existe na tabela local credenciais_clientes.
 * Casa por nome (description) ou email, por igualdade após ignorar
 * caixa, acentos, espaços e pontuação.
 */
@Injectable()
export class SnovAmService {
  private readonly logger = new Logger(SnovAmService.name);

  /** Verdadeiro se CREDENTIALS_API_URL e CREDENTIALS_API_KEY estão definidas. */
  configurado(): boolean {
    return !!process.env.CREDENTIALS_API_URL && !!process.env.CREDENTIALS_API_KEY;
  }

  private http(): AxiosInstance {
    if (!this.configurado()) {
      throw new ServiceUnavailableException('Fallback de credenciais (snov-am) não configurado');
    }
    return axios.create({
      baseURL: process.env.CREDENTIALS_API_URL,
      headers: { 'X-API-Key': process.env.CREDENTIALS_API_KEY },
      timeout: 15000,
    });
  }

  /** Retorna clientId/clientSecret ou null se nenhuma conta corresponder ao cliente. */
  async buscarCredenciais(cliente: string): Promise<{ clientId: string; clientSecret: string } | null> {
    const http = this.http();
    try {
      const alvo = normalizarNome(cliente);
      if (!alvo) return null;
      const contas = await this.listarAtivas(http);

      const casam = contas.filter(c =>
        normalizarNome(c.description) === alvo || normalizarNome(c.email) === alvo,
      );
      if (casam.length === 0) return null;
      if (casam.length > 1) {
        throw new ConflictException(`Mais de uma conta no snov-am corresponde ao cliente "${cliente}"`);
      }

      const { data } = await http.get(`/api/internal/accounts/${casam[0].id}/credentials`);
      if (!data?.snov_id || !data?.snov_secret) {
        throw new ServiceUnavailableException(
          `A conta do cliente "${cliente}" no snov-am está sem Client ID ou Client Secret`,
        );
      }
      return { clientId: data.snov_id, clientSecret: data.snov_secret };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw this.traduzirErro(e);
    }
  }

  /** Converte falha de rede/HTTP do snov-am em erro com mensagem útil para o usuário. */
  private traduzirErro(e: any): HttpException {
    const status: number | undefined = e?.response?.status;
    this.logger.error(
      `Falha ao consultar snov-am: ${status ?? e?.code ?? 'sem código'} ${e?.message ?? ''}`,
    );

    if (status === 401 || status === 403) {
      return new ServiceUnavailableException(
        'snov-am recusou a chave de acesso (CREDENTIALS_API_KEY). Avise o administrador.',
      );
    }
    if (status) {
      return new BadGatewayException(`snov-am respondeu com erro ${status} ao buscar credenciais.`);
    }
    return new ServiceUnavailableException(
      'Não foi possível conectar ao snov-am para buscar as credenciais. Tente novamente em instantes.',
    );
  }

  private async listarAtivas(http: AxiosInstance): Promise<ContaSnovAm[]> {
    const contas: ContaSnovAm[] = [];
    let page = 1;
    while (true) {
      const { data } = await http.get('/api/accounts', {
        params: { status: 'ACTIVE', page, page_size: 100 },
      });
      contas.push(...(data.items || []));
      if (contas.length >= data.total || !data.items?.length) break;
      page += 1;
    }
    return contas;
  }
}
