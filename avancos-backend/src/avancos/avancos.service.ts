import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Avanco } from './entities/avanco.entity';
import {
  CreateAvancoDto,
  UpdateAvancoDto,
  FilterAvancoDto,
  PptxQueryDto,
  ExportQueryDto,
} from './dto/avancos.dto';

const COLS_MAP: Record<string, string> = {
  dataAvanco:    'a.data_avanco',
  cliente:       'a.cliente',
  tipo:          'a.tipo',
  criadoEm:      'a.criado_em',
  dataFollowup:  'a.data_followup',
};

@Injectable()
export class AvancosService {
  constructor(
    @InjectRepository(Avanco)
    private readonly repo: Repository<Avanco>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreateAvancoDto): Promise<Avanco> {
    const avanco = this.repo.create(dto);
    return this.repo.save(avanco);
  }

  async createMany(dtos: CreateAvancoDto[]): Promise<{ inseridos: number }> {
    if (!dtos.length) return { inseridos: 0 };
    try {
      // Tenta inserção em lote
      const avancos = this.repo.create(dtos);
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(Avanco)
        .values(avancos)
        .execute();
      return { inseridos: dtos.length };
    } catch (e) {
      // Fallback: insere um por um (mais lento mas nunca falha)
      console.warn('[createMany] Lote falhou, inserindo individualmente:', e.message);
      let ok = 0;
      for (const dto of dtos) {
        try {
          await this.repo.save(this.repo.create(dto));
          ok++;
        } catch {}
      }
      return { inseridos: ok };
    }
  }

  // ─── Listagem com filtros melhorados ──────────────────────────────────────

  async findAll(filter: FilterAvancoDto) {
    const {
      // exatos
      clienteExato, clientes, tipo, segmentoExato, campanhaExata,
      responsavel, porte, importadoDe,
      // parciais
      cliente, segmento, campanha, busca,
      // período
      dataInicio, dataFim, ano,
      // ordenação
      orderBy = 'dataAvanco', orderDir = 'DESC',
      // paginação
      page = 1, limit = 50,
      // SDR Remoto
      sdrResponsavel, followupStatus,
    } = filter;

    const qb = this.repo.createQueryBuilder('a');

    // ── Filtros exatos (usam índices — performáticos com 70k+ registros) ──
    const clientesLista = typeof clientes === 'string' && clientes.trim()
      ? clientes.split('|').map(c => c.trim()).filter(Boolean).slice(0, 100)
      : [];

    if (clientesLista.length) qb.andWhere('a.cliente IN (:...clientesLista)', { clientesLista });
    else if (clienteExato) qb.andWhere('a.cliente = :clienteExato', { clienteExato });
    if (tipo)         qb.andWhere('a.tipo = :tipo', { tipo });
    if (segmentoExato) qb.andWhere('a.segmento = :segmentoExato', { segmentoExato });
    if (campanhaExata) qb.andWhere('a.campanha = :campanhaExata', { campanhaExata });
    if (responsavel)  qb.andWhere('a.responsavel = :responsavel', { responsavel });
    if (porte)        qb.andWhere('a.porte = :porte', { porte });
    if (importadoDe)  qb.andWhere('a.importadoDe = :importadoDe', { importadoDe });

    // ── Filtros parciais (LIKE — para busca livre) ──
    if (cliente && !clienteExato)
      qb.andWhere('a.cliente LIKE :cliente', { cliente: `%${cliente}%` });
    if (segmento && !segmentoExato)
      qb.andWhere('a.segmento LIKE :segmento', { segmento: `%${segmento}%` });
    if (campanha && !campanhaExata)
      qb.andWhere('a.campanha LIKE :campanha', { campanha: `%${campanha}%` });

    // ── Busca livre (nome_lead, empresa, cargo, cliente, segmento) ──
    if (busca) {
      qb.andWhere(
        `(a.nomeLead LIKE :busca OR a.empresa LIKE :busca OR a.cargo LIKE :busca
          OR a.cliente LIKE :busca OR a.segmento LIKE :busca)`,
        { busca: `%${busca}%` },
      );
    }

    // ── Período ──
    if (dataInicio) qb.andWhere('a.dataAvanco >= :dataInicio', { dataInicio });
    if (dataFim)    qb.andWhere('a.dataAvanco <= :dataFim', { dataFim });
    if (ano && !dataInicio && !dataFim) {
      qb.andWhere('a.dataAvanco >= :anoInicio AND a.dataAvanco <= :anoFim', {
        anoInicio: `${ano}-01-01`,
        anoFim: `${ano}-12-31`,
      });
    }

    // ── Filtros SDR Remoto ──
    if (sdrResponsavel) {
      qb.andWhere('a.responsavel = :sdrResponsavel', { sdrResponsavel });
    }
    if (followupStatus) {
      // Usa NOW() do MySQL para evitar problemas de timezone entre Node.js e o banco
      if (followupStatus === 'vencido') {
        qb.andWhere('a.dataFollowup IS NOT NULL AND a.dataFollowup < NOW()');
      } else if (followupStatus === 'hoje') {
        qb.andWhere('a.dataFollowup IS NOT NULL AND DATE(a.dataFollowup) = CURDATE()');
      } else if (followupStatus === 'pendente') {
        qb.andWhere('a.dataFollowup IS NOT NULL AND a.dataFollowup >= CURDATE()');
      }
    }

    // ── Ordenação configurável ──
    const col = COLS_MAP[orderBy] || 'a.data_avanco';
    const dir = orderDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(col, dir).addOrderBy('a.id', 'DESC');

    const total = await qb.getCount();
    const lim   = Math.min(Number(limit) || 50, 200);
    const dados = await qb
      .skip((Number(page) - 1) * lim)
      .take(lim)
      .getMany();

    return {
      dados,
      total,
      pagina: Number(page),
      totalPaginas: Math.ceil(total / lim),
    };
  }

  async findOne(id: number): Promise<Avanco> {
    const avanco = await this.repo.findOne({ where: { id } });
    if (!avanco) throw new NotFoundException(`Avanço #${id} não encontrado`);
    return avanco;
  }

  async update(id: number, dto: UpdateAvancoDto): Promise<Avanco> {
    const avanco = await this.findOne(id);
    // Converte strings 'null'/'undefined' para null real
    const sanitized: any = { ...dto };
    if (sanitized.dataFollowup === '' || sanitized.dataFollowup === 'null') {
      sanitized.dataFollowup = null;
    }
    Object.assign(avanco, sanitized);
    return this.repo.save(avanco);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  // ─── Exportação CSV ───────────────────────────────────────────────────────

  async exportar(filter: ExportQueryDto): Promise<Avanco[]> {
    const {
      clienteExato, clientes, tipo, segmentoExato, campanhaExata,
      dataInicio, dataFim, ano, busca,
    } = filter;

    const qb = this.repo.createQueryBuilder('a');

    const clientesListaExport = typeof clientes === 'string' && clientes.trim()
      ? clientes.split('|').map(c => c.trim()).filter(Boolean).slice(0, 100)
      : [];

    if (clientesListaExport.length) qb.andWhere('a.cliente IN (:...clientesListaExport)', { clientesListaExport });
    else if (clienteExato) qb.andWhere('a.cliente = :clienteExato', { clienteExato });
    if (tipo)          qb.andWhere('a.tipo = :tipo', { tipo });
    if (segmentoExato) qb.andWhere('a.segmento = :segmentoExato', { segmentoExato });
    if (campanhaExata) qb.andWhere('a.campanha = :campanhaExata', { campanhaExata });
    if (dataInicio)    qb.andWhere('a.dataAvanco >= :dataInicio', { dataInicio });
    if (dataFim)       qb.andWhere('a.dataAvanco <= :dataFim', { dataFim });
    if (ano && !dataInicio && !dataFim) {
      qb.andWhere('a.dataAvanco >= :anoInicio AND a.dataAvanco <= :anoFim', {
        anoInicio: `${ano}-01-01`,
        anoFim: `${ano}-12-31`,
      });
    }
    if (busca)         qb.andWhere(
      '(a.nomeLead LIKE :busca OR a.empresa LIKE :busca OR a.cliente LIKE :busca)',
      { busca: `%${busca}%` },
    );

    qb.orderBy('a.data_avanco', 'DESC').addOrderBy('a.cliente', 'ASC');
    return qb.getMany();
  }

  // ─── Estatísticas melhoradas ──────────────────────────────────────────────

  async getEstatisticas(
    cliente?: string,
    dataInicio?: string,
    dataFim?: string,
    campanha?: string,
    tipo?: string,
    ano?: number,
    clientes?: string[], // múltiplos clientes
  ) {
    // Constrói WHERE com parâmetros posicionais (?) para dataSource.query()
    const values: any[] = [];
    const conditions: string[] = [];

    // Multi-cliente tem prioridade
    if (clientes?.length) {
      const placeholders = clientes.map(() => '?').join(',');
      conditions.push(`cliente IN (${placeholders})`);
      values.push(...clientes);
    } else if (cliente) {
      conditions.push('cliente = ?');
      values.push(cliente);
    }
    if (campanha)   { conditions.push('campanha = ?');             values.push(campanha); }
    if (tipo)       { conditions.push('tipo = ?');                 values.push(tipo); }
    if (dataInicio) { conditions.push('data_avanco >= ?');         values.push(dataInicio); }
    if (dataFim)    { conditions.push('data_avanco <= ?');         values.push(dataFim); }
    if (ano && !dataInicio && !dataFim) {
      conditions.push('data_avanco >= ? AND data_avanco <= ?');
      values.push(`${ano}-01-01`, `${ano}-12-31`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const base = `FROM avancos ${whereClause}`;

    const [porTipo, porSegmento, porCargo, porMes, porPorporte, porAno] =
      await Promise.all([
        this.dataSource.query(
          `SELECT tipo, COUNT(*) as total ${base} GROUP BY tipo ORDER BY total DESC`,
          values,
        ),
        this.dataSource.query(
          `SELECT segmento, COUNT(*) as total FROM avancos
           WHERE segmento IS NOT NULL AND segmento != ''
           ${whereClause ? 'AND ' + conditions.join(' AND ') : ''}
           GROUP BY segmento ORDER BY total DESC LIMIT 25`,
          values,
        ),
        this.dataSource.query(
          `SELECT cargo, COUNT(*) as total FROM avancos
           WHERE cargo IS NOT NULL AND cargo != ''
           ${whereClause ? 'AND ' + conditions.join(' AND ') : ''}
           GROUP BY cargo ORDER BY total DESC LIMIT 25`,
          values,
        ),
        this.dataSource.query(
          `SELECT DATE_FORMAT(data_avanco, '%Y-%m') as mes, tipo, COUNT(*) as total
           ${base} GROUP BY mes, tipo ORDER BY mes ASC`,
          values,
        ),
        this.dataSource.query(
          `SELECT porte, COUNT(*) as total FROM avancos
           WHERE porte IS NOT NULL AND porte != ''
           ${whereClause ? 'AND ' + conditions.join(' AND ') : ''}
           GROUP BY porte ORDER BY total DESC`,
          values,
        ),
        this.dataSource.query(
          `SELECT YEAR(data_avanco) as ano, COUNT(*) as total
           ${base} GROUP BY ano ORDER BY ano DESC`,
          values,
        ),
      ]);

    return { porTipo, porSegmento, porCargo, porMes, porPorte: porPorporte, porAno };
  }

  // ─── Opções para dropdowns — normalizadas ─────────────────────────────────

  async getFollowupCount(responsavel: string) {
    // Usa funções MySQL (NOW, CURDATE) para evitar problemas de timezone

    const rows: any[] = await this.dataSource.query(
      `SELECT 
        SUM(CASE WHEN data_followup < NOW() THEN 1 ELSE 0 END) AS vencidos,
        SUM(CASE WHEN DATE(data_followup) = CURDATE() AND data_followup >= NOW() THEN 1 ELSE 0 END) AS hoje
       FROM avancos 
       WHERE responsavel = ? AND data_followup IS NOT NULL`,
      [responsavel]
    );
    return {
      vencidos: parseInt(rows[0]?.vencidos || '0'),
      hoje:     parseInt(rows[0]?.hoje     || '0'),
      total:    parseInt(rows[0]?.vencidos || '0') + parseInt(rows[0]?.hoje || '0'),
    };
  }

  async getOpcoes() {
    const [clientes, segmentos, campanhas, responsaveis, portes, anos, importados] =
      await Promise.all([
        this.dataSource.query(
          `SELECT cliente AS valor, COUNT(*) AS total
           FROM avancos
           GROUP BY cliente
           ORDER BY cliente`,
        ),
        this.dataSource.query(
          `SELECT DISTINCT segmento as valor FROM avancos
           WHERE segmento IS NOT NULL AND segmento != ''
           ORDER BY segmento`,
        ),
        this.dataSource.query(
          `SELECT DISTINCT campanha as valor FROM avancos
           WHERE campanha IS NOT NULL AND campanha != ''
           ORDER BY campanha`,
        ),
        this.dataSource.query(
          `SELECT DISTINCT responsavel as valor FROM avancos
           WHERE responsavel IS NOT NULL AND responsavel != ''
           ORDER BY responsavel`,
        ),
        // Novo: portes únicos
        this.dataSource.query(
          `SELECT DISTINCT porte as valor FROM avancos
           WHERE porte IS NOT NULL AND porte != ''
           ORDER BY porte`,
        ),
        // Novo: anos disponíveis
        this.dataSource.query(
          `SELECT DISTINCT YEAR(data_avanco) as valor FROM avancos
           ORDER BY valor DESC`,
        ),
        // Novo: fontes de import
        this.dataSource.query(
          `SELECT DISTINCT importado_de as valor FROM avancos
           WHERE importado_de IS NOT NULL AND importado_de != ''
           ORDER BY importado_de`,
        ),
      ]);

    return {
      clientes:    clientes.map((r) => ({ valor: r.valor, total: parseInt(r.total) })),
      segmentos:   segmentos.map((r) => r.valor),
      campanhas:   campanhas.map((r) => r.valor),
      responsaveis: responsaveis.map((r) => r.valor),
      portes:      portes.map((r) => r.valor),
      anos:        anos.map((r) => r.valor),
      importados:  importados.map((r) => r.valor),
      tipos: ['Interessado', 'Apresentação', 'Encaminhamento', 'Nutrição'],
    };
  }

  // ─── Endpoint para o gerador de PPTX ─────────────────────────────────────

  async getPptxData(dto: PptxQueryDto) {
    const { cliente, dataInicio, dataFim } = dto;

    const rows: { tipo: string; total: string }[] = await this.dataSource.query(
      `SELECT tipo, COUNT(*) as total
       FROM avancos
       WHERE cliente LIKE ?
         AND data_avanco BETWEEN ? AND ?
       GROUP BY tipo`,
      [`%${cliente}%`, dataInicio, dataFim],
    );

    const resultado = {
      interessado: 0, apresentacao: 0,
      encaminhamento: 0, nutricao: 0, total: 0,
    };

    for (const row of rows) {
      const n = parseInt(row.total);
      resultado.total += n;
      switch (row.tipo) {
        case 'Interessado':    resultado.interessado    = n; break;
        case 'Apresentação':   resultado.apresentacao   = n; break;
        case 'Encaminhamento': resultado.encaminhamento = n; break;
        case 'Nutrição':       resultado.nutricao       = n; break;
      }
    }

    return resultado;
  }
}
