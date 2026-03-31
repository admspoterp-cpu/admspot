import type { BoletoListItem } from '../../services/charges-boletos-list.service';
import type { ExtratoOperacaoRaw } from '../../services/extrato-geral.service';
import { formatBrlNumber } from '../../utils/brl-format';
import {
  mapOperacaoToDashboardRow,
  type DashboardExtratoRow,
} from './dashboard-extrato.util';

function formatAmountBrlFromCentavos(centavos: number): string {
  const reais = centavos / 100;
  return `R$${formatBrlNumber(reais)}`;
}

function parseDueDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) {
    return null;
  }
  const d = new Date(raw.trim().replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ClienteHistoricoItem =
  | {
      kind: 'cobranca';
      boletoId: number;
      title: string;
      subtitle: string;
      amountLabel: string;
      atMs: number;
    }
  | {
      kind: 'extrato';
      row: DashboardExtratoRow;
      op: ExtratoOperacaoRaw;
      atMs: number;
    };

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function pickDocumentDigitsFromOperacao(op: ExtratoOperacaoRaw): string {
  const candidates = [
    op.trasnfer_bank_ownerCPF,
    op.trasnfer_bank_ownerCnpj,
    op.cpfCnpj,
    op.cpf_cnpj,
    op.documento,
    op.beneficiary_document,
    op.trasnfer_document,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return digitsOnly(c.trim());
    }
  }
  return '';
}

/**
 * Correspondência com cliente: `cus_id`, `client_id`, etc., ou documento (CPF/CNPJ) do beneficiário.
 */
export function extratoOperacaoMatchesClient(
  op: ExtratoOperacaoRaw,
  clientId: number,
  cusId: string | null | undefined,
  customerDocumentDigits: string,
): boolean {
  const rec = op as Record<string, unknown>;
  const idStr = String(clientId);
  const cus = (cusId ?? '').trim();

  const keys = [
    'cus_id',
    'customer_cus_id',
    'asaas_customer_id',
    'client_id',
    'customer_id',
    'cliente_id',
  ];
  for (const k of keys) {
    const v = rec[k];
    if (v === undefined || v === null) {
      continue;
    }
    if (typeof v === 'number' && Number.isFinite(v) && v === clientId) {
      return true;
    }
    const s = String(v).trim();
    if (s === idStr) {
      return true;
    }
    if (cus && s === cus) {
      return true;
    }
  }

  if (customerDocumentDigits.length >= 11) {
    const docOp = pickDocumentDigitsFromOperacao(op);
    if (docOp && docOp === customerDocumentDigits) {
      return true;
    }
  }
  return false;
}

function parseOperacaoWhenMs(op: ExtratoOperacaoRaw): number | null {
  const br = (op.data_hora_br ?? '').trim();
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const hh = parseInt(m[4], 10);
    const mm = parseInt(m[5], 10);
    const d = new Date(year, month, day, hh, mm, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const ca = (op.created_at ?? '').trim();
  if (ca) {
    const d = new Date(ca.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function parseBoletoWhenMs(b: BoletoListItem): number {
  const raw = b.dueDate;
  if (raw?.trim()) {
    const d = new Date(raw.trim().replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) {
      return d.getTime();
    }
  }
  return Date.now();
}

export function buildClienteHistoricoItems(
  operacoes: ExtratoOperacaoRaw[] | undefined,
  boletos: BoletoListItem[] | undefined,
  clientId: number,
  cusId: string | null | undefined,
  customerDocumentDigits: string,
): ClienteHistoricoItem[] {
  const items: ClienteHistoricoItem[] = [];

  for (const op of operacoes ?? []) {
    if (!extratoOperacaoMatchesClient(op, clientId, cusId, customerDocumentDigits)) {
      continue;
    }
    const row = mapOperacaoToDashboardRow(op);
    if (!row) {
      continue;
    }
    const atMs = parseOperacaoWhenMs(op);
    if (atMs == null) {
      continue;
    }
    items.push({ kind: 'extrato', row, op, atMs });
  }

  for (const b of boletos ?? []) {
    if (typeof b.client_id !== 'number' || b.client_id !== clientId) {
      continue;
    }
    const name = (b.client_name ?? '').trim() || 'Cliente';
    const centavos = typeof b.valor === 'number' && Number.isFinite(b.valor) ? b.valor : 0;
    const amountLabel = formatAmountBrlFromCentavos(centavos);
    const due = parseDueDate(b.dueDate);
    const dueLabel =
      due != null
        ? `vence em ${due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        : '—';
    const inv = (b.boleto_invoice_number ?? '').trim();
    const title = inv ? `Cobrança ${inv}` : `Cobrança #${b.id}`;
    const atMs = parseBoletoWhenMs(b);
    items.push({
      kind: 'cobranca',
      boletoId: b.id,
      title,
      subtitle: `${name} · ${dueLabel}`,
      amountLabel,
      atMs,
    });
  }

  items.sort((a, b) => b.atMs - a.atMs);
  return items;
}
