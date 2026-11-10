import {
  Controller, Get, Post, Put, Delete, UseGuards,
  Param, Body, Query, ParseIntPipe,
} from '@nestjs/common';
import { CredenciaisService } from './credenciais.service';
import { CredenciaisChaveGuard } from './credenciais-chave.guard';
import { CreateCredencialDto, UpdateCredencialDto } from './credencial.dto';

// Acesso protegido por CredenciaisChaveGuard (exceto a lista sem segredos).
@Controller('credenciais')
@UseGuards(CredenciaisChaveGuard)
export class CredenciaisController {
  constructor(private readonly service: CredenciaisService) {}

  // GET /api/credenciais — lista (completo=true retorna credenciais visíveis)
  @Get()
  findAll(@Query('completo') completo?: string) {
    if (completo === 'true') return this.service.findAllCompleto();
    return this.service.findAllSafe();
  }

  // GET /api/credenciais/buscar?cliente=X — busca credenciais por nome (inclui senhas)
  @Get('buscar')
  findByCliente(@Query('cliente') cliente: string) {
    if (!cliente) return null;
    return this.service.findByCliente(cliente);
  }

  // GET /api/credenciais/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // POST /api/credenciais
  @Post()
  create(@Body() dto: CreateCredencialDto) {
    return this.service.create(dto);
  }

  // PUT /api/credenciais/:id
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCredencialDto,
  ) {
    return this.service.update(id, dto);
  }

  // DELETE /api/credenciais/:id
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
