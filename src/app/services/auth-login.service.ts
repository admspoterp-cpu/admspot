import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

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

/**
 * URL usada no `fetch`.
 *
 * - **localhost (`ng serve`)**: caminho relativo `/api/...` — o browser só fala com o dev server;
 *   o **proxy** (`proxy.conf.json`) reencaminha para `LOGIN_URL_ABSOLUTE` (mesmo path em HTTPS).
 *   Não é outro servidor; evita CORS no browser.
 * - **Capacitor nativo / outro host**: `LOGIN_URL_ABSOLUTE` direto.
 */
function loginUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return LOGIN_URL_ABSOLUTE;
  }
  const h = typeof window !== 'undefined' ? window.location.hostname : '';
  if (h === 'localhost' || h === '127.0.0.1') {
    return '/api/central/v1/auth/login';
  }
  return LOGIN_URL_ABSOLUTE;
}

@Injectable({ providedIn: 'root' })
export class AuthLoginService {
  async login(user: string, password: string): Promise<{ session: LoginSession; user: AuthUser }> {
    const res = await fetch(loginUrl(), {
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

