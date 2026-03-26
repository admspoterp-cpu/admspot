import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

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

const LOGIN_PATH = '/api/central/v1/auth/login';

/** Sessão PHP se o endpoint ainda exigir (mesmo valor que no proxy de dev). */
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

function loginUrlForWeb(): string {
  return getGestorApiUrl(LOGIN_PATH);
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
    const url = getGestorApiUrl(LOGIN_PATH);
    const res = await CapacitorHttp.post({
      url,
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
      cache: 'no-store',
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
