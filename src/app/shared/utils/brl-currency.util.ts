/** Limite de dígitos (centavos) para evitar overflow de inteiro. */
const MAX_DIGITS = 14;

const intlBrl = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Valor em centavos (inteiro) → string BRL (ex.: 10050 → "100,50"; 100500 → "1.005,00").
 */
export function formatBrlFromCents(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.min(cents, Number.MAX_SAFE_INTEGER)) : 0;
  return intlBrl.format(safe / 100);
}

/**
 * Extrai apenas dígitos e interpreta como centavos (últimos 2 = decimais).
 */
export function digitsOnlyToCents(digits: string): number {
  const d = digits.replace(/\D/g, '').slice(0, MAX_DIGITS);
  if (!d) {
    return 0;
  }
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Qualquer string já formatada ou parcial → centavos (mesma regra: só dígitos = centavos).
 */
export function brlStringToCents(value: string | null | undefined): number {
  return digitsOnlyToCents(String(value ?? ''));
}

/** Valor inicial exibido nos campos monetários. */
export const BRL_ZERO_DISPLAY = '0,00';
