import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const VERIFY_PATH = '/api/central/v1/secure/transfer-pass/verify';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type TransferPassVerifyResponse = {
  success: boolean;
  message?: string;
  user_id?: number;
  wallet_id?: number;
  match?: boolean;
};

@Injectable({ providedIn: 'root' })
export class TransferPassVerifyService {
  /**
   * Valida a senha de transferência (4 dígitos) para a carteira atual.
   * `walletToken` corresponde ao campo `wallet_token` do body (ex.: `wallet_token_account` da carteira).
   */
  async verify(
    accessToken: string,
    walletToken: string,
    passcode: string,
  ): Promise<TransferPassVerifyResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.verifyNative(accessToken, walletToken, passcode);
    }
    return this.verifyWeb(accessToken, walletToken, passcode);
  }

  private async verifyNative(
    accessToken: string,
    walletToken: string,
    passcode: string,
  ): Promise<TransferPassVerifyResponse | null> {
    const url = getGestorApiUrl(VERIFY_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { wallet_token: walletToken, passcode },
    });
    return this.normalizeBody(res.data);
  }

  private async verifyWeb(
    accessToken: string,
    walletToken: string,
    passcode: string,
  ): Promise<TransferPassVerifyResponse | null> {
    const url = getGestorApiUrl(VERIFY_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ wallet_token: walletToken, passcode }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): TransferPassVerifyResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as TransferPassVerifyResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as TransferPassVerifyResponse;
    }
    return null;
  }
}
