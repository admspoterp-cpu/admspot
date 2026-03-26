import { Injectable } from '@angular/core';

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

const LOGIN_URL = 'https://www.gestor.admspot.com.br/api/central/v1/auth/login';

// Cookie usado conforme o curl do mockup do endpoint.
// Se expirar, troque o valor no código (ideal é externalizar para env/secret manager).
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

@Injectable({ providedIn: 'root' })
export class AuthLoginService {
  async login(user: string, password: string): Promise<{ session: LoginSession; user: AuthUser }> {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `PHPSESSID=${PHPSESSID}`,
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

