import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('credenciais_clientes')
export class Credencial {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ length: 200 })
  cliente: string;

  @Column({ name: 'email_client', length: 200, unique: true })
  emailClient: string;

  @Column({ name: 'client_id', length: 100 })
  clientId: string;

  @Column({ name: 'client_secret', length: 200 })
  clientSecret: string;

  @Column({ name: 'snov_email', length: 200, unique: true })
  snovEmail: string;

  @Column({ name: 'snov_senha', length: 200 })
  snovSenha: string;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
