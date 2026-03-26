import { Injectable } from '@angular/core';

export type AuthUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  level: number;
};

type StoredSession = {
  access_token: string;
  user: AuthUser;
  /** Expiração absoluta do token (ms desde epoch), alinhada a `expires_in` ou ao `exp` do JWT. */
  expires_at_ms?: number;
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
  private readonly accessTokenKey = 'admspot_auth_access_token';
  private readonly userKey = 'admspot_auth_user';
  private readonly tokenExpiresAtKey = 'admspot_auth_token_expires_at_ms';

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

  clear(): void {
    try {
      localStorage.removeItem(this.accessTokenKey);
      localStorage.removeItem(this.userKey);
      localStorage.removeItem(this.tokenExpiresAtKey);
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
    return { access_token, user, expires_at_ms };
  }
}

