import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const SET_DEFAULT_PATH = '/api/central/v1/wallet/set-default';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type WalletSetDefaultResponse = {
  success: boolean;
  message?: string;
  user_id?: number;
  wallet_id?: number;
  is_default?: number;
};

@Injectable({ providedIn: 'root' })
export class WalletSetDefaultService {
  async setDefaultWallet(
    accessToken: string,
    walletToken: string,
  ): Promise<WalletSetDefaultResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, walletToken);
    }
    return this.postWeb(accessToken, walletToken);
  }

  private async postNative(
    accessToken: string,
    walletToken: string,
  ): Promise<WalletSetDefaultResponse | null> {
    const url = getGestorApiUrl(SET_DEFAULT_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}; access=1`,
      },
      data: { wallet_token: walletToken },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.parseBody(res.data);
  }

  private async postWeb(
    accessToken: string,
    walletToken: string,
  ): Promise<WalletSetDefaultResponse | null> {
    const url = getGestorApiUrl(SET_DEFAULT_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ wallet_token: walletToken }),
      });
    } catch {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    return (await res.json().catch(() => null)) as WalletSetDefaultResponse | null;
  }

  private parseBody(raw: unknown): WalletSetDefaultResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as WalletSetDefaultResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as WalletSetDefaultResponse;
    }
    return null;
  }
}
