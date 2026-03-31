import type { BoletoListItem, BoletoListSummary } from '../../services/charges-boletos-list.service';
import { formatBrlNumber } from '../../utils/brl-format';

import type { CobrancaAmountTone, CobrancaRow, CobrancaStatus } from './cobrancas.types';

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

function parseDueDate(raw: string | undefined): Date | null {
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

/** `valor` da API em centavos. */
function formatAmountBrlFromCentavos(centavos: number): string {
  const reais = centavos / 100;
  return `R$${formatBrlNumber(reais)}`;
}

function parseSummaryMoney(s: string | undefined, centavos?: number): number {
  if (typeof centavos === 'number' && Number.isFinite(centavos)) {
    return centavos / 100;
  }
  if (!s?.trim()) {
    return 0;
  }
  const n = parseFloat(String(s).trim());
  return Number.isFinite(n) ? n : 0;
}

export function formatSummaryLine(summary: BoletoListSummary | undefined): {
  recebimento: string;
  aguardando: string;
  atrasados: string;
} {
  if (!summary) {
    return {
      recebimento: 'R$—',
      aguardando: 'R$—',
      atrasados: 'R$—',
    };
  }

  const recebido = parseSummaryMoney(summary.valor_recebido, summary.valor_recebido_centavos);
  const atrasadosVal = parseSummaryMoney(
    summary.valor_vencidos_atrasados,
    summary.valor_vencidos_atrasados_centavos,
  );
  const aReceber = parseSummaryMoney(summary.valor_a_receber, summary.valor_a_receber_centavos);
  const aguardandoVal = Math.max(0, aReceber - atrasadosVal);

  const fmt = (n: number) => `R$ ${formatBrlNumber(n)}`;

  return {
    recebimento: fmt(recebido),
    aguardando: fmt(aguardandoVal),
    atrasados: fmt(atrasadosVal),
  };
}

export function mapBoletoItemToRow(item: BoletoListItem): CobrancaRow {
  const name = (item.client_name ?? '').trim() || 'Cliente';
  const centavos = typeof item.valor === 'number' && Number.isFinite(item.valor) ? item.valor : 0;
  const amount = formatAmountBrlFromCentavos(centavos);

  const due = parseDueDate(item.dueDate);
  const dueLabel =
    due != null
      ? `vence em ${due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
      : '—';

  const st = (item.boleto_status ?? '').toUpperCase();
  let status: CobrancaStatus;
  let amountTone: CobrancaAmountTone;

  const largeAmount = centavos >= 1_000_000;

  if (st === 'PAGO') {
    status = 'pago';
    amountTone = largeAmount ? 'blue-sm' : 'blue-xs';
  } else if (st === 'CANCELADO') {
    status = 'cancelado';
    amountTone = 'muted';
  } else if (st === 'AGENDADO' || st === '') {
    const overdue = due != null && isDueOverdue(due);
    if (overdue) {
      status = 'atrasado';
      amountTone = 'red';
    } else {
      status = 'aguardando';
      amountTone = largeAmount ? 'blue-sm' : 'blue-xs';
    }
  } else {
    status = 'aguardando';
    amountTone = 'blue-xs';
  }

  const dueMs = due != null ? startOfLocalDay(due).getTime() : null;

  const clientEmail = (item.client_email ?? '').trim();
  const boletoInvoiceNumber = String(item.boleto_invoice_number ?? '').trim();
  const boletoNossoNumero = String(item.boleto_nosso_numero ?? '').trim();

  return {
    id: item.id,
    name,
    amount,
    amountTone,
    dueLabel,
    initials: initialsFromName(name),
    avatarBg: AVATAR_COLORS[Math.abs(item.id) % AVATAR_COLORS.length],
    status,
    valorCentavos: centavos,
    dueMs,
    clientEmail,
    boletoInvoiceNumber,
    boletoNossoNumero,
  };
}

/** Pesquisa em nome, e-mail, fatura e nosso número (case-insensitive; várias palavras = todas devem aparecer). */
export function rowMatchesSearch(row: CobrancaRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const hay = [row.name, row.clientEmail, row.boletoInvoiceNumber, row.boletoNossoNumero]
    .join(' ')
    .toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

/** Compara `dueMs` da linha com intervalo inclusive (datas `YYYY-MM-DD` locais). */
export function rowMatchesDueDateRange(
  row: CobrancaRow,
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

export function computeSummaryFromRows(rows: CobrancaRow[]): {
  recebimento: string;
  aguardando: string;
  atrasados: string;
} {
  let recebimento = 0;
  let aguardando = 0;
  let atrasados = 0;
  for (const r of rows) {
    if (r.status === 'pago') {
      recebimento += r.valorCentavos;
    } else if (r.status === 'aguardando') {
      aguardando += r.valorCentavos;
    } else if (r.status === 'atrasado') {
      atrasados += r.valorCentavos;
    }
  }
  const fmt = (c: number) => `R$ ${formatBrlNumber(c / 100)}`;
  return {
    recebimento: fmt(recebimento),
    aguardando: fmt(aguardando),
    atrasados: fmt(atrasados),
  };
}
