import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const CHECK_UPDATE_PATH = '/api/central/v1/check-update/client-version';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type CheckUpdateResponse = {
  success: boolean;
  wallet_id?: number;
  client_version?: string;
  policy_defined?: boolean;
  /** `atualizado` = pode seguir; `precisa_atualizar` = bloquear e mostrar loja. */
  status?: string;
  atualizado?: boolean;
  /** Versão disponível na loja (título do alerta). */
  version?: string;
  message?: string;
  link_play_store?: string;
  link_apple_store?: string;
};

@Injectable({ providedIn: 'root' })
export class CheckUpdateService {
  async checkClientVersion(
    accessToken: string,
    currentVersion: string,
  ): Promise<CheckUpdateResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, currentVersion);
    }
    return this.postWeb(accessToken, currentVersion);
  }

  private async postNative(
    accessToken: string,
    currentVersion: string,
  ): Promise<CheckUpdateResponse | null> {
    const url = getGestorApiUrl(CHECK_UPDATE_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}; access=1`,
      },
      data: { current_version: currentVersion },
    });
    if (res.status < 200 || res.status >= 300) {
      console.warn('[CheckUpdate] HTTP', res.status);
      return null;
    }
    return this.parseBody(res.data);
  }

  private async postWeb(
    accessToken: string,
    currentVersion: string,
  ): Promise<CheckUpdateResponse | null> {
    const url = getGestorApiUrl(CHECK_UPDATE_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ current_version: currentVersion }),
      });
    } catch {
      return null;
    }
    if (!res.ok) {
      console.warn('[CheckUpdate] HTTP', res.status);
      return null;
    }
    return (await res.json().catch(() => null)) as CheckUpdateResponse | null;
  }

  private parseBody(raw: unknown): CheckUpdateResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as CheckUpdateResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as CheckUpdateResponse;
    }
    return null;
  }
}
