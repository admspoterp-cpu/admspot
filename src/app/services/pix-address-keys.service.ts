import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const PIX_ADDRESS_KEYS_PATH = '/api/central/v1/pix/addressKeys';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type PixAddressKeysResponse = {
  success?: boolean;
  message?: string;
};

@Injectable({ providedIn: 'root' })
export class PixAddressKeysService {
  /**
   * `source_token` = `asaas_api_token` da carteira padrão (`GET /auth/me`).
   */
  async createAddressKey(
    accessToken: string,
    sourceToken: string,
  ): Promise<PixAddressKeysResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.createNative(accessToken, sourceToken);
    }
    return this.createWeb(accessToken, sourceToken);
  }

  private async createNative(
    accessToken: string,
    sourceToken: string,
  ): Promise<PixAddressKeysResponse | null> {
    const url = getGestorApiUrl(PIX_ADDRESS_KEYS_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { source_token: sourceToken },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.parseBody(res.data);
  }

  private async createWeb(
    accessToken: string,
    sourceToken: string,
  ): Promise<PixAddressKeysResponse | null> {
    const url = getGestorApiUrl(PIX_ADDRESS_KEYS_PATH);
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ source_token: sourceToken }),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json().catch(() => null)) as PixAddressKeysResponse | null;
  }

  private parseBody(raw: unknown): PixAddressKeysResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PixAddressKeysResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PixAddressKeysResponse;
    }
    return null;
  }
}
