/**
 * Normaliza nome de cliente para comparação: ignora caixa, acentos, espaços e
 * pontuação, mantendo só letras e números ("EFF Science" = "effscience").
 * A comparação continua sendo de igualdade — sem "contém" nem similaridade —
 * para nunca casar com a conta de outro cliente.
 */
export function normalizarNome(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD') // separa letra e acento; o acento cai no filtro abaixo
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
