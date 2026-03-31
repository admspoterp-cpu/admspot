export type CobrancaStatus = 'pago' | 'atrasado' | 'aguardando' | 'cancelado';

export type CobrancaAmountTone = 'red' | 'blue-xs' | 'blue-sm' | 'muted';

export interface CobrancaRow {
  id: number;
  name: string;
  amount: string;
  amountTone: CobrancaAmountTone;
  dueLabel: string;
  initials: string;
  avatarBg: string;
  status: CobrancaStatus;
  /** Valor em centavos (API). */
  valorCentavos: number;
  /** Início do dia de vencimento (local), ms; `null` se sem data. */
  dueMs: number | null;
  /** Para pesquisa (API `client_email`). */
  clientEmail: string;
  /** Para pesquisa (`boleto_invoice_number`). */
  boletoInvoiceNumber: string;
  /** Para pesquisa (`boleto_nosso_numero`). */
  boletoNossoNumero: string;
}
