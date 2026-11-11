/**
 * Normaliza nome de cliente para comparação: ignora caixa, acentos e espaços
 * repetidos. A comparação continua sendo de igualdade — sem "contém" nem
 * similaridade — para nunca casar com a conta de outro cliente.
 */
export function normalizarNome(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
