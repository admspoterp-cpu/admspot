import type { CentralClient } from '../../services/clients-list.service';

import type { ClienteRow, ClienteStatusKind } from './clientes.types';

const AVATAR_COLORS = ['#588cc0', '#e21001', '#291a5e', '#162d4c', '#68ac48', '#235697', '#291a5e'];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** CPF ~11 dígitos = PF; CNPJ 14 = PJ. Sem documento trata como PF na aba. */
export function isPessoaFisicaDocument(document: string | null | undefined): boolean {
  const n = digitsOnly(document ?? '');
  if (n.length === 0) {
    return true;
  }
  return n.length !== 14;
}

function initialsFromName(first: string, last: string): string {
  const a = first.trim();
  const b = last.trim();
  if (!a && !b) {
    return '?';
  }
  if (!b) {
    return a.slice(0, 2).toUpperCase();
  }
  return (a[0] + b[0]).toUpperCase();
}

function formatDocumentDisplay(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  return t.length > 0 ? t : '—';
}

function cityStateLine(city: string | null | undefined, state: string | null | undefined): string {
  const c = (city ?? '').trim();
  const s = (state ?? '').trim();
  if (c && s) {
    return `${c} / ${s}`;
  }
  return c || s || '—';
}

function statusLabelAndKind(raw: string | null | undefined): { label: string; kind: ClienteStatusKind } {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'active') {
    return { label: 'ativo', kind: 'active' };
  }
  if (s === 'inactive' || s === 'inativo') {
    return { label: 'inativo', kind: 'inactive' };
  }
  if (!s) {
    return { label: '—', kind: 'other' };
  }
  return { label: s, kind: 'other' };
}

function parseCreatedAtMs(raw: string | null | undefined): number | null {
  if (!raw?.trim()) {
    return null;
  }
  const normalized = raw.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function startOfLocalDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function mapCentralClientToRow(c: CentralClient): ClienteRow {
  const name = (c.name ?? '').trim();
  const last = (c.last_name ?? '').trim();
  const fullName = [name, last].filter(Boolean).join(' ') || 'Cliente';
  const doc = formatDocumentDisplay(c.document);
  const { label, kind } = statusLabelAndKind(c.status);
  const createdAtMs = parseCreatedAtMs(c.created_at);
  const stateNorm = (c.state ?? '').trim().toUpperCase();

  const searchBlob = [c.name, c.last_name, c.document, c.email, c.whatsapp]
    .map((x) => (x ?? '').trim())
    .join(' ')
    .toLowerCase();

  return {
    id: c.id,
    fullName,
    documentDisplay: doc,
    cityState: cityStateLine(c.city, c.state),
    statusLabel: label,
    statusKind: kind,
    initials: initialsFromName(name, last),
    avatarBg: AVATAR_COLORS[Math.abs(c.id) % AVATAR_COLORS.length],
    isPessoaFisica: isPessoaFisicaDocument(c.document),
    createdAtMs,
    stateNorm,
    searchBlob,
  };
}

export function rowMatchesClienteSearch(row: ClienteRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => row.searchBlob.includes(t));
}

export function rowMatchesCreatedDateRange(
  createdAtMs: number | null,
  startIso: string | null,
  endIso: string | null,
): boolean {
  if (!startIso?.trim() && !endIso?.trim()) {
    return true;
  }
  if (createdAtMs == null) {
    return false;
  }
  const dayMs = startOfLocalDayMs(new Date(createdAtMs));
  const startMs = startIso?.trim()
    ? new Date(
        Number(startIso.slice(0, 4)),
        Number(startIso.slice(5, 7)) - 1,
        Number(startIso.slice(8, 10)),
      ).getTime()
    : null;
  const endMs = endIso?.trim()
    ? new Date(
        Number(endIso.slice(0, 4)),
        Number(endIso.slice(5, 7)) - 1,
        Number(endIso.slice(8, 10)),
      ).getTime()
    : null;
  if (startMs != null && dayMs < startMs) {
    return false;
  }
  if (endMs != null && dayMs > endMs) {
    return false;
  }
  return true;
}
