import {
  Controller, Post, Get, Delete,
  UploadedFile, UseInterceptors,
  Body, Param, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService, CampoBanco } from './import.service';

@Controller('import')
export class ImportController {
  constructor(private readonly service: ImportService) {}

  // POST /api/import/analisar
  // Etapa 1: envia o CSV, recebe colunas + sugestão de mapeamento
  // Body: multipart/form-data com campo "arquivo" (CSV)
  @Post('analisar')
  @UseInterceptors(FileInterceptor('arquivo'))
  async analisar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Envie o arquivo CSV no campo "arquivo"');
    const nomeArquivo = file.originalname.replace(/\.(csv|CSV)$/, '').trim();
    return this.service.analisarCsv(file.buffer, nomeArquivo);
  }

  // POST /api/import/executar
  // Etapa 2: confirma o mapeamento e importa os dados
  // Body JSON:
  // {
  //   "nomeArquivo": "Ana Carolina",
  //   "tipoDefault": "Interessado",   (opcional — se não houver coluna tipo)
  //   "clienteDefault": "Studio",     (opcional — se não houver coluna cliente)
  //   "mapeamento": [
  //     { "colunaCsv": "Cliente", "campoBanco": "cliente" },
  //     { "colunaCsv": "Nome",    "campoBanco": "nomeLead" },
  //     ...
  //   ]
  // }
  // Arquivo CSV vem no campo "arquivo"
  @Post('executar')
  @UseInterceptors(FileInterceptor('arquivo'))
  async executar(
    @UploadedFile() file: Express.Multer.File,
    @Body('nomeArquivo') nomeArquivo: string,
    @Body('tipoDefault') tipoDefault: string,
    @Body('clienteDefault') clienteDefault: string,
    @Body('mapeamento') mapeamentoStr: string,
  ) {
    if (!file) throw new BadRequestException('Envie o arquivo CSV no campo "arquivo"');
    if (!nomeArquivo) throw new BadRequestException('Campo "nomeArquivo" obrigatório');
    if (!mapeamentoStr) throw new BadRequestException('Campo "mapeamento" obrigatório');

    let mapeamento: { colunaCsv: string; campoBanco: CampoBanco }[];
    try {
      mapeamento = JSON.parse(mapeamentoStr);
    } catch {
      throw new BadRequestException('Campo "mapeamento" deve ser JSON válido');
    }

    return this.service.executarImport(
      file.buffer,
      nomeArquivo,
      mapeamento,
      tipoDefault as any,
      clienteDefault,
    );
  }

  // GET /api/import/mapeamentos
  // Lista todos os mapeamentos salvos
  @Get('mapeamentos')
  getMapeamentos() {
    return this.service.getMapeamentos();
  }

  // DELETE /api/import/mapeamentos/:nomeArquivo
  // Remove mapeamento salvo de um arquivo para remapear do zero
  @Delete('mapeamentos/:nomeArquivo')
  deleteMapeamento(@Param('nomeArquivo') nomeArquivo: string) {
    return this.service.deleteMapeamento(nomeArquivo);
  }

  // GET /api/import/campos
  // Lista os campos disponíveis no banco (para popular dropdowns no front)
  @Get('campos')
  getCampos() {
    return {
      campos: [
        { valor: 'cliente',     label: 'Cliente' },
        { valor: 'tipo',        label: 'Tipo de avanço' },
        { valor: 'nomeLead',    label: 'Nome do lead' },
        { valor: 'cargo',       label: 'Cargo' },
        { valor: 'empresa',     label: 'Empresa' },
        { valor: 'segmento',    label: 'Segmento' },
        { valor: 'campanha',    label: 'Campanha' },
        { valor: 'dataAvanco',  label: 'Data do avanço' },
        { valor: 'responsavel', label: 'Responsável' },
        { valor: 'observacao',  label: 'Observação' },
        { valor: 'porte',       label: 'Porte / Tamanho' },
        { valor: 'ignorar',     label: '— Ignorar coluna —' },
      ],
    };
  }
}
