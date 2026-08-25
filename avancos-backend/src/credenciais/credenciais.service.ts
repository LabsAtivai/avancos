import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Credencial } from './credencial.entity';
import { CreateCredencialDto, UpdateCredencialDto } from './credencial.dto';

@Injectable()
export class CredenciaisService {
  constructor(
    @InjectRepository(Credencial)
    private readonly repo: Repository<Credencial>,
  ) {}

  findAll(apenasAtivos = false) {
    return this.repo.find({
      where: apenasAtivos ? { ativo: true } : {},
      order: { cliente: 'ASC' },
    });
  }

  async findOne(id: number) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Credencial #${id} não encontrada`);
    return c;
  }

  async findByCliente(cliente: string) {
    if (!cliente) throw new NotFoundException('Cliente não informado');

    // 1. Match exato
    let c = await this.repo.findOne({ where: { cliente, ativo: true } });
    if (c) return c;

    // 2. Match case-insensitive via LIKE
    const todas = await this.repo.find({ where: { ativo: true } });

    const normalizar = (s: string) =>
      s.toLowerCase()
       .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
       .replace(/[^a-z0-9\s]/g, ' ')
       .replace(/\s+/g, ' ')
       .trim();

    const clienteNorm = normalizar(cliente);

    // 3. Match: cliente da credencial contém o nome buscado ou vice-versa
    c = todas.find(cred => {
      const credNorm = normalizar(cred.cliente);
      return credNorm === clienteNorm ||
             credNorm.includes(clienteNorm) ||
             clienteNorm.includes(credNorm);
    });
    if (c) return c;

    // 4. Match por tokens — todas as palavras significativas em comum
    const tokensCliente = clienteNorm.split(' ').filter(t => t.length > 2);
    let melhor: { cred: typeof todas[0]; score: number } | null = null;

    for (const cred of todas) {
      const tokensCred = normalizar(cred.cliente).split(' ').filter(t => t.length > 2);
      const comuns = tokensCliente.filter(t =>
        tokensCred.some(tc => tc.includes(t) || t.includes(tc))
      );
      if (comuns.length > 0) {
        const score = comuns.length / Math.max(tokensCliente.length, tokensCred.length);
        if (!melhor || score > melhor.score) melhor = { cred, score };
      }
    }

    if (melhor && melhor.score >= 0.4) return melhor.cred;

    throw new NotFoundException(`Credenciais do cliente "${cliente}" não encontradas`);
  }

  async create(dto: CreateCredencialDto) {
    const existe = await this.repo.findOne({ where: { emailClient: dto.emailClient } });
    if (existe) throw new ConflictException(`Email client "${dto.emailClient}" já cadastrado`);
    const c = this.repo.create(dto);
    return this.repo.save(c);
  }

  async update(id: number, dto: UpdateCredencialDto) {
    const c = await this.findOne(id);
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  // Retorna credenciais completas (para exibição na tela de gestão)
  async findAllCompleto() {
    const lista = await this.findAll();
    return lista.map(c => ({
      id:              c.id,
      cliente:         c.cliente,
      emailClient:     c.emailClient,
      clientId:        c.clientId,
      clientSecret:    c.clientSecret,
      snovEmail:       c.snovEmail,
      snovSenha:       c.snovSenha,

      ativo:           c.ativo,
      criadoEm:        c.criadoEm,
    }));
  }

  // Retorna credenciais sem a senha (para listagem segura)
  async findAllSafe() {
    const lista = await this.findAll();
    return lista.map(c => ({
      id:          c.id,
      cliente:     c.cliente,
      emailClient: c.emailClient,
      clientId:    c.clientId,
      snovEmail:   c.snovEmail,
      ativo:       c.ativo,
      criadoEm:    c.criadoEm,
      // clientSecret e snovSenha omitidos intencionalmente
    }));
  }
}
