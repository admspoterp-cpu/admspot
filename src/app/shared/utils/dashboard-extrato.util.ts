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
  /** Dígitos do documento do beneficiário (para filtro), quando a API enviar */
  documentDigits?: string;
  /** Exibição mascarada na lista */
  documentMasked?: string;
  /** Rótulo curto (pix, boleto, Recarga, …) */
  kindTag: string;
  /** Data local da operação (filtro por período) */
  dateIso: string;
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

/**
 * Valor monetário em reais (API `amount`, `valor`, `value`) → centavos absolutos.
 */
function parseReaisFieldToCents(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return null;
    }
    return Math.round(raw * 100);
  }
  const s = String(raw).trim();
  if (s === '') {
    return null;
  }
  const normalized = s.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(n * 100);
}

function extratoAmountFieldRaw(op: ExtratoOperacaoRaw): unknown {
  const typed = [op.amount, op.valor, op.value];
  for (const c of typed) {
    if (c !== undefined && c !== null && String(c).trim() !== '') {
      return c;
    }
  }
  const rec = op as Record<string, unknown>;
  for (const key of ['amount', 'Amount', 'AMOUNT', 'valor', 'Valor', 'value', 'Value']) {
    const v = rec[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return v;
    }
  }
  return undefined;
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

  const moneyField = extratoAmountFieldRaw(op);
  if (moneyField !== undefined) {
    const cents = parseReaisFieldToCents(moneyField);
    if (cents !== null) {
      return Math.abs(cents);
    }
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
  return 'Recarga';
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

function pickDocumentRaw(op: ExtratoOperacaoRaw): string {
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
      return c.trim();
    }
  }
  return '';
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Máscara simples para lista (CPF 11 / CNPJ 14 dígitos). */
export function maskBrazilDocumentForList(digits: string): string {
  const d = digitsOnly(digits);
  if (d.length === 0) {
    return '';
  }
  if (d.length === 11) {
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  }
  if (d.length >= 14) {
    const c = d.slice(0, 14);
    return `**.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-**`;
  }
  return `***${d.slice(-4)}`;
}

function kindTagFromOperacao(op: ExtratoOperacaoRaw): string {
  const tipo = String(op.tipo_registro ?? '').trim();
  if (tipo === 'app_boleto_barcode_payout') {
    return 'boleto';
  }
  if (tipo === 'app_real_transfer') {
    const t = String(op.trasnfer_operationType ?? '').toUpperCase().trim();
    if (t === 'PIX') {
      return 'pix';
    }
    return 'transferência';
  }
  if (isCreditOperation(op)) {
    return 'crédito';
  }
  return 'Recarga';
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
  const docRaw = pickDocumentRaw(op);
  const docDigits = digitsOnly(docRaw);
  const docMasked = docDigits.length > 0 ? maskBrazilDocumentForList(docDigits) : '';
  const y = when.getFullYear();
  const mo = String(when.getMonth() + 1).padStart(2, '0');
  const da = String(when.getDate()).padStart(2, '0');
  const dateIso = `${y}-${mo}-${da}`;
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
    documentDigits: docDigits.length > 0 ? docDigits : undefined,
    documentMasked: docMasked || undefined,
    kindTag: kindTagFromOperacao(op),
    dateIso,
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

export type ExtratoDayGroup = {
  dayStart: Date;
  title: string;
  rows: DashboardExtratoRow[];
};

/** Agrupa todas as operações por dia civil (mais recentes primeiro). */
export function buildExtratoGroupsAllDays(operacoes: ExtratoOperacaoRaw[]): ExtratoDayGroup[] {
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

  const groups: ExtratoDayGroup[] = [];
  let currentKey: string | null = null;
  let currentRows: DashboardExtratoRow[] = [];
  let currentDay: Date | null = null;

  const flush = (): void => {
    if (currentDay && currentRows.length > 0) {
      let title: string;
      if (sameLocalDay(currentDay, now)) {
        title = 'HOJE';
      } else if (sameLocalDay(currentDay, yesterdayStart)) {
        title = 'ONTEM';
      } else {
        title = formatExtratoPastDayTitle(currentDay);
      }
      groups.push({
        dayStart: currentDay,
        title,
        rows: [...currentRows],
      });
    }
    currentRows = [];
  };

  for (const { op, at } of withParsed) {
    const dayStart = startOfLocalDay(at);
    const key = `${dayStart.getFullYear()}-${dayStart.getMonth()}-${dayStart.getDate()}`;
    if (key !== currentKey) {
      flush();
      currentKey = key;
      currentDay = dayStart;
    }
    const row = mapOperacaoToDashboardRow(op);
    if (row) {
      currentRows.push(row);
    }
  }
  flush();

  return groups;
}
