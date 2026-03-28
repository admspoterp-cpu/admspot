/**
 * Formata o campo de identificação (linha digitável / código numérico) para exibição
 * completa — sem abreviação (mesmo critério da tela de detalhes do boleto).
 */
export function formatBoletoIdentificationDisplay(digitsRaw: string): string {
  const digits = String(digitsRaw ?? '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length === 47) {
    return formatLinhaDigitavelFebraban47(digits);
  }
  const lines: string[] = [];
  const chunk = 11;
  for (let i = 0; i < digits.length; i += chunk) {
    lines.push(digits.slice(i, i + chunk));
  }
  return lines.join('\n');
}

/** Padrão visual próximo à linha digitável bancária (47 dígitos). */
function formatLinhaDigitavelFebraban47(d: string): string {
  if (d.length !== 47) {
    return d;
  }
  const a = `${d.slice(0, 5)}.${d.slice(5, 10)}`;
  const b = `${d.slice(10, 15)}.${d.slice(15, 21)}`;
  const c = `${d.slice(21, 26)}.${d.slice(26, 32)}`;
  const dv = d.slice(32, 33);
  const f = d.slice(33);
  return `${a} ${b}\n${c} ${dv} ${f}`;
}
