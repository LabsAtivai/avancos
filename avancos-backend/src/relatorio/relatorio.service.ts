import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as JSZip from 'jszip';
import axios from 'axios';
import { CredenciaisService } from '../credenciais/credenciais.service';
import { ChartsService } from './charts.service';

interface GerarDto {
  cliente: string;
  snovId: string;
  snovSecret: string;
  previsto: string;
  atualInicio: string;
  atualFim: string;
  anteriorInicio: string;
  anteriorFim: string;
  geralInicio: string;
  geralFim: string;
  ajustePerformance: string;
  templateBuffer: Buffer;
  campanhasSelecionadas?: Array<{ id: number; nome: string }>;
}

// Índices das células na tabela comparativa (0-based, 44 células, 4 colunas)
// Col 0=Label | Col 1=Anterior | Col 2=Atual | Col 3=Geral
const CELLS = {
  contatos:  { ant: 5,  at: 6,  ger: 7  },
  disparos:  { ant: 9,  at: 10, ger: 11 },
  aberturas: { ant: 13, at: 14, ger: 15 },
  abert_pct: { ant: 17, at: 18, ger: 19 },
  respostas: { ant: 21, at: 22, ger: 23 },
  resp_pct:  { ant: 25, at: 26, ger: 27 },
  apresent:  { ant: 29, at: 30, ger: 31 },
  encaminh:  { ant: 33, at: 34, ger: 35 },
  interest:  { ant: 37, at: 38, ger: 39 },
  periodo:   { ant: 41, at: 42, ger: 43 },
};

@Injectable()
export class RelatorioService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly credenciaisService: CredenciaisService,
    private readonly chartsService: ChartsService,
  ) {}

  // ── Geração do PPTX ───────────────────────────────────────────────────────

  async gerar(dto: GerarDto): Promise<Buffer> {
    const {
      cliente, snovId, snovSecret, previsto,
      atualInicio, atualFim, anteriorInicio, anteriorFim,
      geralInicio, geralFim, ajustePerformance, templateBuffer,
      campanhasSelecionadas,
    } = dto;

    // 1. Avanços do banco — Geral = Anterior + Atual (nunca query separada)
    const [avAt, avAnt] = await Promise.all([
      this.getAvancos(cliente, atualInicio, atualFim),
      this.getAvancos(cliente, anteriorInicio, anteriorFim),
    ]);
    const avGer = this.somaAvancos(avAt, avAnt);

    // 2. Credenciais — usa as do formulário, senão busca do banco
    let resolvedId     = snovId;
    let resolvedSecret = snovSecret;
    if (!resolvedId || !resolvedSecret) {
      try {
        const cred = await this.credenciaisService.findByCliente(cliente);
        resolvedId     = cred.clientId;
        resolvedSecret = cred.clientSecret;
      } catch {}
    }

    // 3. Métricas Snov.io — Geral = Anterior + Atual (nunca query separada)
    let snovToken = '';
    let statsAt = this.zeroStats(), statsAnt = this.zeroStats();
    try {
      snovToken = await this.getSnovToken(resolvedId, resolvedSecret);
      const cSel = campanhasSelecionadas || [];
      [statsAt, statsAnt] = await Promise.all([
        this.getAnalyticsMulti(snovToken, atualInicio,    atualFim,    cSel),
        this.getAnalyticsMulti(snovToken, anteriorInicio, anteriorFim, cSel),
      ]);
    } catch (e) {
      console.error('[RelatorioService] Erro Snov.io:', e.message);
      throw new BadRequestException(`Erro ao buscar dados do Snov.io: ${e.message}`);
    }
    const statsGer = this.somaStats(statsAt, statsAnt);

    // 4. Formata valores
    const fmt = (n: number) => Number(n).toLocaleString('pt-BR');
    const pct = (p: number, t: number) =>
      t ? `${(p / t * 100).toFixed(2).replace('.', ',')}%` : '0,00%';
    const per = (i: string, f: string) => {
      const fi = (d: string) => d.split('-').reverse().join('/');
      return `${fi(i)}\naté\n${fi(f)}`;
    };

    const vals: Record<number, string> = {
      [CELLS.contatos.ant]:  fmt(statsAnt.contacted),
      [CELLS.contatos.at]:   fmt(statsAt.contacted),
      [CELLS.contatos.ger]:  fmt(statsGer.contacted),
      [CELLS.disparos.ant]:  fmt(statsAnt.sent),
      [CELLS.disparos.at]:   fmt(statsAt.sent),
      [CELLS.disparos.ger]:  fmt(statsGer.sent),
      [CELLS.aberturas.ant]: fmt(statsAnt.opened),
      [CELLS.aberturas.at]:  fmt(statsAt.opened),
      [CELLS.aberturas.ger]: fmt(statsGer.opened),
      [CELLS.abert_pct.ant]: pct(statsAnt.opened, statsAnt.sent),
      [CELLS.abert_pct.at]:  pct(statsAt.opened,  statsAt.sent),
      [CELLS.abert_pct.ger]: pct(statsGer.opened, statsGer.sent),
      [CELLS.respostas.ant]: fmt(statsAnt.replied),
      [CELLS.respostas.at]:  fmt(statsAt.replied),
      [CELLS.respostas.ger]: fmt(statsGer.replied),
      [CELLS.resp_pct.ant]:  pct(statsAnt.replied, statsAnt.opened),
      [CELLS.resp_pct.at]:   pct(statsAt.replied,  statsAt.opened),
      [CELLS.resp_pct.ger]:  pct(statsGer.replied, statsGer.opened),
      [CELLS.apresent.ant]:  String(avAnt.apresentacao),
      [CELLS.apresent.at]:   String(avAt.apresentacao),
      [CELLS.apresent.ger]:  String(avGer.apresentacao),
      [CELLS.encaminh.ant]:  String(avAnt.encaminhamento),
      [CELLS.encaminh.at]:   String(avAt.encaminhamento),
      [CELLS.encaminh.ger]:  String(avGer.encaminhamento),
      [CELLS.interest.ant]:  String(avAnt.interessado),
      [CELLS.interest.at]:   String(avAt.interessado),
      [CELLS.interest.ger]:  String(avGer.interessado),
      [CELLS.periodo.ant]:   per(anteriorInicio, anteriorFim),
      [CELLS.periodo.at]:    per(atualInicio,    atualFim),
      [CELLS.periodo.ger]:   `Desde ${(geralInicio || '2020-01-01').split('-').reverse().join('/')}`,
    };

    // 5. Manipula PPTX
    const zip = await JSZip.loadAsync(templateBuffer);

    // Slide 4: Previsto vs Realizado (detecção dinâmica por conteúdo)
    await this.editSlide4(zip, String(statsAt.replied), previsto);

    // Slide 5: Tabela comparativa — detecta pelo título "Análise Comparativa" sem campanha
    const slideTabela = await this.detectarSlideTabela(zip);
    if (slideTabela) await this.editSlideTable(zip, slideTabela, vals);

    // Slide 9: Caixa de Entrada (detecção dinâmica por posição X)
    await this.editSlide9(zip, avGer);

    // Slides de campanha: preenche os "Análise Comparativa" existentes
    if (campanhasSelecionadas?.length > 0 && snovToken) {
      await this.preencherSlidesCampanha(zip, snovToken, campanhasSelecionadas, {
        atualInicio, atualFim, anteriorInicio, anteriorFim,
        geralInicio: geralInicio || '2020-01-01', geralFim,
        avAt, avAnt, avGer,
      });
    }

    // Slides de gráficos: detecta por título
    await this.gerarGraficosAvancos(zip, cliente, geralInicio || '2020-01-01', geralFim);

    // Slide 10: Ajuste de Performance (detecta por título)
    if (ajustePerformance?.trim()) {
      await this.editSlideAjuste(zip, ajustePerformance.trim());
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  // ── Banco de avanços ──────────────────────────────────────────────────────

  private async getAvancos(cliente: string, dataInicio: string, dataFim: string) {
    const rows: any[] = await this.dataSource.query(
      `SELECT tipo, COUNT(*) as total FROM avancos
       WHERE (cliente = ? OR cliente LIKE ?) AND data_avanco BETWEEN ? AND ?
       GROUP BY tipo`,
      [cliente, `${cliente} - %`, dataInicio, dataFim],
    );
    return this.rowsToAvancos(rows);
  }

  // Geral = Anterior + Atual — nunca busca período completo separado
  private somaAvancos(a: any, b: any) {
    return {
      interessado:    a.interessado    + b.interessado,
      apresentacao:   a.apresentacao   + b.apresentacao,
      encaminhamento: a.encaminhamento + b.encaminhamento,
      nutricao:       a.nutricao       + b.nutricao,
    };
  }

  private rowsToAvancos(rows: any[]) {
    const r = { interessado: 0, apresentacao: 0, encaminhamento: 0, nutricao: 0 };
    for (const row of rows) {
      const n = parseInt(row.total);
      if (row.tipo === 'Interessado')    r.interessado    = n;
      if (row.tipo === 'Apresentação')   r.apresentacao   = n;
      if (row.tipo === 'Encaminhamento') r.encaminhamento = n;
      if (row.tipo === 'Nutrição')       r.nutricao       = n;
    }
    return r;
  }

  // ── Snov.io ───────────────────────────────────────────────────────────────

  async getMetricasCampanhas(dto: {
    snovId: string; snovSecret: string;
    atualInicio: string; atualFim: string;
    anteriorInicio: string; anteriorFim: string;
    geralInicio: string; geralFim: string;
    campanhas: Array<{ id: number; nome: string }>;
  }) {
    const token = await this.getSnovToken(dto.snovId, dto.snovSecret);
    const pct = (p: number, t: number) => t ? parseFloat((p / t * 100).toFixed(2)) : 0;

    const resultados = await Promise.all(
      dto.campanhas.map(async (c) => {
        const [at, ant] = await Promise.all([
          this.getAnalytics(token, dto.atualInicio,    dto.atualFim,    c.id).catch(() => this.zeroStats()),
          this.getAnalytics(token, dto.anteriorInicio, dto.anteriorFim, c.id).catch(() => this.zeroStats()),
        ]);
        const ger = this.somaStats(at, ant); // Geral = Anterior + Atual
        return {
          id:   c.id,
          nome: c.nome,
          at:  { contatos: at.contacted,  disparos: at.sent,  aberturas: at.opened,  respostas: at.replied,  abert_pct: pct(at.opened, at.sent),  resp_pct: pct(at.replied, at.opened)  },
          ant: { contatos: ant.contacted, disparos: ant.sent, aberturas: ant.opened, respostas: ant.replied, abert_pct: pct(ant.opened, ant.sent), resp_pct: pct(ant.replied, ant.opened) },
          ger: { contatos: ger.contacted, disparos: ger.sent, aberturas: ger.opened, respostas: ger.replied, abert_pct: pct(ger.opened, ger.sent), resp_pct: pct(ger.replied, ger.opened) },
          // ativa = tem pelo menos 1 resposta no período atual
          ativa: at.replied > 0,
        };
      })
    );

    const soma = (campo: string, per: 'at' | 'ant' | 'ger') =>
      resultados.reduce((s, r) => s + (r[per][campo] || 0), 0);

    const total = {
      nome: 'TOTAL',
      at:  { contatos: soma('contatos','at'),  disparos: soma('disparos','at'),  aberturas: soma('aberturas','at'),  respostas: soma('respostas','at'),  abert_pct: pct(soma('aberturas','at'),  soma('disparos','at')),  resp_pct: pct(soma('respostas','at'),  soma('aberturas','at'))  },
      ant: { contatos: soma('contatos','ant'), disparos: soma('disparos','ant'), aberturas: soma('aberturas','ant'), respostas: soma('respostas','ant'), abert_pct: pct(soma('aberturas','ant'), soma('disparos','ant')), resp_pct: pct(soma('respostas','ant'), soma('aberturas','ant')) },
      ger: { contatos: soma('contatos','ger'), disparos: soma('disparos','ger'), aberturas: soma('aberturas','ger'), respostas: soma('respostas','ger'), abert_pct: pct(soma('aberturas','ger'), soma('disparos','ger')), resp_pct: pct(soma('respostas','ger'), soma('aberturas','ger')) },
    };

    return {
      campanhas: resultados,
      total,
      periodos: {
        at:  { inicio: dto.atualInicio,    fim: dto.atualFim    },
        ant: { inicio: dto.anteriorInicio, fim: dto.anteriorFim },
        ger: { inicio: dto.geralInicio,    fim: dto.geralFim    },
      },
    };
  }

  async listarCampanhas(clientId: string, clientSecret: string) {
    const token = await this.getSnovToken(clientId, clientSecret);
    const r = await axios.get('https://api.snov.io/v2/campaigns', {
      params: { access_token: token },
    });
    const campanhas = r.data?.data || [];
    return {
      campanhas: campanhas.map((c: any) => ({
        id:    c.id,
        nome:  c.campaign,
        status: c.status,
        ativa: c.status === 'Active',
      })),
    };
  }

  // Cache de tokens Snov.io — evita autenticação a cada requisição (token dura 1h)
  private tokenCache = new Map<string, { token: string; expires: number }>();

  private async getSnovToken(clientId: string, clientSecret: string) {
    const key = `${clientId}:${clientSecret}`;
    const cached = this.tokenCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }
    const r = await axios.post('https://api.snov.io/v1/oauth/access_token', {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }, { timeout: 10000 });
    if (!r.data?.access_token) throw new Error('Credenciais Snov.io inválidas');
    // Cache por 55 minutos (token dura 1h)
    this.tokenCache.set(key, {
      token: r.data.access_token,
      expires: Date.now() + 55 * 60 * 1000,
    });
    return r.data.access_token;
  }

  private async getAnalytics(
    token: string, dateFrom: string, dateTo: string, campaignId?: number,
  ) {
    const params: any = { access_token: token, date_from: dateFrom, date_to: dateTo };
    if (campaignId) params.campaign_id = campaignId;
    const r = await axios.get('https://api.snov.io/v2/statistics/campaign-analytics', {
      params,
      timeout: 15000, // 15s por chamada
    });
    const d = r.data || {};
    return {
      contacted:    d.total_contacted || 0,
      sent:         d.emails_sent     || 0,
      opened:       d.email_opens     || 0,
      replied:      d.email_replies   || 0,
      interested:   d.interested      || 0,
      maybe:        d.maybe           || 0,
      auto_replied: d.auto_replied    || 0,
    };
  }

  // NUNCA chama sem campaign_id — evita misturar dados de clientes diferentes
  private async getAnalyticsMulti(
    token: string, dateFrom: string, dateTo: string,
    campanhas: Array<{ id: number; nome: string }>,
  ) {
    if (!campanhas.length) {
      console.warn('[RelatorioService] getAnalyticsMulti sem campanhas — retornando zeros');
      return this.zeroStats();
    }
    const results = await Promise.all(
      campanhas.map(c =>
        this.getAnalytics(token, dateFrom, dateTo, c.id).catch(() => this.zeroStats())
      )
    );
    return results.reduce((acc, r) => ({
      contacted:    acc.contacted    + r.contacted,
      sent:         acc.sent         + r.sent,
      opened:       acc.opened       + r.opened,
      replied:      acc.replied      + r.replied,
      interested:   acc.interested   + r.interested,
      maybe:        acc.maybe        + r.maybe,
      auto_replied: acc.auto_replied + r.auto_replied,
    }), this.zeroStats());
  }

  private zeroStats() {
    return { contacted: 0, sent: 0, opened: 0, replied: 0, interested: 0, maybe: 0, auto_replied: 0 };
  }

  // Geral = Anterior + Atual — nunca busca período completo separado
  private somaStats(a: ReturnType<RelatorioService['zeroStats']>, b: ReturnType<RelatorioService['zeroStats']>) {
    return {
      contacted:    a.contacted    + b.contacted,
      sent:         a.sent         + b.sent,
      opened:       a.opened       + b.opened,
      replied:      a.replied      + b.replied,
      interested:   a.interested   + b.interested,
      maybe:        a.maybe        + b.maybe,
      auto_replied: a.auto_replied + b.auto_replied,
    };
  }

  // ── Edição de slides ──────────────────────────────────────────────────────

  /**
   * Slide 4 — Previsto vs Realizado
   * Detecta dinamicamente: shape com valor numérico grande = Realizado
   * Shape com texto "20 - 40" = Previsto
   */
  private async editSlide4(zip: JSZip, realizado: string, previsto: string) {
    const path = 'ppt/slides/slide4.xml';
    const file = zip.file(path);
    if (!file) return;

    let xml = await file.async('string');

    // Encontra todas as shapes com seus IDs, posições e textos
    const shapes: Array<{ id: string; x: number; text: string }> = [];
    const spRegex = /<p:sp[\s\S]*?<\/p:sp>/g;
    let m: RegExpExecArray;
    while ((m = spRegex.exec(xml)) !== null) {
      const sp   = m[0];
      const idM  = sp.match(/p:cNvPr[^>]*id="(\d+)"/);
      const offM = sp.match(/a:off[^>]*x="(\d+)"/);
      const txtM = sp.match(/<a:t>([^<]+)<\/a:t>/);
      if (idM && offM && txtM) {
        shapes.push({ id: idM[1], x: parseInt(offM[1]), text: txtM[1] });
      }
    }

    // Ordena por X — menor X = primeiro elemento visual
    shapes.sort((a, b) => a.x - b.x);

    // Shape com número puro = valor do gráfico (Realizado)
    // Shape com range "X - Y" ou "X-Y" = Previsto
    const shapeRealizado = shapes.find(s => /^\d+$/.test(s.text.trim()));
    const shapePrevisto  = shapes.find(s => /\d+\s*[-–]\s*\d+/.test(s.text));

    if (shapeRealizado) {
      xml = this.replaceShapeText(xml, shapeRealizado.id, realizado);
    }
    if (shapePrevisto && previsto) {
      xml = this.replaceShapeText(xml, shapePrevisto.id, previsto);
    }

    zip.file(path, xml);
  }

  /**
   * Slide 9 — Caixa de Entrada
   * Detecta os 4 valores numéricos por posição X (crescente):
   * Apresentação | Encaminhamentos | Interessados | Nutrição
   */
  private async editSlide9(zip: JSZip, avGer: any) {
    const path = 'ppt/slides/slide9.xml';
    const file = zip.file(path);
    if (!file) return;

    let xml = await file.async('string');

    const shapes: Array<{ id: string; x: number; text: string }> = [];
    const spRegex = /<p:sp[\s\S]*?<\/p:sp>/g;
    let m: RegExpExecArray;
    while ((m = spRegex.exec(xml)) !== null) {
      const sp   = m[0];
      const idM  = sp.match(/p:cNvPr[^>]*id="(\d+)"/);
      const offM = sp.match(/a:off[^>]*x="(\d+)"/);
      const txtM = sp.match(/<a:t>([^<]+)<\/a:t>/);
      if (idM && offM && txtM) {
        shapes.push({ id: idM[1], x: parseInt(offM[1]), text: txtM[1].trim() });
      }
    }

    // Shapes numéricas (os valores que precisamos substituir), ordenadas por X
    const numericas = shapes
      .filter(s => /^\d+$/.test(s.text))
      .sort((a, b) => a.x - b.x);

    // Mapeamento por ordem de X: Apresentação, Encaminhamentos, Interessados, Nutrição
    const valores = [
      avGer.apresentacao,
      avGer.encaminhamento,
      avGer.interessado,
      avGer.nutricao,
    ];

    for (let i = 0; i < Math.min(numericas.length, valores.length); i++) {
      xml = this.replaceShapeText(xml, numericas[i].id, String(valores[i]));
    }

    zip.file(path, xml);
  }

  /**
   * Slide 10 — Ajuste de Performance
   * Detecta o slide pelo título e substitui o conteúdo (segunda shape de texto)
   */
  private async editSlideAjuste(zip: JSZip, texto: string) {
    // Detecta qual slide tem "Ajuste de Performance" no título
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/) && !f.includes('_rels'));

    for (const slidePath of slideFiles) {
      const file = zip.file(slidePath);
      if (!file) continue;
      let xml = await file.async('string');

      if (!xml.includes('Ajuste de Performance')) continue;

      // Pega todas as shapes com texto
      const shapes: Array<{ id: string; y: number; text: string }> = [];
      const spRegex = /<p:sp[\s\S]*?<\/p:sp>/g;
      let m: RegExpExecArray;
      while ((m = spRegex.exec(xml)) !== null) {
        const sp   = m[0];
        const idM  = sp.match(/p:cNvPr[^>]*id="(\d+)"/);
        const offM = sp.match(/a:off[^>]*y="(\d+)"/);
        const texts = [...sp.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map(x => x[1]).join('');
        if (idM && offM && texts.trim()) {
          shapes.push({ id: idM[1], y: parseInt(offM[1]), text: texts.trim() });
        }
      }
      shapes.sort((a, b) => a.y - b.y);

      // A segunda shape (Y maior) é o conteúdo — a primeira é o título
      const conteudo = shapes.find(s => !s.text.includes('Ajuste de Performance'));
      if (conteudo) {
        xml = this.replaceShapeText(xml, conteudo.id, texto);
        zip.file(slidePath, xml);
      }
      break;
    }
  }

  /**
   * Detecta o slide da tabela comparativa geral
   * (tem "Análise Comparativa" mas NÃO tem nome de campanha específica)
   * ou usa o slide com "Métricas" e "Contatos" como fallback
   */
  private async detectarSlideTabela(zip: JSZip): Promise<number | null> {
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/) && !f.includes('_rels'))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    for (const slidePath of slideFiles) {
      const num  = parseInt(slidePath.match(/slide(\d+)\.xml/)[1]);
      const file = zip.file(slidePath);
      if (!file) continue;
      const xml   = await file.async('string');
      const lower = xml.toLowerCase();
      // Slide com tabela de 44 células e "contatos atingidos"
      if (lower.includes('contatos atingidos') || lower.includes('contatos')) {
        const cellCount = (xml.match(/<a:tc[\s\S]*?<\/a:tc>/g) || []).length;
        if (cellCount >= 40) return num;
      }
    }
    return null;
  }

  // ── Slides de campanha ────────────────────────────────────────────────────

  private async preencherSlidesCampanha(
    zip: any,
    token: string,
    campanhas: Array<{ id: number; nome: string }>,
    periodos: {
      atualInicio: string; atualFim: string;
      anteriorInicio: string; anteriorFim: string;
      geralInicio: string; geralFim: string;
      avAt: any; avAnt: any; avGer: any;
    },
  ) {
    // Detecta slides "Análise Comparativa" existentes
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/) && !f.includes('_rels'))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    const slidesComp: Array<{ num: number; titulo: string }> = [];
    for (const slidePath of slideFiles) {
      const num  = parseInt(slidePath.match(/slide(\d+)\.xml/)[1]);
      const file = zip.file(slidePath);
      if (!file) continue;
      const xml    = await file.async('string');
      const texts  = [...xml.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map(m => m[1]);
      const titulo = texts.find(t => t.includes('Análise Comparativa'));
      if (titulo) slidesComp.push({ num, titulo });
    }

    console.log('[RelatorioService] Slides Análise Comparativa:', slidesComp.map(s => `${s.num}: ${s.titulo}`));

    // Associa cada campanha a um slide pelo nome (melhor match por tokens)
    const associados = new Set<number>();

    for (const campanha of campanhas) {
      const slideAlvo = this.matchCampanhaSlide(campanha.nome, slidesComp, associados);
      if (!slideAlvo) {
        console.warn(`[RelatorioService] Sem slide para: ${campanha.nome}`);
        continue;
      }
      associados.add(slideAlvo);

      try {
        const [cAt, cAnt] = await Promise.all([
          this.getAnalytics(token, periodos.atualInicio,    periodos.atualFim,    campanha.id).catch(() => this.zeroStats()),
          this.getAnalytics(token, periodos.anteriorInicio, periodos.anteriorFim, campanha.id).catch(() => this.zeroStats()),
        ]);
        const cGer = this.somaStats(cAt, cAnt); // Geral = Anterior + Atual

        const fmt = (n: number) => Number(n).toLocaleString('pt-BR');
        const pct = (p: number, t: number) => t ? `${(p / t * 100).toFixed(2).replace('.', ',')}%` : '0,00%';
        const per = (i: string, f: string) => {
          const fi = (d: string) => d.split('-').reverse().join('/');
          return `${fi(i)} até ${fi(f)}`;
        };

        const vals: Record<number, string> = {
          [CELLS.contatos.ant]:  fmt(cAnt.contacted),   [CELLS.contatos.at]:  fmt(cAt.contacted),   [CELLS.contatos.ger]:  fmt(cGer.contacted),
          [CELLS.disparos.ant]:  fmt(cAnt.sent),         [CELLS.disparos.at]:  fmt(cAt.sent),         [CELLS.disparos.ger]:  fmt(cGer.sent),
          [CELLS.aberturas.ant]: fmt(cAnt.opened),       [CELLS.aberturas.at]: fmt(cAt.opened),       [CELLS.aberturas.ger]: fmt(cGer.opened),
          [CELLS.abert_pct.ant]: pct(cAnt.opened, cAnt.sent), [CELLS.abert_pct.at]: pct(cAt.opened, cAt.sent), [CELLS.abert_pct.ger]: pct(cGer.opened, cGer.sent),
          [CELLS.respostas.ant]: fmt(cAnt.replied),      [CELLS.respostas.at]: fmt(cAt.replied),      [CELLS.respostas.ger]: fmt(cGer.replied),
          [CELLS.resp_pct.ant]:  pct(cAnt.replied, cAnt.opened), [CELLS.resp_pct.at]: pct(cAt.replied, cAt.opened), [CELLS.resp_pct.ger]: pct(cGer.replied, cGer.opened),
          [CELLS.apresent.ant]:  String(periodos.avAnt.apresentacao), [CELLS.apresent.at]: String(periodos.avAt.apresentacao), [CELLS.apresent.ger]: String(periodos.avGer.apresentacao),
          [CELLS.encaminh.ant]:  String(periodos.avAnt.encaminhamento), [CELLS.encaminh.at]: String(periodos.avAt.encaminhamento), [CELLS.encaminh.ger]: String(periodos.avGer.encaminhamento),
          [CELLS.interest.ant]:  String(periodos.avAnt.interessado), [CELLS.interest.at]: String(periodos.avAt.interessado), [CELLS.interest.ger]: String(periodos.avGer.interessado),
          [CELLS.periodo.ant]:   per(periodos.anteriorInicio, periodos.anteriorFim),
          [CELLS.periodo.at]:    per(periodos.atualInicio,    periodos.atualFim),
          [CELLS.periodo.ger]:   `Desde ${periodos.geralInicio.split('-').reverse().join('/')}`,
        };

        await this.editSlideTable(zip, slideAlvo, vals);
        console.log(`[RelatorioService] Slide ${slideAlvo} → ${campanha.nome}`);
      } catch (e) {
        console.error(`[RelatorioService] Erro slide ${slideAlvo} (${campanha.nome}):`, e.message);
      }
    }
  }

  // Match por tokens: normaliza e conta palavras em comum
  private matchCampanhaSlide(
    nomeCampanha: string,
    slidesComp: Array<{ num: number; titulo: string }>,
    jaAssociados: Set<number>,
  ): number | null {
    const tokens = (s: string) =>
      s.toLowerCase()
       .replace(/[^a-z0-9\s]/g, ' ')
       .split(/\s+/)
       .filter(t => t.length > 2);

    const tokensC = tokens(nomeCampanha);

    let melhorScore = 0;
    let melhorSlide: number | null = null;

    for (const s of slidesComp) {
      if (jaAssociados.has(s.num)) continue;
      const tokensS = tokens(s.titulo);
      const comuns  = tokensC.filter(t => tokensS.some(ts => ts.includes(t) || t.includes(ts)));
      const score   = comuns.length;
      if (score > melhorScore) {
        melhorScore = score;
        melhorSlide = s.num;
      }
    }

    // Se não achou match, usa o primeiro slide não associado
    if (!melhorSlide) {
      const disponivel = slidesComp.find(s => !jaAssociados.has(s.num));
      melhorSlide = disponivel?.num ?? null;
    }

    return melhorSlide;
  }

  // ── Gráficos ──────────────────────────────────────────────────────────────

  private async gerarGraficosAvancos(zip: any, cliente: string, geralInicio: string, geralFim: string) {
    const { slideSegmento, slideCargo } = await this.detectarSlidesGraficos(zip);
    console.log(`[RelatorioService] Gráficos: segmento=slide${slideSegmento} cargo=slide${slideCargo}`);

    const [porSegmento, porCargo] = await Promise.all([
      this.dataSource.query(
        `SELECT segmento AS label, COUNT(*) AS valor FROM avancos
         WHERE (cliente = ? OR cliente LIKE ?)
           AND segmento IS NOT NULL AND segmento != '' AND segmento != '-'
           AND data_avanco BETWEEN ? AND ?
         GROUP BY segmento ORDER BY valor DESC LIMIT 15`,
        [cliente, `${cliente} - %`, geralInicio, geralFim],
      ),
      this.dataSource.query(
        `SELECT cargo AS label, COUNT(*) AS valor FROM avancos
         WHERE (cliente = ? OR cliente LIKE ?)
           AND cargo IS NOT NULL AND cargo != '' AND cargo != '-'
           AND data_avanco BETWEEN ? AND ?
         GROUP BY cargo ORDER BY valor DESC LIMIT 15`,
        [cliente, `${cliente} - %`, geralInicio, geralFim],
      ),
    ]);

    const dadosSeg   = porSegmento.map((r: any) => ({ label: r.label, valor: parseInt(r.valor) }));
    const dadosCargo = porCargo.map((r: any)    => ({ label: r.label, valor: parseInt(r.valor) }));

    if (dadosSeg.length > 0 && slideSegmento) {
      const img = await this.chartsService.gerarPizzaComTabela(dadosSeg, 'Avanços por segmento', 'Segmento', 1008, 263);
      await this.replaceSlideImage(zip, slideSegmento, 'rId3', img);
    }
    if (dadosCargo.length > 0 && slideCargo) {
      const img = await this.chartsService.gerarPizzaComTabela(dadosCargo, 'Avanços por Cargo', 'Cargo', 846, 294);
      await this.replaceSlideImage(zip, slideCargo, 'rId3', img);
    }
  }

  private async detectarSlidesGraficos(zip: any): Promise<{ slideSegmento: number | null; slideCargo: number | null }> {
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/) && !f.includes('_rels'))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    let slideSegmento: number | null = null;
    let slideCargo:    number | null = null;

    for (const slidePath of slideFiles) {
      const num  = parseInt(slidePath.match(/slide(\d+)\.xml/)[1]);
      const file = zip.file(slidePath);
      if (!file) continue;
      const xml   = await file.async('string');
      const lower = xml.toLowerCase();

      if (!slideSegmento && (lower.includes('avanços por segmento') || lower.includes('avanos por segmento'))) {
        slideSegmento = num;
      }
      if (!slideCargo && (lower.includes('avanços por cargo') || lower.includes('avanos por cargo'))) {
        slideCargo = num;
      }
      if (slideSegmento && slideCargo) break;
    }
    return { slideSegmento, slideCargo };
  }

  private async replaceSlideImage(zip: any, slideNum: number, rId: string, imageBuffer: Buffer) {
    const relPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const relFile = zip.file(relPath);
    if (!relFile) return;
    const relXml = await relFile.async('string');
    const match  = relXml.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
    if (!match) return;
    zip.file(match[1].replace('../', 'ppt/'), imageBuffer);
  }

  // ── Manipulação XML ───────────────────────────────────────────────────────

  private replaceShapeText(xml: string, shapeId: string, value: string): string {
    const regex = new RegExp(
      `(<p:cNvPr[^>]*id="${shapeId}"[^>]*/?>.*?<a:t>)(.*?)(</a:t>)`,
      's'
    );
    return xml.replace(regex, `$1${this.escapeXml(value)}$3`);
  }

  private async editSlideTable(zip: JSZip, slideNum: number, vals: Record<number, string>) {
    const path = `ppt/slides/slide${slideNum}.xml`;
    const file = zip.file(path);
    if (!file) return;

    let xml = await file.async('string');
    const cells = xml.match(/<a:tc[\s\S]*?<\/a:tc>/g) || [];

    for (const [idxStr, value] of Object.entries(vals)) {
      const idx = parseInt(idxStr);
      if (idx >= cells.length) continue;

      const oldCell = cells[idx];
      // Preserva rPr (formatação) do primeiro run
      const rPr     = (oldCell.match(/<a:rPr[\s\S]*?(?:\/>|<\/a:rPr>)/) || [''])[0];
      // Remove todos os runs e insere um único limpo
      const semRuns = oldCell.replace(/<a:r[\s\S]*?<\/a:r>/g, '');
      const novoRun = `<a:r>${rPr}<a:t>${this.escapeXml(value)}</a:t></a:r>`;
      const newCell = semRuns.replace(/<\/a:p>/, `${novoRun}</a:p>`);
      xml = xml.replace(oldCell, newCell);
    }

    zip.file(path, xml);
  }

  private escapeXml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
