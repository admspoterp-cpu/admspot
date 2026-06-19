/** Resposta pública do ViaCEP (sem CORS restrito para GET). */
export type ViaCepJson = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

/**
 * Consulta CEP (8 dígitos). Retorna null se inválido ou não encontrado.
 */
export async function fetchViaCepDigits(cep8: string): Promise<ViaCepJson | null> {
  if (cep8.length !== 8) {
    return null;
  }
  const url = `https://viacep.com.br/ws/${cep8}/json/`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return null;
    }
    const j = (await res.json().catch(() => null)) as ViaCepJson | null;
    if (!j || j.erro === true) {
      return null;
    }
    return j;
  } catch {
    return null;
  }
}
