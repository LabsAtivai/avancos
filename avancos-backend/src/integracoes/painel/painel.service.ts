import {
  BadRequestException, Injectable, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CursorResumo, MAX_DIAS_INTERVALO, TAMANHO_PAGINA_RESUMO, TIPOS_AVANCO,
  codificarCursor, diferencaDias, hojeSaoPaulo,
  parseDataIso, somarDias, statusSemaforo,
} from './painel.util';

// Versão lida do package.json (src/integracoes/painel -> ../../../package.json).
const VERSAO: string = require('../../../package.json').version;

type Contagens = Record<(typeof TIPOS_AVANCO)[number], number>;

export interface ResumoDia {
  cliente: string;
  data: string;
  total: number;
  porTipo: Contagens;
}

export interface RegistroStatus {
  cliente: string;
  interessados: number;
  status: 'verde' | 'amarelo' | 'vermelho' | 'sem_vinculo';
}

@Injectable()
export class PainelService {
  private readonly logger = new Logger('PainelService');

  constructor(private readonly dataSource: DataSource) {}

  async clientes() {
    try {
      const clientes: { cliente: string; snovEmail: string }[] = await this.dataSource.query(
        'SELECT DISTINCT cliente, snov_email AS snovEmail FROM credenciais_clientes WHERE ativo = 1 ORDER BY cliente, snov_email',
      );
      return { clientes };
    } catch (e) {
      this.registrarFalha('clientes', e);
      throw new ServiceUnavailableException('Cadastro de clientes indisponível');
    }
  }

  // ─── GET /resumo ──────────────────────────────────────────────────────────

  async resumo(params: {
    dataInicio: unknown;
    dataFim: unknown;
    clientes?: string[];
    cursor?: CursorResumo;
    limite?: number;
  }) {
    const inicio = parseDataIso(params.dataInicio, 'dataInicio');
    const fim = parseDataIso(params.dataFim, 'dataFim');
    if (inicio > fim) throw new BadRequestException('dataInicio deve ser anterior ou igual a dataFim');
    if (diferencaDias(inicio, fim) + 1 > MAX_DIAS_INTERVALO) {
      throw new BadRequestException(`intervalo máximo de ${MAX_DIAS_INTERVALO} dias por requisição`);
    }

    const limite = params.limite ?? TAMANHO_PAGINA_RESUMO;
    const cursor = params.cursor;

    const condicoes = ['data_avanco BETWEEN ? AND ?'];
    const valores: unknown[] = [inicio, fim];
    if (params.clientes?.length) {
      condicoes.push(`cliente IN (${params.clientes.map(() => '?').join(',')})`);
      valores.push(...params.clientes);
    }
    if (cursor) {
      condicoes.push('(data_avanco > ? OR (data_avanco = ? AND cliente > ?))');
      valores.push(cursor.data, cursor.data, cursor.cliente);
    }

    try {
      // 1) Pares (cliente, data) da página, com uma linha a mais para saber se há próxima página.
      const pares: { cliente: string; data: string }[] = await this.dataSource.query(
        `SELECT cliente, DATE_FORMAT(data_avanco, '%Y-%m-%d') AS data
         FROM avancos
         WHERE ${condicoes.join(' AND ')}
         GROUP BY cliente, data_avanco
         ORDER BY data_avanco, cliente
         LIMIT ${Math.floor(limite) + 1}`,
        valores,
      );

      const temMais = pares.length > limite;
      const pagina = pares.slice(0, limite);
      const proximaPagina = temMais
        ? codificarCursor({ data: pagina[pagina.length - 1].data, cliente: pagina[pagina.length - 1].cliente })
        : null;

      if (!pagina.length) {
        return { dataInicio: inicio, dataFim: fim, geradoEm: new Date().toISOString(), proximaPagina, dias: [] };
      }

      // 2) Contagens por tipo apenas para os pares da página.
      const linhas: { cliente: string; data: string; tipo: string; n: string | number }[] =
        await this.dataSource.query(
          `SELECT cliente, DATE_FORMAT(data_avanco, '%Y-%m-%d') AS data, tipo, COUNT(*) AS n
           FROM avancos
           WHERE (cliente, data_avanco) IN (${pagina.map(() => '(?,?)').join(',')})
           GROUP BY cliente, data_avanco, tipo`,
          pagina.flatMap(p => [p.cliente, p.data]),
        );

      const mapa = new Map<string, ResumoDia>();
      for (const p of pagina) {
        const porTipo = Object.fromEntries(TIPOS_AVANCO.map(t => [t, 0])) as Contagens;
        mapa.set(`${p.cliente}\u0000${p.data}`, { cliente: p.cliente, data: p.data, total: 0, porTipo });
      }
      for (const l of linhas) {
        const dia = mapa.get(`${l.cliente}\u0000${l.data}`);
        if (!dia || !(TIPOS_AVANCO as readonly string[]).includes(l.tipo)) continue;
        const n = Number(l.n);
        dia.porTipo[l.tipo as (typeof TIPOS_AVANCO)[number]] += n;
        dia.total += n;
      }

      return {
        dataInicio: inicio,
        dataFim: fim,
        geradoEm: new Date().toISOString(),
        proximaPagina,
        dias: pagina.map(p => mapa.get(`${p.cliente}\u0000${p.data}`)),
      };
    } catch (e) {
      this.registrarFalha('resumo', e);
      throw new ServiceUnavailableException('Consulta de avanços indisponível');
    }
  }

  // ─── GET /status ──────────────────────────────────────────────────────────

  async status(dias: number, excluirHoje: boolean) {
    const hoje = hojeSaoPaulo();
    const fim = excluirHoje ? somarDias(hoje, -1) : hoje;
    const inicio = somarDias(fim, -(dias - 1));

    try {
      // Registro de clientes vinculados a contas Snov: somente a coluna cliente (sem segredos).
      const cadastro: { cliente: string }[] = await this.dataSource.query(
        'SELECT DISTINCT cliente FROM credenciais_clientes',
      );
      const contagens: { cliente: string; n: string | number }[] = await this.dataSource.query(
        `SELECT cliente, COUNT(*) AS n FROM avancos
         WHERE tipo = 'Interessado' AND data_avanco BETWEEN ? AND ?
         GROUP BY cliente`,
        [inicio, fim],
      );

      const vinculados = new Set(cadastro.map(c => c.cliente));
      const porCliente = new Map<string, number>();
      for (const c of contagens) porCliente.set(c.cliente, Number(c.n));

      const nomes = new Set<string>([...vinculados, ...porCliente.keys()]);
      const registros: RegistroStatus[] = [...nomes]
        .map(cliente => {
          const interessados = porCliente.get(cliente) ?? 0;
          return {
            cliente,
            interessados,
            status: vinculados.has(cliente) ? statusSemaforo(interessados) : 'sem_vinculo',
          } as RegistroStatus;
        })
        .sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));

      return { geradoEm: new Date().toISOString(), inicio, fim, registros };
    } catch (e) {
      this.registrarFalha('status', e);
      // Falha nunca vira vermelho/zero: resposta de indisponibilidade.
      throw new ServiceUnavailableException('Consulta de status indisponível');
    }
  }

  // ─── GET /health ──────────────────────────────────────────────────────────

  async health() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (e) {
      this.registrarFalha('health', e);
      throw new ServiceUnavailableException('indisponível');
    }
    return { status: 'ok', versao: VERSAO, geradoEm: new Date().toISOString() };
  }

  /** Loga só o código do erro: sem SQL, parâmetros ou credenciais. */
  private registrarFalha(rota: string, e: any): void {
    this.logger.error(`falha em ${rota}: ${e?.code || e?.name || 'erro'}`);
  }
}
