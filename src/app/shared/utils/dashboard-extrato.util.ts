import type { ExtratoOperacaoRaw } from '../../services/extrato-geral.service';
import { formatBrlNumber } from '../../utils/brl-format';

const AVATAR_BG = [
  '#235697',
  '#1b4d8c',
  '#0d9488',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#ea580c',
  '#ca8a04',
  '#15803d',
  '#4338ca',
];

export type DashboardExtratoRow = {
  displayName: string;
  initials: string;
  avatarColor: string;
  timeLabel: string;
  /** Ex.: "+ R$ 10,40" ou "- R$ 10,40" */
  amountLine: string;
  isCredit: boolean;
  /** Valor absoluto formatado (pt-BR), para comprovante / detalhe */
  amountDisplay: string;
  beneficiaryBank: string;
  /** Só transferências PIX com `trasnfer_id` abrem detalhe via `/pix/transfers/info` */
  pixTransferId?: string;
};

/** Iniciais (até 2 letras) a partir do nome exibido. */
export function initialsFromDisplayName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarColorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_BG[h % AVATAR_BG.length];
}

function parseDataHoraBrOrCreated(op: ExtratoOperacaoRaw): Date | null {
  const br = (op.data_hora_br ?? '').trim();
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
  const ca = (op.created_at ?? '').trim();
  if (ca) {
    const d = new Date(ca.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Centavos absolutos para exibição. */
function amountCentsFromOperacao(op: ExtratoOperacaoRaw): number {
  const tipo = (op.tipo_registro ?? '').trim();
  if (tipo === 'app_boleto_barcode_payout') {
    const v = String(op.values ?? '0').replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(v);
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.round(n * 100);
  }
  const tv = String(op.trasnfer_value ?? '0').replace(/\s/g, '');
  const n = parseFloat(tv);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n);
}

function isCreditOperation(op: ExtratoOperacaoRaw): boolean {
  const obj = String(op.trasnfer_object ?? '')
    .toUpperCase()
    .trim();
  const typ = String(op.trasnfer_type ?? '')
    .toUpperCase()
    .trim();
  const act = String(op.atividade ?? '')
    .toLowerCase()
    .trim();
  if (obj === 'CREDIT') {
    return true;
  }
  if (typ === 'CREDIT') {
    return true;
  }
  if (act === 'recebimento') {
    return true;
  }
  return false;
}

function displayNameFromOperacao(op: ExtratoOperacaoRaw): string {
  const owner = String(op.trasnfer_bank_ownerName ?? '').trim();
  if (owner) {
    return owner;
  }
  const company = String(op.companyName ?? '').trim();
  if (company) {
    return company;
  }
  return 'Operação';
}

function formatTimeAmPm(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function beneficiaryBankFromOperacao(op: ExtratoOperacaoRaw): string {
  const tipo = String(op.tipo_registro ?? '').trim();
  if (tipo === 'app_boleto_barcode_payout') {
    const b = String(op.banco_recebedor ?? '').trim();
    return b || '—';
  }
  const b = String(op.trasnfer_bank_name ?? '').trim();
  return b || '—';
}

/** Abre detalhe PIX (API `pix/transfers/info` usa este id). */
function pixTransferIdFromOperacao(op: ExtratoOperacaoRaw): string | undefined {
  if (String(op.tipo_registro ?? '').trim() !== 'app_real_transfer') {
    return undefined;
  }
  if (String(op.trasnfer_operationType ?? '').toUpperCase().trim() !== 'PIX') {
    return undefined;
  }
  const id = String(op.trasnfer_id ?? '').trim();
  return id.length > 0 ? id : undefined;
}

export function mapOperacaoToDashboardRow(op: ExtratoOperacaoRaw): DashboardExtratoRow | null {
  const when = parseDataHoraBrOrCreated(op);
  if (!when) {
    return null;
  }
  const name = displayNameFromOperacao(op);
  const cents = amountCentsFromOperacao(op);
  const abs = Math.abs(cents) / 100;
  const brl = formatBrlNumber(abs);
  const credit = isCreditOperation(op);
  const sign = credit ? '+' : '-';
  return {
    displayName: name,
    initials: initialsFromDisplayName(name),
    avatarColor: avatarColorForName(name),
    timeLabel: formatTimeAmPm(when),
    amountLine: `${sign} R$ ${brl}`,
    isCredit: credit,
    amountDisplay: brl,
    beneficiaryBank: beneficiaryBankFromOperacao(op),
    pixTransferId: pixTransferIdFromOperacao(op),
  };
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addLocalDays(base: Date, delta: number): Date {
  const x = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta, 0, 0, 0, 0);
  return x;
}

/** Cabeçalho estilo "TERÇA-FEIRA 23 DE MARÇO". */
export function formatExtratoPastDayTitle(d: Date): string {
  const weekday = d
    .toLocaleDateString('pt-BR', { weekday: 'long' })
    .toUpperCase();
  const day = d.getDate();
  const month = d.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  return `${weekday} ${day} DE ${month}`;
}

export type DashboardExtratoGroups = {
  today: DashboardExtratoRow[];
  previousDayTitle: string;
  previousDay: DashboardExtratoRow[];
};

const MAX_PER_GROUP = 3;

/**
 * Primeiros blocos: HOJE e o dia civil anterior (máx. 3 cada).
 */
export function buildDashboardExtratoGroups(operacoes: ExtratoOperacaoRaw[]): DashboardExtratoGroups {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = addLocalDays(todayStart, -1);

  const withParsed: { op: ExtratoOperacaoRaw; at: Date }[] = [];
  for (const op of operacoes) {
    const at = parseDataHoraBrOrCreated(op);
    if (at) {
      withParsed.push({ op, at });
    }
  }
  withParsed.sort((a, b) => b.at.getTime() - a.at.getTime());

  const todayRows: DashboardExtratoRow[] = [];
  for (const { op, at } of withParsed) {
    if (!sameLocalDay(at, now)) {
      continue;
    }
    const row = mapOperacaoToDashboardRow(op);
    if (row) {
      todayRows.push(row);
    }
    if (todayRows.length >= MAX_PER_GROUP) {
      break;
    }
  }

  const previousRows: DashboardExtratoRow[] = [];
  let previousTitle = '';
  for (const { op, at } of withParsed) {
    if (sameLocalDay(at, now)) {
      continue;
    }
    if (!sameLocalDay(at, yesterdayStart)) {
      continue;
    }
    const row = mapOperacaoToDashboardRow(op);
    if (row) {
      previousRows.push(row);
    }
    if (previousRows.length >= MAX_PER_GROUP) {
      break;
    }
  }
  if (previousRows.length > 0) {
    previousTitle = formatExtratoPastDayTitle(yesterdayStart);
  }

  return {
    today: todayRows,
    previousDayTitle: previousTitle,
    previousDay: previousRows,
  };
}
