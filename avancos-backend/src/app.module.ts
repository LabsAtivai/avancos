import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvancosModule } from './avancos/avancos.module';
import { RelatorioModule } from './relatorio/relatorio.module';
import { CredenciaisModule } from './credenciais/credenciais.module';
import { ImportModule } from './import/import.module';
import { Avanco } from './avancos/entities/avanco.entity';
import { CsvMapeamento } from './import/entities/csv-mapeamento.entity';
import { Credencial } from './credenciais/credencial.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'avancos_comerciais',
      entities: [Avanco, CsvMapeamento, Credencial],
      synchronize: false, // usar o SQL manual no HeidiSQL
      charset: 'utf8mb4',
    }),

    AvancosModule,
    RelatorioModule,
    CredenciaisModule,
    ImportModule,
  ],
})
export class AppModule {}
