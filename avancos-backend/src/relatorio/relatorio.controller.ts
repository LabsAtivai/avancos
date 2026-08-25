import {
  Controller, Get, Post, Res, Query,
  UploadedFile, UseInterceptors, Body,
  BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RelatorioService } from './relatorio.service';

@Controller('relatorio')
export class RelatorioController {
  constructor(private readonly service: RelatorioService) {}

  // GET /api/relatorio/campanhas?snovId=X&snovSecret=Y
  // Retorna lista de campanhas da conta Snov.io
  @Get('campanhas')
  async listarCampanhas(
    @Query('snovId')     snovId: string,
    @Query('snovSecret') snovSecret: string,
  ) {
    if (!snovId || !snovSecret) throw new BadRequestException('snovId e snovSecret obrigatórios');
    try {
      return await this.service.listarCampanhas(snovId, snovSecret);
    } catch (e) {
      const msg = e?.response?.data
        ? JSON.stringify(e.response.data).slice(0, 200)
        : e.message;
      throw new InternalServerErrorException(`Erro ao buscar campanhas Snov.io: ${msg}`);
    }
  }

  // POST /api/relatorio/metricas
  // Retorna métricas por campanha sem gerar PPTX — para exibir na tela
  @Post('metricas')
  async getMetricas(@Body() body: any) {
    const { snovId, snovSecret, atualInicio, atualFim,
            anteriorInicio, anteriorFim, geralInicio, geralFim, campanhas } = body;
    if (!snovId || !snovSecret) throw new BadRequestException('Credenciais obrigatórias');
    if (!campanhas?.length) throw new BadRequestException('Selecione ao menos uma campanha');
    return this.service.getMetricasCampanhas({
      snovId, snovSecret, atualInicio, atualFim,
      anteriorInicio, anteriorFim, geralInicio, geralFim, campanhas,
    });
  }

  // POST /api/relatorio/gerar
  // multipart/form-data:
  //   cliente, snovId, snovSecret, previsto,
  //   atualInicio, atualFim, anteriorInicio, anteriorFim,
  //   geralInicio, geralFim, ajustePerformance,
  //   template (arquivo .pptx)
  @Post('gerar')
  @UseInterceptors(FileInterceptor('template', {
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.pptx$/i)) {
        return cb(new BadRequestException('Apenas arquivos .pptx são aceitos'), false);
      }
      cb(null, true);
    },
  }))
  async gerar(
    @UploadedFile() templateFile: Express.Multer.File,
    @Body('cliente')           cliente: string,
    @Body('snovId')            snovId: string,
    @Body('snovSecret')        snovSecret: string,
    @Body('previsto')          previsto: string,
    @Body('atualInicio')       atualInicio: string,
    @Body('atualFim')          atualFim: string,
    @Body('anteriorInicio')    anteriorInicio: string,
    @Body('anteriorFim')       anteriorFim: string,
    @Body('geralInicio')       geralInicio: string,
    @Body('geralFim')          geralFim: string,
    @Body('ajustePerformance') ajustePerformance: string,
    @Body('campanhasSelecionadas') campanhasSelecionadasStr: string,
    @Res() res: Response,
  ) {
    if (!templateFile) throw new BadRequestException('Template .pptx obrigatório');
    if (!cliente)      throw new BadRequestException('Cliente obrigatório');
    if (!snovId || !snovSecret) throw new BadRequestException('Credenciais Snov.io obrigatórias');

    let campanhasSelecionadas: Array<{ id: number; nome: string }> = [];
    if (campanhasSelecionadasStr) {
      try { campanhasSelecionadas = JSON.parse(campanhasSelecionadasStr); } catch {}
    }

    const pptxBuffer = await this.service.gerar({
      cliente, snovId, snovSecret, previsto,
      atualInicio, atualFim,
      anteriorInicio, anteriorFim,
      geralInicio, geralFim,
      ajustePerformance,
      templateBuffer: templateFile.buffer,
      campanhasSelecionadas,
    });

    const nomeArquivo = `Reuniao_Resultados_${cliente.replace(/[^a-zA-Z0-9]/g, '_')}_${atualFim}.pptx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(pptxBuffer);
  }
}
