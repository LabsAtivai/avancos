import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─── CreateAvancoDto ──────────────────────────────────────────────────────────
export class CreateAvancoDto {
  @IsString() cliente: string;
  @IsString() @IsIn(['Interessado','Apresentação','Encaminhamento','Nutrição'])
  tipo: 'Interessado' | 'Apresentação' | 'Encaminhamento' | 'Nutrição';
  @IsOptional() @IsString() nomeLead?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() campanha?: string;
  @IsString() dataAvanco: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() observacao?: string;
  @IsOptional() @IsString() porte?: string;
  @IsOptional() @IsString() importadoDe?: string;
  @IsOptional() @IsString() dataFollowup?: string | null;
  @IsOptional() @IsString() tratativa?: string | null;
}

// ─── UpdateAvancoDto ──────────────────────────────────────────────────────────
export class UpdateAvancoDto {
  @IsOptional() @IsString() cliente?: string;
  @IsOptional() @IsString()
  @IsIn(['Interessado','Apresentação','Encaminhamento','Nutrição',''])
  tipo?: 'Interessado' | 'Apresentação' | 'Encaminhamento' | 'Nutrição';
  @IsOptional() @IsString() nomeLead?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() campanha?: string;
  @IsOptional() @IsString() dataAvanco?: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() observacao?: string;
  @IsOptional() @IsString() porte?: string;
  @IsOptional() @IsString() dataFollowup?: string | null;
  @IsOptional() @IsString() tratativa?: string | null;
}

// ─── FilterAvancoDto ──────────────────────────────────────────────────────────
export class FilterAvancoDto {
  // Filtros SDR Remoto
  @IsOptional() @IsString() followupStatus?: string; // pendente | vencido | hoje | todos
  @IsOptional() @IsString() sdrResponsavel?: string;
  // Filtros exatos (dropdown)
  @IsOptional() @IsString() clienteExato?: string;
  @IsOptional() @IsString() clientes?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() segmentoExato?: string;
  @IsOptional() @IsString() campanhaExata?: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() porte?: string;
  @IsOptional() @IsString() importadoDe?: string;

  // Filtros parciais (busca livre)
  @IsOptional() @IsString() cliente?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() campanha?: string;
  @IsOptional() @IsString() busca?: string;

  // Período
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() dataFim?: string;
  @IsOptional() @Type(() => Number) @IsNumber() ano?: number;

  // Ordenação
  @IsOptional() @IsString() orderBy?: string;
  @IsOptional() @IsString() orderDir?: string;

  // Paginação
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}

// ─── PptxQueryDto ─────────────────────────────────────────────────────────────
export class PptxQueryDto {
  @IsString() cliente: string;
  @IsString() dataInicio: string;
  @IsString() dataFim: string;
}

// ─── ExportQueryDto ───────────────────────────────────────────────────────────
export class ExportQueryDto {
  @IsOptional() @IsString() clienteExato?: string;
  @IsOptional() @IsString() clientes?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() segmentoExato?: string;
  @IsOptional() @IsString() campanhaExata?: string;
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() dataFim?: string;
  @IsOptional() @Type(() => Number) @IsNumber() ano?: number;
  @IsOptional() @IsString() busca?: string;
}
