import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export type TipoAvanco = 'Interessado' | 'Apresentação' | 'Encaminhamento' | 'Nutrição';

export interface FollowupEntry {
  data: string;       // ISO date
  obs: string;
}

@Entity('avancos')
@Index(['cliente', 'dataAvanco'])
export class Avanco {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ length: 200 })
  cliente: string;

  @Column({
    type: 'enum',
    enum: ['Interessado', 'Apresentação', 'Encaminhamento', 'Nutrição'],
  })
  tipo: TipoAvanco;

  @Column({ name: 'nome_lead', length: 200, nullable: true })
  nomeLead: string;

  @Column({ length: 150, nullable: true })
  cargo: string;

  @Column({ length: 200, nullable: true })
  empresa: string;

  @Index()
  @Column({ length: 150, nullable: true })
  segmento: string;

  @Index()
  @Column({ length: 200, nullable: true })
  campanha: string;

  @Column({ name: 'data_avanco', type: 'date' })
  dataAvanco: string;

  @Column({ length: 150, nullable: true })
  responsavel: string;

  @Column({ length: 50, nullable: true })
  porte: string;

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @Column({ name: 'importado_de', length: 100, nullable: true })
  importadoDe: string;

  @Column({ name: 'data_followup', type: 'datetime', nullable: true })
  dataFollowup: Date | null;

  @Column({ type: 'text', nullable: true })
  tratativa: string | null;

  // Histórico de follow-ups em JSON: [{data, obs}, ...]
  @Column({ name: 'followups_json', type: 'text', nullable: true })
  followupsJson: string | null;

  // Detalhamento / status final do lead
  @Column({ length: 100, nullable: true })
  detalhamento: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
