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

/**
 * Valor em reais vindo da API (ex.: `"100000"`, `"1500.5"`, `100000`) → string de exibição BRL (`formatBrlFromCents`).
 * Remove separadores de milhar com ponto antes de interpretar como número.
 */
export function apiReaisStringToBrlDisplay(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) {
    return BRL_ZERO_DISPLAY;
  }
  const s = String(raw).trim();
  if (!s) {
    return BRL_ZERO_DISPLAY;
  }
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) {
    return BRL_ZERO_DISPLAY;
  }
  return formatBrlFromCents(Math.round(n * 100));
}

/** Valor do campo com máscara BRL → string para a API (reais, com até 2 decimais). */
export function brlDisplayToApiReaisString(display: string): string {
  const reais = brlStringToCents(display) / 100;
  if (!Number.isFinite(reais)) {
    return '0';
  }
  return Number.isInteger(reais) ? String(reais) : reais.toFixed(2);
}
