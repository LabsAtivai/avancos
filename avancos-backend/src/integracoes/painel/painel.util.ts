import { BadRequestException } from '@nestjs/common';

export const TIPOS_AVANCO = ['Interessado', 'Apresentação', 'Encaminhamento', 'Nutrição'] as const;
export const FUSO = 'America/Sao_Paulo';
export const MAX_DIAS_INTERVALO = 366;
export const MAX_CLIENTES_FILTRO = 200;
export const TAMANHO_PAGINA_RESUMO = 500;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Valida YYYY-MM-DD real (rejeita 2026-02-30 etc.) e devolve a string normalizada. */
export function parseDataIso(valor: unknown, nome: string): string {
  if (typeof valor !== 'string' || !RE_DATA.test(valor)) {
    throw new BadRequestException(`${nome} deve estar no formato YYYY-MM-DD`);
  }
  const [y, m, d] = valor.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new BadRequestException(`${nome} não é uma data válida`);
  }
  return valor;
}

/** Diferença em dias entre duas datas ISO (b - a), em UTC. */
function paraUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function diferencaDias(a: string, b: string): number {
  return Math.round((paraUtc(b) - paraUtc(a)) / 86_400_000);
}

export function somarDias(iso: string, n: number): string {
  return new Date(paraUtc(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Data de hoje no fuso de São Paulo, YYYY-MM-DD. */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora);
}

/** Lê um parâmetro que pode vir repetido (?cliente=A&cliente=B) como lista. */
export function normalizarClientes(valor: unknown): string[] | undefined {
  if (valor === undefined || valor === null || valor === '') return undefined;
  const lista = Array.isArray(valor) ? valor : [valor];
  const limpos: string[] = [];
  for (const item of lista) {
    if (typeof item !== 'string') throw new BadRequestException('cliente inválido');
    const t = item.trim();
    if (!t) continue;
    if (t.length > 200) throw new BadRequestException('cliente excede 200 caracteres');
    if (!limpos.includes(t)) limpos.push(t);
  }
  if (limpos.length > MAX_CLIENTES_FILTRO) {
    throw new BadRequestException(`no máximo ${MAX_CLIENTES_FILTRO} clientes por requisição`);
  }
  return limpos.length ? limpos : undefined;
}

export interface CursorResumo { data: string; cliente: string }

export function codificarCursor(c: CursorResumo): string {
  return Buffer.from(JSON.stringify([c.data, c.cliente]), 'utf8').toString('base64url');
}

export function decodificarCursor(valor: unknown): CursorResumo | undefined {
  if (valor === undefined || valor === '') return undefined;
  try {
    if (typeof valor !== 'string') throw new Error();
    const arr = JSON.parse(Buffer.from(valor, 'base64url').toString('utf8'));
    if (!Array.isArray(arr) || typeof arr[0] !== 'string' || typeof arr[1] !== 'string') throw new Error();
    return { data: parseDataIso(arr[0], 'cursor'), cliente: arr[1] };
  } catch {
    throw new BadRequestException('cursor inválido');
  }
}

export function parseInteiroLimitado(valor: unknown, padrao: number, min: number, max: number, nome: string): number {
  if (valor === undefined || valor === '') return padrao;
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw new BadRequestException(`${nome} deve ser inteiro entre ${min} e ${max}`);
  }
  const n = Number(valor);
  if (n < min || n > max) throw new BadRequestException(`${nome} deve ser inteiro entre ${min} e ${max}`);
  return n;
}

export function parseBooleano(valor: unknown, padrao: boolean, nome: string): boolean {
  if (valor === undefined || valor === '') return padrao;
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  throw new BadRequestException(`${nome} deve ser true ou false`);
}

/** Status do semáforo: >=2 verde, 1 amarelo, 0 vermelho. */
export function statusSemaforo(interessados: number): 'verde' | 'amarelo' | 'vermelho' {
  if (interessados >= 2) return 'verde';
  if (interessados === 1) return 'amarelo';
  return 'vermelho';
}
