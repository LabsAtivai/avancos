import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import * as iconv from 'iconv-lite';
import { CsvMapeamento } from './entities/csv-mapeamento.entity';
import { AvancosService } from '../avancos/avancos.service';
import { CreateAvancoDto } from '../avancos/dto/avancos.dto';

// Campos válidos do banco para o mapeamento
export const CAMPOS_BANCO = [
  'cliente',
  'tipo',
  'nomeLead',
  'cargo',
  'empresa',
  'segmento',
  'campanha',
  'dataAvanco',
  'responsavel',
  'observacao',
  'porte',
  'dataFollowup',
  'tratativa',
  'detalhamento',
  'followupsJson',
  'ignorar',
] as const;

export type CampoBanco = (typeof CAMPOS_BANCO)[number];

// ─── Detecção automática de colunas ──────────────────────────────────────────
// Mapeia nomes de colunas comuns encontrados nas 3 planilhas para campos do banco

const AUTO_MAP: Record<string, CampoBanco> = {
  // cliente
  cliente: 'cliente',
  clientes: 'cliente',
  'nome do cliente': 'cliente',

  // tipo — inferido pelo contexto (não existe coluna "tipo" nas planilhas atuais)
  tipo: 'tipo',
  avanço: 'tipo',
  'tipo de avanço': 'tipo',

  // lead
  nome: 'nomeLead',
  'nome:': 'nomeLead',
  lead: 'nomeLead',
  'nome do lead': 'nomeLead',
  contato: 'nomeLead',

  // cargo
  cargo: 'cargo',

  // empresa
  empresa: 'empresa',
  'empresa:': 'empresa',

  // segmento
  segmento: 'segmento',
  setor: 'segmento',
  'setor de atuação': 'segmento',
  'ramo de atuação': 'segmento',

  // campanha / fonte
  fonte: 'campanha',
  campanha: 'campanha',
  'nome da campanha': 'campanha',

  // data
  data: 'dataAvanco',
  'data do avanço': 'dataAvanco',
  'data de recebimento': 'dataAvanco',
  'data do email': 'dataAvanco',

  // responsável
  responsável: 'responsavel',
  responsavel: 'responsavel',
  caixa: 'responsavel',
  gestor: 'responsavel',

  // follow-up
  'data followup': 'dataFollowup',
  'data_followup': 'dataFollowup',
  followup: 'dataFollowup',
  'follow-up': 'dataFollowup',
  'follow up': 'dataFollowup',
  'data de followup': 'dataFollowup',
  'data do followup': 'dataFollowup',
  'proximo contato': 'dataFollowup',
  'proxima ligacao': 'dataFollowup',

  // tratativa
  tratativa: 'tratativa',
  tratativas: 'tratativa',
  anotacao: 'tratativa',
  anotacoes: 'tratativa',
  observacao: 'tratativa',
  notas: 'tratativa',
  comentario: 'tratativa',
  comentarios: 'tratativa',

  // ignorar
  tamanho: 'porte',
  porte: 'porte',
  ano: 'ignorar',
  'tamanho da empresa': 'porte',

  // colunas do CSV Pedro SDR
  nomelead: 'nomeLead',
  importadode: 'ignorar',
  obs: 'observacao',
  status: 'tipo',
  detalhamento: 'detalhamento',
  followupsjson: 'followupsJson',
  followups: 'followupsJson',
  fups: 'followupsJson',
};

function normalizarChave(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 :]/g, '')
    .trim();
}

function detectarCampo(coluna: string): CampoBanco {
  const key = normalizarChave(coluna);
  return AUTO_MAP[key] || 'ignorar';
}

// ─── Normalização de datas ────────────────────────────────────────────────────
function normalizarData(valor: string): string | null {
  if (!valor || valor.trim() === '' || valor === '-') return null;

  const v = valor.trim();
  let iso: string | null = null;

  // dd/mm/yyyy ou d/m/yyyy
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) iso = `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;

  // yyyy-mm-dd
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) iso = v;

  if (!iso) return null;

  // Valida se a data realmente existe (ex: 2026-02-31 não existe)
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) {
    return null; // data inválida como 31/02 ou 30/02
  }

  return iso;
}

// ─── Normalização de tipo ─────────────────────────────────────────────────────
function normalizarTipo(valor: string): CreateAvancoDto['tipo'] | null {
  if (!valor) return null;
  const v = valor.toLowerCase().trim();
  if (v.includes('interessado') || v.includes('interested')) return 'Interessado';
  if (v.includes('apresent')) return 'Apresentação';
  if (v.includes('encaminh')) return 'Encaminhamento';
  if (v.includes('nutri')) return 'Nutrição';
  return null;
}

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(CsvMapeamento)
    private readonly mapeamentoRepo: Repository<CsvMapeamento>,
    private readonly avancosService: AvancosService,
  ) {}

  // ─── Passo 1: analisa o CSV e retorna colunas + sugestão de mapeamento ───

  async analisarCsv(buffer: Buffer, nomeArquivo: string) {
    const conteudo = this.decodificar(buffer);
    const linhas = this.parsearCsv(conteudo);

    if (!linhas.length) throw new BadRequestException('CSV vazio ou inválido');

    // Encontra a linha de cabeçalho (pula linhas vazias ou de título)
    const { cabecalho, linhaIdx } = this.encontrarCabecalho(linhas);

    // Sugestão automática de mapeamento
    const sugestao = cabecalho.map((col) => ({
      colunaCsv: col,
      campoBanco: detectarCampo(col),
    }));

    // Verifica se já existe mapeamento salvo para este nome de arquivo
    const mapeamentoSalvo = await this.mapeamentoRepo.find({
      where: { nomeArquivo },
    });
    if (mapeamentoSalvo.length) {
      const mapa = Object.fromEntries(
        mapeamentoSalvo.map((m) => [m.colunaCsv, m.campoBanco]),
      );
      for (const s of sugestao) {
        if (mapa[s.colunaCsv]) s.campoBanco = mapa[s.colunaCsv] as CampoBanco;
      }
    }

    // Prévia das primeiras 5 linhas de dados
    const previa = linhas
      .slice(linhaIdx + 1, linhaIdx + 6)
      .filter((l) => l.some((c) => c.trim() !== ''))
      .map((l) =>
        Object.fromEntries(cabecalho.map((col, i) => [col, l[i] || ''])),
      );

    return {
      nomeArquivo,
      cabecalho,
      sugestao,
      previa,
      totalLinhas: linhas.length - linhaIdx - 1,
      camposDisponiveis: CAMPOS_BANCO,
    };
  }

  // ─── Passo 2: executa o import com o mapeamento confirmado pelo usuário ───

  async executarImport(
    buffer: Buffer,
    nomeArquivo: string,
    mapeamento: { colunaCsv: string; campoBanco: CampoBanco }[],
    tipoDefault?: CreateAvancoDto['tipo'],
    clienteDefault?: string,
  ): Promise<{ inseridos: number; ignorados: number; erros: string[] }> {
    const conteudo = this.decodificar(buffer);
    const linhas = this.parsearCsv(conteudo);
    const { cabecalho, linhaIdx } = this.encontrarCabecalho(linhas);

    // Salva o mapeamento para uso futuro
    await this.salvarMapeamento(nomeArquivo, mapeamento);

    const mapaIdx = Object.fromEntries(
      mapeamento.map((m) => [m.campoBanco, cabecalho.indexOf(m.colunaCsv)]),
    );

    const dtos: CreateAvancoDto[] = [];
    const erros: string[] = [];
    let ignorados = 0;

    const linhasDados = linhas.slice(linhaIdx + 1);

    for (let i = 0; i < linhasDados.length; i++) {
      const linha = linhasDados[i];
      if (linha.every((c) => !c.trim())) { ignorados++; continue; }

      const get = (campo: CampoBanco) => {
        const idx = mapaIdx[campo];
        return idx !== undefined && idx >= 0 ? (linha[idx] || '').trim() : '';
      };

      let clienteVal = get('cliente') || clienteDefault || '';
      if (!clienteVal) {
        erros.push(`Linha ${linhaIdx + i + 2}: cliente em branco — ignorada`);
        ignorados++;
        continue;
      }
      // Separa "Cliente - Campanha" quando o padrão existe e não há coluna campanha mapeada
      let campanhaExtraida: string | null = null;
      const campanhaColunaIdx = mapaIdx['campanha'];
      const hasCampanhaColuna = campanhaColunaIdx !== undefined && campanhaColunaIdx >= 0;
      if (!hasCampanhaColuna && clienteVal.includes(' - ')) {
        const partes = clienteVal.split(' - ');
        clienteVal = partes[0].trim();
        campanhaExtraida = partes.slice(1).join(' - ').trim();
      }
      // Normaliza capitalização do cliente (remove espaços extras)
      clienteVal = clienteVal.trim();

      const dataRaw = get('dataAvanco');
      const data = normalizarData(dataRaw);
      if (!data) {
        erros.push(`Linha ${linhaIdx + i + 2}: data inválida "${dataRaw}" — ignorada`);
        ignorados++;
        continue;
      }

      const tipoRaw = get('tipo');
      // tipoDefault normalizado: ignora string vazia, usa 'Interessado' como fallback final
      const defaultNorm = tipoDefault?.trim() || 'Interessado';
      const tipo = normalizarTipo(tipoRaw) || defaultNorm as CreateAvancoDto['tipo'];

      // Normaliza data_followup do CSV (pode vir como '29/04/2026 09:36' ou ISO)
      const followupRaw = get('dataFollowup');
      let dataFollowup: string | null = null;
      if (followupRaw) {
        // Tenta converter formatos comuns para ISO
        const dtMatch = followupRaw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?:[\sT](\d{2}:\d{2}))?$/);
        if (dtMatch) {
          const [, d, m, y, t] = dtMatch;
          dataFollowup = `${y}-${m}-${d}${t ? ' ' + t + ':00' : ' 09:00:00'}`;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(followupRaw)) {
          // Remove timezone offset se presente (ex: 2026-09-01T09:00:00-03:00 → 2026-09-01 09:00:00)
          // O banco armazena sem timezone; a hora local já é BRT
          dataFollowup = followupRaw
            .replace('T', ' ')
            .replace(/[+-]\d{2}:\d{2}$/, '')
            .slice(0, 19);
          if (dataFollowup.length === 10) dataFollowup += ' 09:00:00';
        }
      }

      // ── Detecta colunas de FUP dinamicamente (ex: DATA FUP 1, OBS FUP 1…) ──
      const fupEntries: { data: string; obs: string }[] = [];
      for (let n = 1; n <= 5; n++) {
        // Procura colunas com padrões: "DATA FUP N", "FUP N DATA", "DATA FOLLOWUP N"
        const fupDataPatterns = [`data fup ${n}`, `fup ${n} data`, `data followup ${n}`, `data fup${n}`];
        const fupObsPatterns  = [`obs fup ${n}`, `fup ${n} obs`, `obs followup ${n}`, `obs fup${n}`];

        // Índice da data do FUP N — busca no cabeçalho original
        let fupDataIdx = -1;
        let fupObsIdx  = -1;
        for (let ci = 0; ci < cabecalho.length; ci++) {
          const norm = normalizarChave(cabecalho[ci]);
          // Identifica coluna de data: "DATA FUP N" onde N é o número
          if (fupDataPatterns.includes(norm)) fupDataIdx = ci;
          if (fupObsPatterns.includes(norm))  fupObsIdx  = ci;
        }

        // Fallback: detecta por posição relativa para formato "DATA FUP N, OBS, DATA FUP N+1…"
        // Padrão do CSV Pedro: cols 6,7 = DATA FUP1,OBS; 8,9 = DATA FUP2,OBS; 10,11 = DATA FUP3,OBS
        if (fupDataIdx < 0) {
          // Procura cabeçalho que contenha "fup" + número na posição
          for (let ci = 0; ci < cabecalho.length; ci++) {
            const norm = normalizarChave(cabecalho[ci]);
            // Tenta casar "data fup 1", "data fup1", "fup 1", etc.
            if (new RegExp(`(data\s*)?fup\s*${n}$`).test(norm) && fupDataIdx < 0) fupDataIdx = ci;
            // OBS logo após a data do FUP (índice + 1)
          }
          if (fupDataIdx >= 0 && fupObsIdx < 0) fupObsIdx = fupDataIdx + 1;
        }

        if (fupDataIdx < 0) continue;

        const fupDataRaw = (linha[fupDataIdx] || '').trim();
        const fupObsRaw  = fupObsIdx >= 0 ? (linha[fupObsIdx] || '').trim() : '';
        const fupDataIso = normalizarData(fupDataRaw);
        if (!fupDataIso) continue;

        fupEntries.push({ data: fupDataIso, obs: fupObsRaw });
      }

      // Prioriza coluna followupsJson direta (CSV já convertido); fallback para fupEntries detectados
      const followupsJsonDireto = get('followupsJson') || null;
      const followupsJson = followupsJsonDireto || (fupEntries.length > 0 ? JSON.stringify(fupEntries) : null);

      // Detalhamento (status final do lead)
      const detalhamento = get('detalhamento') || null;

      dtos.push({
        cliente:       clienteVal,
        tipo,
        nomeLead:      get('nomeLead')    || null,
        cargo:         get('cargo')       || null,
        empresa:       get('empresa')     || null,
        segmento:      get('segmento')    || null,
        campanha:      get('campanha')    || campanhaExtraida || null,
        dataAvanco:    data,
        responsavel:   get('responsavel') || null,
        observacao:    get('observacao')  || null,
        importadoDe:   nomeArquivo,
        dataFollowup:  dataFollowup || null,
        tratativa:     get('tratativa')   || null,
        followupsJson,
        detalhamento,
      });
    }

    if (!dtos.length) {
      return { inseridos: 0, ignorados, erros };
    }

    // Insere em lotes de 500
    const LOTE = 100;
    let inseridos = 0;
    for (let i = 0; i < dtos.length; i += LOTE) {
      const lote = dtos.slice(i, i + LOTE);
      const resultado = await this.avancosService.createMany(lote);
      inseridos += resultado.inseridos;
    }

    return { inseridos, ignorados, erros };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private decodificar(buffer: Buffer): string {
    // Detecta encoding pelo conteúdo: se tiver sequências latin1 típicas, usa latin1
    const latin1 = iconv.decode(buffer, 'latin1');
    const utf8 = buffer.toString('utf-8');
    // Se utf8 tem caracteres de substituição (Ã, Â etc.) e latin1 parece limpo, usa latin1
    const utf8HasGarbage = /Ã[£©ª«¢¡§¨°±²³´µ¶·¸¹º»¼½¾¿àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(utf8);
    if (utf8HasGarbage) return latin1;
    return utf8;
  }

  private parsearCsv(conteudo: string): string[][] {
    try {
      return parse(conteudo, {
        relax_quotes: true,
        relax_column_count: true,
        skip_empty_lines: false,
        trim: false,
      }) as string[][];
    } catch {
      // fallback: split manual
      return conteudo.split('\n').map((l) =>
        l.replace(/\r$/, '').split(','),
      );
    }
  }

  private encontrarCabecalho(linhas: string[][]): {
    cabecalho: string[];
    linhaIdx: number;
  } {
    // Procura a primeira linha que tenha ao menos 3 colunas não-vazias
    for (let i = 0; i < Math.min(10, linhas.length); i++) {
      const naoVazias = linhas[i].filter((c) => c.trim() !== '');
      if (naoVazias.length >= 3) {
        // Coluna 0 sem nome (caso Latifi): renomeia para "_cliente"
        const cab = linhas[i].map((c, idx) => {
          const v = c.trim();
          if (!v && idx === 0) return '_cliente';
          return v;
        });
        return { cabecalho: cab, linhaIdx: i };
      }
    }
    return { cabecalho: linhas[0].map((c) => c.trim()), linhaIdx: 0 };
  }

  private async salvarMapeamento(
    nomeArquivo: string,
    mapeamento: { colunaCsv: string; campoBanco: CampoBanco }[],
  ) {
    for (const m of mapeamento) {
      if (m.campoBanco === 'ignorar') continue;
      // Usa INSERT ... ON DUPLICATE KEY UPDATE direto para evitar bug do TypeORM com orUpdate
      await this.mapeamentoRepo.query(
        `INSERT INTO csv_mapeamentos (nome_arquivo, coluna_csv, campo_banco)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE campo_banco = VALUES(campo_banco)`,
        [nomeArquivo, m.colunaCsv, m.campoBanco],
      );
    }
  }

  // ─── Lista mapeamentos salvos ─────────────────────────────────────────────

  async getMapeamentos() {
    return this.mapeamentoRepo.find({ order: { nomeArquivo: 'ASC' } });
  }

  async deleteMapeamento(nomeArquivo: string) {
    await this.mapeamentoRepo.delete({ nomeArquivo });
    return { ok: true };
  }
}
