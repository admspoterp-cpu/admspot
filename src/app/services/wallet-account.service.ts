import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

/** Caminho exato da API (grafia `accout`). */
const WALLET_ACCOUNT_PATH = '/api/central/v1/wallet-accout';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type WalletAccountDigitalAccount = {
  name?: string;
  account_number_agency?: string;
  account_number_account?: string;
  account_number_accountDigit?: string;
};

export type WalletAccountResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  wallet_token?: string;
  digital_account?: WalletAccountDigitalAccount;
  pix_keys?: string[];
  latest_payload?: string;
  latest_encoded_image?: string;
};

@Injectable({ providedIn: 'root' })
export class WalletAccountService {
  /**
   * `wallet_token` = `wallet_token_account` da carteira padrão (`GET /auth/me`).
   */
  async fetchWalletAccount(
    accessToken: string,
    walletToken: string,
  ): Promise<WalletAccountResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, walletToken);
    }
    return this.fetchWeb(accessToken, walletToken);
  }

  private async fetchNative(
    accessToken: string,
    walletToken: string,
  ): Promise<WalletAccountResponse | null> {
    const url = getGestorApiUrl(WALLET_ACCOUNT_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { wallet_token: walletToken },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.parseBody(res.data);
  }

  private async fetchWeb(
    accessToken: string,
    walletToken: string,
  ): Promise<WalletAccountResponse | null> {
    const url = getGestorApiUrl(WALLET_ACCOUNT_PATH);
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ wallet_token: walletToken }),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json().catch(() => null)) as WalletAccountResponse | null;
  }

  private parseBody(raw: unknown): WalletAccountResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as WalletAccountResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as WalletAccountResponse;
    }
    return null;
  }
}
