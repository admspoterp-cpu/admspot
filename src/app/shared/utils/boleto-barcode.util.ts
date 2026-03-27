/**
 * Normalização do número do boleto para envio à API central (`/boleto/barcode`).
 *
 * - **Cobrança (FEBRABAN cobrança)**: linha digitável com **47** dígitos → código de barras **44**.
 * - **Arrecadação (água, luz, tributos, etc.)**: linha digitável com **48** dígitos → código de barras **44**
 *   (remove os 4 dígitos verificadores entre os blocos de 11).
 * - **44** dígitos: já é o código de barras impresso (ITF) → repassa igual.
 *
 * Referência cobrança 47→44: layout FEBRABAN (ex.: guilhermearaujo/boleto.js).
 */

/** Apenas dígitos. */
export function digitsOnly(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/**
 * Cobrança bancária: rearranja a linha digitável (47) no código de barras (44).
 * `^(\d{4})(\d{5})\d(\d{10})\d(\d{10})\d(\d{15})$` → `$1$5$2$3$4`
 */
export function linhaDigitavelCobrancaParaCodigoBarras(d47: string): string | null {
  const d = digitsOnly(d47);
  if (d.length !== 47) {
    return null;
  }
  const m = d.match(/^(\d{4})(\d{5})\d(\d{10})\d(\d{10})\d(\d{15})$/);
  if (!m) {
    return null;
  }
  return `${m[1]}${m[5]}${m[2]}${m[3]}${m[4]}`;
}

/**
 * Arrecadação: linha digitável 48 posições (11+DV+11+DV+11+DV+11+DV) → código 44.
 */
export function linhaDigitavelArrecadacaoParaCodigoBarras(d48: string): string | null {
  const d = digitsOnly(d48);
  if (d.length !== 48) {
    return null;
  }
  return d.substring(0, 11) + d.substring(12, 23) + d.substring(24, 35) + d.substring(36, 47);
}

/**
 * Converte qualquer entrada comum do leitor (44 / 47 / 48 dígitos) para o **código de barras 44**
 * esperado pela API, quando possível.
 */
export function normalizarCodigoBarrasParaApi(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length === 44) {
    return d;
  }
  if (d.length === 48) {
    return linhaDigitavelArrecadacaoParaCodigoBarras(d) ?? d;
  }
  if (d.length === 47) {
    return linhaDigitavelCobrancaParaCodigoBarras(d) ?? d;
  }
  return d;
}
