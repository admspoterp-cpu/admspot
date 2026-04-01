import type { ExtratoOperacaoRaw } from '../../services/extrato-geral.service';
import type { CobrancaAmountTone } from '../cobrancas/cobrancas.types';

/** Situação para abas (espelho da tela Cobranças). */
export type PagamentoContaStatus = 'pago' | 'atrasado' | 'aguardando' | 'falhou';

export type PagamentoContaRowSource = 'bill' | 'extrato';

/** Meio do pagamento para exibição ao lado do status. */
export type PagamentoContaChannel = 'boleto' | 'pix_qr';

export interface PagamentoContaRow {
  id: number;
  source: PagamentoContaRowSource;
  /** Chave única para lista (extrato + bill). */
  rowKey: string;
  /** Ordenação: mais recente primeiro. */
  sortDateMs: number;
  name: string;
  amount: string;
  amountTone: CobrancaAmountTone;
  dueLabel: string;
  initials: string;
  avatarBg: string;
  status: PagamentoContaStatus;
  /** Texto do chip (Pago, Agendado, Atrasado, Falhou). */
  statusDisplay: string;
  valorReais: number;
  /** Início do dia de vencimento (local), ms; `null` se sem data. */
  dueMs: number | null;
  digitavel: string;
  token: string;
  typeBill: string;
  /** Boleto (código de barras / linha) vs PIX QR (payload). */
  paymentChannel: PagamentoContaChannel;
  searchBlob: string;
  beneficiaryBank: string;
  /** Status bruto da API bill-payment (PAID, …). */
  apiStatus?: string;
  scheduleDateRaw?: string | null;
  paymentDateRaw?: string | null;
  /** Só `source === 'extrato'`: operação original para o comprovante. */
  extratoOp?: ExtratoOperacaoRaw;
}
