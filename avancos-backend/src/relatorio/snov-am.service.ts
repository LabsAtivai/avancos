import {
  ConflictException, Injectable, ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface ContaSnovAm {
  id: string;
  email: string;
  description: string | null;
}

const normalizar = (s: string) =>
  (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Fallback de credenciais no snov-am-api (fonte oficial das contas Snov).
 * Usado quando o cliente não existe na tabela local credenciais_clientes.
 * Casa por nome (description) ou email, com match exato após normalização.
 */
@Injectable()
export class SnovAmService {
  private http(): AxiosInstance {
    const base = process.env.CREDENTIALS_API_URL;
    const key = process.env.CREDENTIALS_API_KEY;
    if (!base || !key) {
      throw new ServiceUnavailableException('Fallback de credenciais (snov-am) não configurado');
    }
    return axios.create({
      baseURL: base,
      headers: { 'X-API-Key': key },
      timeout: 15000,
    });
  }

  /** Retorna clientId/clientSecret ou null se nenhuma conta corresponder ao cliente. */
  async buscarCredenciais(cliente: string): Promise<{ clientId: string; clientSecret: string } | null> {
    const http = this.http();
    const alvo = normalizar(cliente);
    const contas = await this.listarAtivas(http);

    const casam = contas.filter(c =>
      normalizar(c.description ?? '') === alvo || normalizar(c.email) === alvo,
    );
    if (casam.length === 0) return null;
    if (casam.length > 1) {
      throw new ConflictException(`Mais de uma conta no snov-am corresponde ao cliente "${cliente}"`);
    }

    const { data } = await http.get(`/api/internal/accounts/${casam[0].id}/credentials`);
    if (!data?.snov_id || !data?.snov_secret) {
      throw new ServiceUnavailableException('Credenciais incompletas no snov-am');
    }
    return { clientId: data.snov_id, clientSecret: data.snov_secret };
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
