/** Apenas dígitos (para envio à API). */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** CPF `999.999.999-99` ou CNPJ `99.999.999/9999-99` conforme quantidade de dígitos (máx. 14). */
export function formatCpfCnpjMask(raw: string): string {
  const d = digitsOnly(raw).slice(0, 14);
  if (d.length === 0) {
    return '';
  }
  if (d.length <= 11) {
    if (d.length <= 3) {
      return d;
    }
    if (d.length <= 6) {
      return `${d.slice(0, 3)}.${d.slice(3)}`;
    }
    if (d.length <= 9) {
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    }
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  const p = d;
  if (p.length <= 2) {
    return p;
  }
  if (p.length <= 5) {
    return `${p.slice(0, 2)}.${p.slice(2)}`;
  }
  if (p.length <= 8) {
    return `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5)}`;
  }
  if (p.length <= 12) {
    return `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5, 8)}/${p.slice(8)}`;
  }
  return `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5, 8)}/${p.slice(8, 12)}-${p.slice(12)}`;
}

/** CEP `99999-999` (8 dígitos). */
export function formatCepMask(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 5) {
    return d;
  }
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Celular BR: 10 dígitos `(XX) XXXX-XXXX` ou 11 `(XX) XXXXX-XXXX`.
 * Envio: apenas dígitos (DDD + número).
 */
export function formatWhatsappBrMask(raw: string): string {
  const d = digitsOnly(raw).slice(0, 11);
  if (d.length === 0) {
    return '';
  }
  if (d.length <= 2) {
    return `(${d}`;
  }
  if (d.length <= 6) {
    return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  }
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function isValidDocumentDigits(d: string): boolean {
  const n = d.length;
  return n === 11 || n === 14;
}

export function isValidCepDigits(d: string): boolean {
  return d.length === 8;
}
