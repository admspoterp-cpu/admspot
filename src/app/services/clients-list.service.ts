import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const LIST_PATH = '/api/central/v1/clients/list';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type CentralClient = {
  id: number;
  cus_id: string | null;
  admspot_id?: string | null;
  name: string;
  last_name: string;
  document?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  ibge?: string | null;
  status?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClientsListResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  total?: number;
  clients?: CentralClient[];
};

@Injectable({ providedIn: 'root' })
export class ClientsListService {
  async fetchList(accessToken: string, walletToken: string): Promise<ClientsListResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, walletToken);
    }
    return this.fetchWeb(accessToken, walletToken);
  }

  private async fetchNative(
    accessToken: string,
    walletToken: string,
  ): Promise<ClientsListResponse | null> {
    const url = getGestorApiUrl(LIST_PATH);
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
    return this.normalizeBody(res.data);
  }

  private async fetchWeb(accessToken: string, walletToken: string): Promise<ClientsListResponse | null> {
    const url = getGestorApiUrl(LIST_PATH);
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
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): ClientsListResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ClientsListResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as ClientsListResponse;
    }
    return null;
  }
}
