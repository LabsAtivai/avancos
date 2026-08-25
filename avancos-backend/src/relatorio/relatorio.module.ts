import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';
import { ChartsService } from './charts.service';
import { CredenciaisModule } from '../credenciais/credenciais.module';

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
    CredenciaisModule,
  ],
  controllers: [RelatorioController],
  providers: [RelatorioService, ChartsService],
})
export class RelatorioModule {}
