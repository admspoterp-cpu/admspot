import type { BillPaymentListItem } from '../../services/bill-payments-list.service';
import { formatBrlNumber } from '../../utils/brl-format';

import type { PagamentoContaRow, PagamentoContaStatus } from './pagamento-contas.types';
import type { CobrancaAmountTone } from '../cobrancas/cobrancas.types';

const AVATAR_COLORS = ['#588cc0', '#e21001', '#291a5e', '#162d4c', '#68ac48', '#235697', '#291a5e'];

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDueDate(raw: string | undefined | null): Date | null {
  if (!raw?.trim()) {
    return null;
  }
  const normalized = raw.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDueOverdue(due: Date): boolean {
  const dueDay = startOfLocalDay(due);
  const today = startOfLocalDay(new Date());
  return dueDay < today;
}

function parseValueReais(raw: string | undefined | null): number {
  if (!raw?.trim()) {
    return 0;
  }
  const n = parseFloat(String(raw).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function mapStatusAndDisplay(
  apiStatus: string,
  due: Date | null,
): { status: PagamentoContaStatus; display: string; tone: CobrancaAmountTone } {
  const st = apiStatus.toUpperCase();

  if (st === 'PAID') {
    return {
      status: 'pago',
      display: 'Pago',
      tone: 'blue-xs',
    };
  }
  if (st === 'FAILED') {
    return { status: 'falhou', display: 'Falhou', tone: 'muted' };
  }
  if (st === 'PENDING') {
    const overdue = due != null && isDueOverdue(due);
    if (overdue) {
      return { status: 'atrasado', display: 'Atrasado', tone: 'red' };
    }
    return {
      status: 'aguardando',
      display: 'Agendado',
      tone: 'blue-xs',
    };
  }
  return { status: 'aguardando', display: 'Agendado', tone: 'blue-xs' };
}

export function mapBillPaymentItemToRow(item: BillPaymentListItem): PagamentoContaRow {
  const name = (item.companyName ?? '').trim() || 'Pagamento';
  const reais = parseValueReais(item.value);
  const amount =
    item.value_brl?.trim() ||
    (reais > 0 ? `R$ ${formatBrlNumber(reais)}` : 'R$ 0,00');

  const due = parseDueDate(item.dueDate ?? undefined);
  const dueLabel =
    due != null
      ? `vence em ${due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
      : '—';

  const apiSt = (item.status ?? '').trim() || 'PENDING';
  const mapped = mapStatusAndDisplay(apiSt, due);
  const label = (item.status_label ?? '').trim();
  const statusDisplay = label.length > 0 ? label : mapped.display;

  const dueMs = due != null ? startOfLocalDay(due).getTime() : null;

  const digitavel = String(item.digitavel ?? '').trim();
  const token = String(item.token ?? '').trim();
  const typeBill = String(item.type_bill ?? '').trim();
  const desc = String(item.description ?? '').trim();
  const billId = String(item.bill_id ?? '').trim();
  const boletoId = String(item.boleto_id ?? '').trim();

  const searchBlob = [name, digitavel, token, desc, billId, boletoId, typeBill].join(' ').toLowerCase();

  return {
    id: item.id,
    name,
    amount,
    amountTone: mapped.tone,
    dueLabel,
    initials: initialsFromName(name),
    avatarBg: AVATAR_COLORS[Math.abs(item.id) % AVATAR_COLORS.length],
    status: mapped.status,
    statusDisplay,
    valorReais: reais,
    dueMs,
    digitavel,
    token,
    typeBill,
    searchBlob,
  };
}

export function rowMatchesSearch(row: PagamentoContaRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => row.searchBlob.includes(t));
}

export function rowMatchesDueDateRange(
  row: PagamentoContaRow,
  startIso: string | null,
  endIso: string | null,
): boolean {
  if (!startIso?.trim() && !endIso?.trim()) {
    return true;
  }
  if (row.dueMs == null) {
    return false;
  }
  const startMs = startIso?.trim() ? parseLocalYmdToMs(startIso.trim()) : null;
  const endMs = endIso?.trim() ? parseLocalYmdToMs(endIso.trim()) : null;
  if (startMs != null && row.dueMs < startMs) {
    return false;
  }
  if (endMs != null && row.dueMs > endMs) {
    return false;
  }
  return true;
}

function parseLocalYmdToMs(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(y, mo - 1, d).getTime();
}
