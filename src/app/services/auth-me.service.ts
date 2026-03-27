import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';
import type { AuthMeResponse } from './auth-me.model';

const AUTH_ME_PATH = '/api/central/v1/auth/me';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

@Injectable({ providedIn: 'root' })
export class AuthMeService {
  async fetchMe(accessToken: string): Promise<AuthMeResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchMeNative(accessToken);
    }
    return this.fetchMeWeb(accessToken);
  }

  private async fetchMeNative(accessToken: string): Promise<AuthMeResponse | null> {
    const url = getGestorApiUrl(AUTH_ME_PATH);
    const res = await CapacitorHttp.get({
      url,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.parseBody(res.data);
  }

  private async fetchMeWeb(accessToken: string): Promise<AuthMeResponse | null> {
    const url = getGestorApiUrl(AUTH_ME_PATH);
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json().catch(() => null)) as AuthMeResponse | null;
  }

  private parseBody(raw: unknown): AuthMeResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as AuthMeResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as AuthMeResponse;
    }
    return null;
  }
}
