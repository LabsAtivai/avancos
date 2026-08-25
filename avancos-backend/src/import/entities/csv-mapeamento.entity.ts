import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Unique,
} from 'typeorm';

@Entity('csv_mapeamentos')
@Unique(['nomeArquivo', 'colunaCsv'])
export class CsvMapeamento {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'nome_arquivo', length: 200 })
  nomeArquivo: string;

  @Column({ name: 'coluna_csv', length: 100 })
  colunaCsv: string;

  @Column({ name: 'campo_banco', length: 100 })
  campoBanco: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
