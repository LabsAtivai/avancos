import {
  Controller, Get, Post, Res, Query,
  UploadedFile, UseInterceptors, Body,
  BadRequestException, InternalServerErrorException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RelatorioService } from './relatorio.service';
import { CredenciaisService } from '../credenciais/credenciais.service';
import { SnovAmService } from './snov-am.service';

@Controller('relatorio')
export class RelatorioController {
  constructor(
    private readonly service: RelatorioService,
    private readonly credenciais: CredenciaisService,
    private readonly snovAm: SnovAmService,
  ) {}

  // Credenciais Snov.io ficam no servidor: o navegador envia só o nome do cliente.
  private async resolverSnov(cliente: string): Promise<{ snovId: string; snovSecret: string }> {
    const nome = cliente?.trim();
    if (!nome) throw new BadRequestException('Cliente obrigatório');

    // 1. Cópia local (credenciais_clientes), match exato.
    try {
      const c = await this.credenciais.findClienteExato(nome);
      return { snovId: c.clientId, snovSecret: c.clientSecret };
    } catch (e) {
      if (!(e instanceof NotFoundException)) throw e;
    }

    // 2. Fallback: snov-am-api, por nome ou email.
    const orientacao =
      `Nenhuma credencial Snov.io encontrada para o cliente "${nome}". ` +
      'O nome precisa ser igual ao cadastrado na tela Credenciais ' +
      '(ou à descrição/e-mail da conta no snov-am); só caixa, acentos e espaços são ignorados.';

    if (!this.snovAm.configurado()) {
      throw new NotFoundException(
        `${orientacao} A busca no snov-am está desativada neste servidor ` +
        '(CREDENTIALS_API_URL / CREDENTIALS_API_KEY não configuradas).',
      );
    }
    const r = await this.snovAm.buscarCredenciais(nome);
    if (!r) throw new NotFoundException(orientacao);
    return { snovId: r.clientId, snovSecret: r.clientSecret };
  }

  // GET /api/relatorio/campanhas?cliente=X
  // Retorna lista de campanhas da conta Snov.io do cliente
  @Get('campanhas')
  async listarCampanhas(@Query('cliente') cliente: string) {
    const { snovId, snovSecret } = await this.resolverSnov(cliente);
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
    const { cliente, atualInicio, atualFim,
            anteriorInicio, anteriorFim, geralInicio, geralFim, campanhas } = body;
    if (!campanhas?.length) throw new BadRequestException('Selecione ao menos uma campanha');
    const { snovId, snovSecret } = await this.resolverSnov(cliente);
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
    const { snovId, snovSecret } = await this.resolverSnov(cliente);

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
