import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { CsvMapeamento } from './entities/csv-mapeamento.entity';
import { AvancosModule } from '../avancos/avancos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CsvMapeamento]),
    MulterModule.register({
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(csv|CSV)$/)) {
          return cb(new Error('Somente arquivos .csv são aceitos'), false);
        }
        cb(null, true);
      },
    }),
    AvancosModule,
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
