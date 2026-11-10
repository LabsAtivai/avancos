import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PainelApiKeyGuard } from './painel-api-key.guard';
import { PainelService } from './painel.service';
import {
  decodificarCursor, normalizarClientes, parseBooleano, parseInteiroLimitado,
  TAMANHO_PAGINA_RESUMO,
} from './painel.util';

// Integração somente leitura para o Painel de Campanhas.
// Autenticação exclusiva de serviço por chave (PainelApiKeyGuard); nenhuma rota de escrita/credenciais aqui.
@Controller('integracoes/painel/v1')
@UseGuards(PainelApiKeyGuard)
export class PainelController {
  constructor(private readonly service: PainelService) {}

  @Get('clientes')
  clientes() {
    return this.service.clientes();
  }

  // GET /api/integracoes/painel/v1/resumo?dataInicio=&dataFim=&cliente=&cliente=&cursor=
  @Get('resumo')
  resumo(
    @Query('dataInicio') dataInicio: unknown,
    @Query('dataFim') dataFim: unknown,
    @Query('cliente') cliente: unknown,
    @Query('cursor') cursor: unknown,
  ) {
    return this.service.resumo({
      dataInicio,
      dataFim,
      clientes: normalizarClientes(cliente),
      cursor: decodificarCursor(cursor),
      limite: TAMANHO_PAGINA_RESUMO,
    });
  }

  // GET /api/integracoes/painel/v1/status?dias=3&excluirHoje=true
  @Get('status')
  status(
    @Query('dias') dias: unknown,
    @Query('excluirHoje') excluirHoje: unknown,
  ) {
    return this.service.status(
      parseInteiroLimitado(dias, 3, 1, 30, 'dias'),
      parseBooleano(excluirHoje, true, 'excluirHoje'),
    );
  }

  // GET /api/integracoes/painel/v1/health
  @Get('health')
  health() {
    return this.service.health();
  }
}
