import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvancosController } from './avancos.controller';
import { AvancosService } from './avancos.service';
import { Avanco } from './entities/avanco.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Avanco])],
  controllers: [AvancosController],
  providers: [AvancosService],
  exports: [AvancosService],
})
export class AvancosModule {}
