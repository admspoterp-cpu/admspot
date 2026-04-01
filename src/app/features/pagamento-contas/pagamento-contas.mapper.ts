import type { BillPaymentListItem } from '../../services/bill-payments-list.service';
import type { ExtratoOperacaoRaw } from '../../services/extrato-geral.service';
import { mapOperacaoToDashboardRow } from '../../shared/utils/dashboard-extrato.util';
import { formatBrlNumber } from '../../utils/brl-format';

import type {
  PagamentoContaChannel,
  PagamentoContaRow,
  PagamentoContaStatus,
} from './pagamento-contas.types';
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

function paymentChannelFromBillItem(item: BillPaymentListItem): PagamentoContaChannel {
  const t = String(item.type_bill ?? '').trim().toLowerCase();
  if (t === 'qrcode' || t.includes('qr')) {
    return 'pix_qr';
  }
  return 'boleto';
}

function paymentChannelFromExtratoOp(op: ExtratoOperacaoRaw): PagamentoContaChannel {
  const tipo = String(op.tipo_registro ?? '').trim();
  if (tipo === 'app_boleto_barcode_payout') {
    return 'boleto';
  }
  const digits = String(op.digitavel ?? '').replace(/\D/g, '');
  if (digits.length >= 44) {
    return 'boleto';
  }
  return 'pix_qr';
}

function billSortDateMs(item: BillPaymentListItem): number {
  for (const raw of [item.paymentDate, item.scheduleDate, item.dueDate]) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (s) {
      const t = new Date(s.replace(' ', 'T')).getTime();
      if (Number.isFinite(t)) {
        return t;
      }
    }
  }
  return 0;
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
  const bank = String(item.banco_recebedor ?? '').trim();

  const paymentChannel = paymentChannelFromBillItem(item);

  const searchBlob = [name, digitavel, token, desc, billId, boletoId, typeBill, bank]
    .join(' ')
    .toLowerCase();

  return {
    id: item.id,
    source: 'bill',
    rowKey: `bill-${item.id}`,
    sortDateMs: billSortDateMs(item),
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
    paymentChannel,
    searchBlob,
    beneficiaryBank: bank || '—',
    apiStatus: apiSt,
    scheduleDateRaw: item.scheduleDate ?? null,
    paymentDateRaw: item.paymentDate ?? null,
  };
}

function parseBrlDisplayToReais(amountDisplay: string): number {
  const t = amountDisplay.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Itens do extrato: descrição Pagamento e débito. */
export function isExtratoPagamentoDebit(op: ExtratoOperacaoRaw): boolean {
  const desc = String(op.trasnfer_description ?? '').trim();
  const typ = String(op.trasnfer_type ?? '')
    .trim()
    .toUpperCase();
  return desc === 'Pagamento' && typ === 'DEBIT';
}

export function mapExtratoPagamentoDebitToRow(
  op: ExtratoOperacaoRaw,
  index: number,
): PagamentoContaRow | null {
  const dash = mapOperacaoToDashboardRow(op);
  if (!dash) {
    return null;
  }

  const name = dash.displayName;
  const reais = parseBrlDisplayToReais(dash.amountDisplay);
  const amount = reais > 0 ? `R$ ${formatBrlNumber(reais)}` : 'R$ 0,00';

  const dueMs = parseLocalYmdToMs(dash.dateIso);
  const dueLabel =
    dueMs != null
      ? `em ${new Date(dueMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
      : '—';

  const tid = String(op.trasnfer_id ?? '').trim();
  const rowKey = `extrato-${tid || 'x'}-${dash.dateIso}-${index}`;

  const whenMs =
    parseDataHoraBrOrCreated(op)?.getTime() ?? (dueMs != null ? dueMs : Date.now());

  const digitavel = String(op.digitavel ?? '').trim();
  const paymentChannel = paymentChannelFromExtratoOp(op);

  const searchBlob = [name, digitavel, tid, String(op.boleto_id ?? ''), String(op.bill_id ?? '')]
    .join(' ')
    .toLowerCase();

  return {
    id: index,
    source: 'extrato',
    rowKey,
    sortDateMs: whenMs,
    name,
    amount,
    amountTone: 'blue-xs',
    dueLabel,
    initials: dash.initials,
    avatarBg: dash.avatarColor,
    status: 'pago',
    statusDisplay: 'Pago',
    valorReais: reais,
    dueMs,
    digitavel,
    token: '',
    typeBill: String(op.tipo_registro ?? '').trim(),
    paymentChannel,
    searchBlob,
    beneficiaryBank: dash.beneficiaryBank,
    extratoOp: op,
  };
}

function parseDataHoraBrOrCreated(op: ExtratoOperacaoRaw): Date | null {
  const br = String(op.data_hora_br ?? '').trim();
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const hh = parseInt(m[4], 10);
    const mm = parseInt(m[5], 10);
    const d = new Date(year, month, day, hh, mm, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ca = String(op.created_at ?? '').trim();
  if (ca) {
    const d = new Date(ca.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
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
