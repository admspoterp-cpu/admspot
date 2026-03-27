/** Formata valor monetário em pt-BR (ex.: `1.234,56`), sem símbolo R$. */
export function formatBrlNumber(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Normaliza `balance` da API (float) para 2 casas antes de exibir. */
export function normalizeMoneyValue(raw: number | undefined): number {
  if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) {
    return 0;
  }
  return Math.round(Number(raw) * 100) / 100;
}
