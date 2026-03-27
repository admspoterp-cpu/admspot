import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const BALANCE_PATH = '/api/central/v1/balance';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type BalanceApiResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  digital_account_id?: number;
  balance?: number;
  asaas?: { balance?: number };
};

@Injectable({ providedIn: 'root' })
export class BalanceService {
  /**
   * `source_token` = `asaas_api_token` da carteira padrão (`GET /auth/me`).
   */
  async fetchBalance(accessToken: string, sourceToken: string): Promise<BalanceApiResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchBalanceNative(accessToken, sourceToken);
    }
    return this.fetchBalanceWeb(accessToken, sourceToken);
  }

  private async fetchBalanceNative(
    accessToken: string,
    sourceToken: string,
  ): Promise<BalanceApiResponse | null> {
    const url = getGestorApiUrl(BALANCE_PATH);
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

  private async fetchBalanceWeb(
    accessToken: string,
    sourceToken: string,
  ): Promise<BalanceApiResponse | null> {
    const url = getGestorApiUrl(BALANCE_PATH);
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
    return (await res.json().catch(() => null)) as BalanceApiResponse | null;
  }

  private parseBody(raw: unknown): BalanceApiResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as BalanceApiResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as BalanceApiResponse;
    }
    return null;
  }
}
