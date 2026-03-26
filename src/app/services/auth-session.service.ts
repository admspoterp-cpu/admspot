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
};

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly accessTokenKey = 'admspot_auth_access_token';
  private readonly userKey = 'admspot_auth_user';

  save(accessToken: string, user: AuthUser): void {
    // Em nativo (iOS/Android) localStorage costuma funcionar também via WebView,
    // e evita dependências extras no projeto atual.
    try {
      localStorage.setItem(this.accessTokenKey, accessToken);
      localStorage.setItem(this.userKey, JSON.stringify(user));
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
    } catch {
      // ignore
    }
  }

  // Útil para depuração / debugging.
  getStoredSession(): StoredSession | null {
    const access_token = this.getAccessToken();
    const user = this.getUser();
    if (!access_token || !user) return null;
    return { access_token, user };
  }
}

