import type { CobrancaAmountTone } from '../cobrancas/cobrancas.types';

/** Situação para abas (espelho da tela Cobranças). */
export type PagamentoContaStatus = 'pago' | 'atrasado' | 'aguardando' | 'falhou';

export interface PagamentoContaRow {
  id: number;
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
  searchBlob: string;
}
