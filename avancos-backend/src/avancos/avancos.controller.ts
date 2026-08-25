import {
  Controller, Get, Post, Put, Delete, Res,
  Param, Body, Query, ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { AvancosService } from './avancos.service';
import {
  CreateAvancoDto,
  UpdateAvancoDto,
  FilterAvancoDto,
  PptxQueryDto,
  ExportQueryDto,
} from './dto/avancos.dto';

@Controller('avancos')
export class AvancosController {
  constructor(private readonly service: AvancosService) {}

  // POST /api/avancos
  @Post()
  create(@Body() dto: CreateAvancoDto) {
    return this.service.create(dto);
  }

  // GET /api/avancos
  // Filtros: clienteExato, tipo, segmentoExato, campanhaExata, responsavel, porte,
  //          importadoDe, cliente, segmento, campanha, busca,
  //          dataInicio, dataFim, ano, orderBy, orderDir, page, limit
  @Get()
  findAll(@Query() filter: FilterAvancoDto) {
    return this.service.findAll(filter);
  }

  // GET /api/avancos/followup-count?responsavel=Leandro
  @Get('followup-count')
  getFollowupCount(@Query('responsavel') responsavel: string) {
    if (!responsavel) return { vencidos: 0, hoje: 0, total: 0 };
    return this.service.getFollowupCount(responsavel);
  }

  // GET /api/avancos/opcoes
  @Get('opcoes')
  getOpcoes() {
    return this.service.getOpcoes();
  }

  // GET /api/avancos/estatisticas
  // Filtros: cliente, campanha, tipo, dataInicio, dataFim, ano
  @Get('estatisticas')
  getEstatisticas(
    @Query('cliente')    cliente?: string,
    @Query('clientes')   clientes?: string,
    @Query('campanha')   campanha?: string,
    @Query('tipo')       tipo?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim')    dataFim?: string,
    @Query('ano')        ano?: number,
  ) {
    const clientesLista = typeof clientes === 'string' && clientes.trim()
      ? clientes.split('|').map(c => c.trim()).filter(Boolean).slice(0, 100)
      : undefined;
    const anoNum = ano ? parseInt(String(ano), 10) : undefined;
    // Sanitiza dataInicio/dataFim — garante formato YYYY-MM-DD
    const sanitizeDate = (d?: string) => {
      if (!d) return undefined;
      const match = String(d).match(/(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : undefined;
    };
    return this.service.getEstatisticas(
      cliente,
      sanitizeDate(dataInicio),
      sanitizeDate(dataFim),
      campanha, tipo, anoNum, clientesLista,
    );
  }

  // GET /api/avancos/exportar — exporta como .xlsx com identidade Ativa.ai
  @Get('exportar')
  async exportar(@Query() filter: ExportQueryDto, @Res() res: Response) {
    const dados = await this.service.exportar(filter);
    const hoje  = new Date().toISOString().slice(0, 10);

    // ── Cores Ativa.ai ──────────────────────────────────────────────
    const LARANJA   = 'FFFF6B00'; // laranja principal
    const BRANCO    = 'FFFFFFFF';
    const LARANJA_L = 'FFFFF3E0'; // laranja claro para linhas pares
    const CINZA_BD  = 'FFFFE0B2'; // borda laranja suave

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Ativa.ai';
    wb.created  = new Date();

    const ws = wb.addWorksheet('Avanços Comerciais', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // ── Colunas ─────────────────────────────────────────────────────
    ws.columns = [
      { header: 'ID',           key: 'id',          width: 7  },
      { header: 'Cliente',      key: 'cliente',     width: 26 },
      { header: 'Tipo',         key: 'tipo',        width: 16 },
      { header: 'Nome Lead',    key: 'nomeLead',    width: 26 },
      { header: 'Cargo',        key: 'cargo',       width: 22 },
      { header: 'Empresa',      key: 'empresa',     width: 26 },
      { header: 'Segmento',     key: 'segmento',    width: 30 },
      { header: 'Tamanho',      key: 'porte',       width: 14 },
      { header: 'Fonte',        key: 'campanha',    width: 26 },
      { header: 'Data Avanço',  key: 'dataAvanco',  width: 13 },
      { header: 'Responsável',  key: 'responsavel', width: 15 },
      { header: 'Observação',   key: 'observacao',  width: 30 },
      { header: 'Follow-up',    key: 'dataFollowup',width: 18 },
      { header: 'Tratativa',    key: 'tratativa',   width: 38 },
    ];

    // ── Cabeçalho laranja ───────────────────────────────────────────
    const hdr = ws.getRow(1);
    hdr.height = 24;
    hdr.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
      cell.font      = { bold: true, color: { argb: BRANCO }, size: 11, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border    = {
        bottom: { style: 'medium', color: { argb: BRANCO } },
        right:  { style: 'thin',   color: { argb: BRANCO } },
      };
    });

    // ── Cores por tipo ──────────────────────────────────────────────
    const tipoCor: Record<string, string> = {
      'Interessado':    'FFFFF8F0',
      'Apresentação':   'FFFFF3E0',
      'Encaminhamento': 'FFFFE0B2',
      'Nutrição':       'FFFFD5A3',
    };

    dados.forEach((a, idx) => {
      const row = ws.addRow({
        id:          a.id,
        cliente:     a.cliente     || '',
        tipo:        a.tipo        || '',
        nomeLead:    a.nomeLead    || '',
        cargo:       a.cargo       || '',
        empresa:     a.empresa     || '',
        segmento:    a.segmento    || '',
        porte:       a.porte       || '',
        campanha:    a.campanha    || '',
        dataAvanco:  a.dataAvanco  || '',
        responsavel: a.responsavel || '',
        observacao:  a.observacao  || '',
        dataFollowup: a.dataFollowup
          ? new Date(a.dataFollowup).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          : '',
        tratativa:   a.tratativa   || '',
      });

      row.height = 18;
      const bg = tipoCor[a.tipo] || (idx % 2 === 0 ? BRANCO : LARANJA_L);
      row.eachCell(cell => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font      = { size: 10, name: 'Calibri', color: { argb: 'FF333333' } };
        cell.alignment = { vertical: 'middle' };
        cell.border    = {
          bottom: { style: 'thin', color: { argb: CINZA_BD } },
          right:  { style: 'thin', color: { argb: CINZA_BD } },
        };
      });
    });

    // ── Linha de rodapé com logo ────────────────────────────────────
    const totalRows = dados.length + 2; // header + data + footer
    const footerRow = ws.getRow(totalRows + 1);
    footerRow.height = 28;

    // Célula A do rodapé — "Ativa.ai | Gerado em ..."
    const footerCell = ws.getCell(`A${totalRows + 1}`);
    footerCell.value = `Ativa.ai  |  Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}  |  ${dados.length} registros`;
    footerCell.font  = { bold: true, color: { argb: BRANCO }, size: 10, name: 'Calibri' };
    footerCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Preenche todas as células do rodapé com laranja
    for (let col = 1; col <= ws.columns.length; col++) {
      const cell = ws.getCell(totalRows + 1, col);
      if (!cell.value) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
        cell.border = { top: { style: 'medium', color: { argb: BRANCO } } };
      }
    }

    // ── Logo Ativa.ai no rodapé (canto inferior esquerdo) ──────────
    const logoB64 = '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';
    const logoId  = wb.addImage({
      base64:    logoB64,
      extension: 'png',
    });
    ws.addImage(logoId, {
      tl: { col: 0, row: totalRows },   // linha do rodapé
      ext: { width: 90, height: 32 },
    });

    // ── Freeze header + autofilter ──────────────────────────────────
    ws.views       = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter  = { from: 'A1', to: `N${dados.length + 1}` };

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="avancos_${hoje}.xlsx"`);
    return res.send(buffer);
  }

  // GET /api/avancos/pptx
  @Get('pptx')
  getPptxData(@Query() dto: PptxQueryDto) {
    return this.service.getPptxData(dto);
  }

  // GET /api/avancos/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // PUT /api/avancos/:id
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvancoDto,
  ) {
    return this.service.update(id, dto);
  }

  // DELETE /api/avancos/:id
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
