import { createHash, timingSafeEqual } from 'crypto';

/** Compara duas chaves via SHA-256 em tempo constante. Falso se qualquer lado estiver vazio. */
export function chaveConfere(recebida: unknown, esperada: string | undefined): boolean {
  if (typeof recebida !== 'string' || recebida.length === 0 || !esperada) return false;
  const a = createHash('sha256').update(recebida, 'utf8').digest();
  const b = createHash('sha256').update(esperada, 'utf8').digest();
  return timingSafeEqual(a, b);
}
