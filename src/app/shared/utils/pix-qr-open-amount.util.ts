import type { PixQrDecodeResponse } from '../../services/pix-qr-decode.service';
import { normalizeMoneyValue } from '../../utils/brl-format';

/**
 * QR sem valor fixo na cobrança (valor zero ou ausente) — o usuário informa o valor na tela dedicada.
 * Mesma base numérica de `pix-qr-payment-details` (`totalValue` / `summary.valor`).
 */
export function isPixQrOpenAmountDecode(data: PixQrDecodeResponse | null | undefined): boolean {
  if (!data) {
    return true;
  }
  const summary = data.summary;
  const asaas = data.asaas;
  const total = normalizeMoneyValue(asaas?.totalValue ?? summary?.valor ?? 0);
  return total <= 0;
}
