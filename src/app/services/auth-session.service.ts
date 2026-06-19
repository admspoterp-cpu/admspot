import { Injectable, inject } from '@angular/core';

import {
  isWalletMarkedDefault,
  type AuthMeResponse,
  type AuthMeUserPayload,
  type WalletItemPayload,
} from './auth-me.model';
import { BiometricAuthService } from './biometric-auth.service';

export type AuthUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  level: number;
  /** Preenchido após `GET /auth/me`. */
  document?: string;
};

type StoredSession = {
  access_token: string;
  user: AuthUser;
  /** Expiração absoluta do token (ms desde epoch), alinhada a `expires_in` ou ao `exp` do JWT. */
  expires_at_ms?: number;
  default_wallet?: WalletItemPayload;
  /** Todas as carteiras do último `GET /auth/me`. */
  wallets?: WalletItemPayload[];
};

/** Extrai `exp` (segundos) do payload do JWT, se existir. */
function jwtExpMsFromAccessToken(accessToken: string): number | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly biometric = inject(BiometricAuthService);

  private readonly accessTokenKey = 'admspot_auth_access_token';
  private readonly userKey = 'admspot_auth_user';
  private readonly tokenExpiresAtKey = 'admspot_auth_token_expires_at_ms';
  private readonly defaultWalletKey = 'admspot_default_wallet';
  /** Lista completa `wallets.items` do último `/auth/me`. */
  private readonly walletsItemsKey = 'admspot_wallets_items';
  /** Primeira carteira quando nenhuma tem `is_default` como padrão (tela “criar conta digital”). */
  private readonly pendingFirstWalletKey = 'admspot_wallet_pending_first';

  /**
   * Persiste `access_token`, objeto `user` e a validade do token.
   * `expiresInSeconds` vem de `session.expires_in` (ex.: 28800); se omitido, usa o `exp` do JWT.
   */
  save(accessToken: string, user: AuthUser, expiresInSeconds?: number): void {
    // Em nativo (iOS/Android) localStorage costuma funcionar também via WebView,
    // e evita dependências extras no projeto atual.
    try {
      localStorage.setItem(this.accessTokenKey, accessToken);
      localStorage.setItem(this.userKey, JSON.stringify(user));

      let expiresAtMs: number | null = null;
      if (typeof expiresInSeconds === 'number' && expiresInSeconds > 0) {
        expiresAtMs = Date.now() + expiresInSeconds * 1000;
      } else {
        expiresAtMs = jwtExpMsFromAccessToken(accessToken);
      }
      if (expiresAtMs != null) {
        localStorage.setItem(this.tokenExpiresAtKey, String(Math.floor(expiresAtMs)));
      } else {
        localStorage.removeItem(this.tokenExpiresAtKey);
      }
    } catch {
      // Se não der para persistir, deixa o app funcionar sem crash.
    }
  }

  getAccessToken(): string | null {
    try {
      return localStorage.getItem(this.accessTokenKey);
    } catch {
      return null;
    }
  }

  getUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.userKey);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  /** Atualiza só o perfil (ex.: após `/auth/me`), sem alterar token nem expiração. */
  updateUserProfile(user: AuthUser): void {
    try {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    } catch {
      // ignore
    }
  }

  private meUserToAuthUser(u: AuthMeUserPayload): AuthUser {
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      level: u.level,
      ...(u.document !== undefined && u.document !== null && String(u.document).length > 0
        ? { document: String(u.document) }
        : {}),
    };
  }

  /**
   * Persiste utilizador e carteiras conforme `/auth/me`.
   * `true` = existe item com `is_default` truthy na API **ou** seleção local ainda válida na lista.
   */
  applyAuthMeResponse(data: AuthMeResponse): { hasDefaultWallet: boolean } {
    const user = this.meUserToAuthUser(data.user);
    this.updateUserProfile(user);

    const items = Array.isArray(data.wallets?.items) ? data.wallets!.items : [];
    const previousDefault = this.getDefaultWallet();
    const defaultItem = items.find((w) => isWalletMarkedDefault(w.is_default)) ?? null;

    try {
      // Resposta sem lista de carteiras (vazia/ausente — body parcial ou hiccup transitório do
      // backend): não destrói uma seleção local já válida. O app é local-first; apagar a carteira
      // padrão aqui faria a próxima abertura cair na tela de seleção vazia mesmo o usuário já tendo
      // escolhido uma carteira. Sem seleção prévia, mantém o comportamento de limpar tudo.
      if (items.length === 0) {
        if (previousDefault) {
          return { hasDefaultWallet: true };
        }
        localStorage.removeItem(this.walletsItemsKey);
        localStorage.removeItem(this.defaultWalletKey);
        localStorage.removeItem(this.pendingFirstWalletKey);
        return { hasDefaultWallet: false };
      }

      localStorage.setItem(this.walletsItemsKey, JSON.stringify(items));

      if (defaultItem) {
        localStorage.setItem(this.defaultWalletKey, JSON.stringify(defaultItem));
        localStorage.removeItem(this.pendingFirstWalletKey);
        return { hasDefaultWallet: true };
      }

      if (previousDefault && items.some((w) => w.id === previousDefault.id)) {
        const merged = items.find((w) => w.id === previousDefault.id)!;
        localStorage.setItem(
          this.defaultWalletKey,
          JSON.stringify({ ...merged, is_default: 1 }),
        );
        localStorage.removeItem(this.pendingFirstWalletKey);
        return { hasDefaultWallet: true };
      }

      localStorage.removeItem(this.defaultWalletKey);
      localStorage.setItem(this.pendingFirstWalletKey, JSON.stringify(items[0]));
    } catch {
      // ignore
    }
    return { hasDefaultWallet: false };
  }

  /**
   * Define a carteira ativa no app (até existir API que grave `is_default` no servidor).
   * Marca `is_default = 1` na escolhida e `0` nas demais na lista local.
   */
  setSelectedWalletAsDefaultLocal(wallet: WalletItemPayload): void {
    try {
      let items = this.getAllWallets();
      if (items.length === 0) {
        items = [{ ...wallet }];
      }
      const updated = items.map((w) =>
        w.id === wallet.id ? { ...w, ...wallet, is_default: 1 } : { ...w, is_default: 0 },
      );
      localStorage.setItem(this.walletsItemsKey, JSON.stringify(updated));
      const chosen = updated.find((w) => w.id === wallet.id) ?? { ...wallet, is_default: 1 };
      localStorage.setItem(this.defaultWalletKey, JSON.stringify(chosen));
      localStorage.removeItem(this.pendingFirstWalletKey);
    } catch {
      // ignore
    }
  }

  getDefaultWallet(): WalletItemPayload | null {
    try {
      const raw = localStorage.getItem(this.defaultWalletKey);
      if (!raw) return null;
      return JSON.parse(raw) as WalletItemPayload;
    } catch {
      return null;
    }
  }

  /**
   * Todas as carteiras do utilizador conforme o último `GET /auth/me` (`wallets.items`).
   * Pode estar vazio se ainda não houve `/auth/me` ou se não houver carteiras.
   */
  getAllWallets(): WalletItemPayload[] {
    try {
      const raw = localStorage.getItem(this.walletsItemsKey);
      if (!raw?.trim()) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed as WalletItemPayload[];
    } catch {
      return [];
    }
  }

  /** Primeira carteira da lista quando não há padrão (para UI “criar conta digital”). */
  getPendingFirstWallet(): WalletItemPayload | null {
    try {
      const raw = localStorage.getItem(this.pendingFirstWalletKey);
      if (!raw) return null;
      return JSON.parse(raw) as WalletItemPayload;
    } catch {
      return null;
    }
  }

  clear(): void {
    // Sessão encerrada (logout/expiração) → libera o login rápido automático para a próxima
    // sessão. Distingue do "bounce" do session-bootstrap, que volta a /login sem chamar clear().
    this.biometric.resetAutoQuickLoginAttempt();
    try {
      localStorage.removeItem(this.accessTokenKey);
      localStorage.removeItem(this.userKey);
      localStorage.removeItem(this.tokenExpiresAtKey);
      localStorage.removeItem(this.defaultWalletKey);
      localStorage.removeItem(this.walletsItemsKey);
      localStorage.removeItem(this.pendingFirstWalletKey);
    } catch {
      // ignore
    }
  }

  /** Momento em que o token deixa de ser válido (ms), ou `null` se não for possível calcular. */
  getTokenExpiresAtMs(): number | null {
    try {
      const raw = localStorage.getItem(this.tokenExpiresAtKey);
      if (raw) {
        const n = Number.parseInt(raw, 10);
        if (Number.isFinite(n)) {
          return n;
        }
      }
    } catch {
      // ignore
    }
    const token = this.getAccessToken();
    return token ? jwtExpMsFromAccessToken(token) : null;
  }

  /** `true` se não há token ou se já passou da validade (com margem de 30s). */
  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return true;
    }
    const expMs = this.getTokenExpiresAtMs();
    if (expMs == null) {
      return false;
    }
    return Date.now() >= expMs - 30_000;
  }

  // Útil para depuração / debugging.
  getStoredSession(): StoredSession | null {
    const access_token = this.getAccessToken();
    const user = this.getUser();
    if (!access_token || !user) return null;
    const expires_at_ms = this.getTokenExpiresAtMs() ?? undefined;
    const default_wallet = this.getDefaultWallet() ?? undefined;
    const wallets = this.getAllWallets();
    return {
      access_token,
      user,
      expires_at_ms,
      default_wallet,
      ...(wallets.length > 0 ? { wallets } : {}),
    };
  }
}

