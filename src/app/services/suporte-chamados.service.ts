import { Injectable } from '@angular/core';

import { AuthSessionService } from './auth-session.service';

export const SUPORTE_MOTIVOS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'conta', label: 'Problema na conta' },
  { value: 'pagamento', label: 'Não consigo fazer pagamento' },
  { value: 'saldo', label: 'Não estou vendo meu saldo' },
  { value: 'outro', label: 'Outro' },
];

export type ChamadoStatus = 'aguardando' | 'respondido';

export interface SuporteMensagem {
  id: string;
  from: 'user' | 'support';
  text: string;
  anexoNome?: string;
  createdAt: string;
}

export interface SuporteChamado {
  id: string;
  motivoValue: string;
  motivoLabel: string;
  descricao: string;
  anexoNomeAbertura?: string;
  status: ChamadoStatus;
  createdAt: string;
  messages: SuporteMensagem[];
}

const STORAGE_PREFIX = 'admspot_suporte_chamados_';

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

@Injectable({ providedIn: 'root' })
export class SuporteChamadosService {
  constructor(private readonly authSession: AuthSessionService) {}

  private storageKey(): string {
    const u = this.authSession.getUser();
    const key = (u?.email ?? u?.id ?? 'anon').toString();
    return STORAGE_PREFIX + key.replace(/[^a-zA-Z0-9@._-]/g, '_');
  }

  private readAll(): SuporteChamado[] {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as SuporteChamado[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      const filtered = parsed.filter((c) => !String(c?.id ?? '').startsWith('demo-'));
      if (filtered.length !== parsed.length) {
        this.writeAll(filtered);
      }
      return filtered;
    } catch {
      return [];
    }
  }

  private writeAll(items: SuporteChamado[]): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(items));
    } catch {
      // ignora
    }
  }

  listar(): SuporteChamado[] {
    const items = this.readAll();
    return [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  obterPorId(id: string): SuporteChamado | undefined {
    return this.readAll().find((c) => c.id === id);
  }

  criarChamado(payload: {
    motivoValue: string;
    motivoLabel: string;
    descricao: string;
    anexoNome?: string;
  }): SuporteChamado {
    const items = this.readAll();
    const id = genId();
    const createdAt = nowIso();
    const userMsg: SuporteMensagem = {
      id: genId(),
      from: 'user',
      text: payload.descricao.trim(),
      anexoNome: payload.anexoNome,
      createdAt,
    };
    const chamado: SuporteChamado = {
      id,
      motivoValue: payload.motivoValue,
      motivoLabel: payload.motivoLabel,
      descricao: payload.descricao.trim(),
      anexoNomeAbertura: payload.anexoNome,
      status: 'aguardando',
      createdAt,
      messages: [userMsg],
    };
    items.push(chamado);
    this.writeAll(items);
    return chamado;
  }

  adicionarRespostaUsuario(chamadoId: string, texto: string, anexoNome?: string): SuporteChamado | null {
    const items = this.readAll();
    const idx = items.findIndex((c) => c.id === chamadoId);
    if (idx < 0) {
      return null;
    }
    const c = items[idx];
    const msg: SuporteMensagem = {
      id: genId(),
      from: 'user',
      text: texto.trim(),
      anexoNome,
      createdAt: nowIso(),
    };
    c.messages = [...c.messages, msg];
    items[idx] = c;
    this.writeAll(items);
    return c;
  }

  /** Reservado para integração futura com API de suporte. */
  aplicarRespostaSuporte(chamadoId: string, texto: string): SuporteChamado | null {
    const items = this.readAll();
    const idx = items.findIndex((c) => c.id === chamadoId);
    if (idx < 0) {
      return null;
    }
    const c = items[idx];
    const msg: SuporteMensagem = {
      id: genId(),
      from: 'support',
      text: texto.trim(),
      createdAt: nowIso(),
    };
    c.messages = [...c.messages, msg];
    c.status = 'respondido';
    items[idx] = c;
    this.writeAll(items);
    return c;
  }
}
