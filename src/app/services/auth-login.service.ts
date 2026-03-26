import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { environment } from '../../environments/environment';

import type { AuthUser } from './auth-session.service';

type LoginSession = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type LoginApiResponse = {
  success: boolean;
  message?: string;
  session?: LoginSession;
  user?: AuthUser;
};

/** Endpoint real da API (sempre este host no upstream). */
const LOGIN_URL_ABSOLUTE =
  'https://www.gestor.admspot.com.br/api/central/v1/auth/login';

/** Sessão PHP se o endpoint ainda exigir (mesmo valor que no proxy de dev). */
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

/** Inclui `www.localhost`, vhosts XAMPP, etc. */
function isLocalDevBrowserHost(hostname: string): boolean {
  if (!hostname) {
    return false;
  }
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Só usar `/api` com proxy do `ng serve` quando a origem é claramente o dev server
 * (porta explícita, não 80/443). XAMPP em `https://www.localhost/` fica em 443/sem porta
 * e não deve enviar POST para o Apache.
 */
function isAngularDevServerOrigin(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const { hostname, port } = window.location;
  if (!isLocalDevBrowserHost(hostname)) {
    return false;
  }
  const p = port || '';
  // URL sem porta visível = HTTP/HTTPS default (80/443) → Apache/XAMPP, não `ng serve`.
  if (p === '' || p === '80' || p === '443') {
    return false;
  }
  const n = Number.parseInt(p, 10);
  return Number.isFinite(n) && environment.localDevServerPorts.includes(n);
}

function loginPathRelative(): string {
  return '/api/central/v1/auth/login';
}

function loginUrlForWeb(): string {
  if (isAngularDevServerOrigin()) {
    return loginPathRelative();
  }
  return LOGIN_URL_ABSOLUTE;
}

function parseLoginResponse(raw: unknown): LoginApiResponse | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as LoginApiResponse;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as LoginApiResponse;
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class AuthLoginService {
  async login(user: string, password: string): Promise<{ session: LoginSession; user: AuthUser }> {
    if (Capacitor.isNativePlatform()) {
      return this.loginNative(user, password);
    }
    return this.loginWeb(user, password);
  }

  private async loginNative(
    user: string,
    password: string,
  ): Promise<{ session: LoginSession; user: AuthUser }> {
    const res = await CapacitorHttp.post({
      url: LOGIN_URL_ABSOLUTE,
      headers: {
        'Content-Type': 'application/json',
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { user, password },
    });

    const data = parseLoginResponse(res.data);

    if (!data || data.success !== true) {
      const message =
        data?.message?.trim() || `Falha no login (HTTP ${res.status}).`;
      throw new Error(message);
    }

    if (!data.session?.access_token || !data.user) {
      throw new Error('Resposta incompleta do servidor.');
    }

    return { session: data.session, user: data.user };
  }

  private async loginWeb(
    user: string,
    password: string,
  ): Promise<{ session: LoginSession; user: AuthUser }> {
    const url = loginUrlForWeb();

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user, password }),
    });

    const data = (await res.json().catch(() => null)) as LoginApiResponse | null;

    if (!data || data.success !== true) {
      const message =
        data?.message?.trim() || `Falha no login (HTTP ${res.status}).`;
      throw new Error(message);
    }

    if (!data.session?.access_token || !data.user) {
      throw new Error('Resposta incompleta do servidor.');
    }

    return { session: data.session, user: data.user };
  }
}
