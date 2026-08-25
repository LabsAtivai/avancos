import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CredenciaisController } from './credenciais.controller';
import { CredenciaisService } from './credenciais.service';
import { Credencial } from './credencial.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Credencial])],
  controllers: [CredenciaisController],
  providers: [CredenciaisService],
  exports: [CredenciaisService],
})
export class CredenciaisModule {}
