import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';
import type { CentralClient } from './clients-list.service';

const UPDATE_PATH = '/api/central/v1/clients/update';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type ClientsUpdateBody = {
  wallet_token: string;
  client_id: number;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  zip_code: string;
  number: string;
};

export type ClientsUpdateResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  client?: CentralClient;
};

@Injectable({ providedIn: 'root' })
export class ClientsUpdateService {
  async update(accessToken: string, body: ClientsUpdateBody): Promise<ClientsUpdateResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, body);
    }
    return this.postWeb(accessToken, body);
  }

  private async postNative(
    accessToken: string,
    body: ClientsUpdateBody,
  ): Promise<ClientsUpdateResponse | null> {
    const url = getGestorApiUrl(UPDATE_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: body,
    });
    return this.normalizeBody(res.data);
  }

  private async postWeb(
    accessToken: string,
    body: ClientsUpdateBody,
  ): Promise<ClientsUpdateResponse | null> {
    const url = getGestorApiUrl(UPDATE_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      return null;
    }
    const text = await res.text().catch(() => '');
    return this.normalizeBodyFromText(text);
  }

  private normalizeBodyFromText(text: string): ClientsUpdateResponse | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    const idx = trimmed.indexOf('{');
    if (idx < 0) {
      return null;
    }
    try {
      return JSON.parse(trimmed.slice(idx)) as ClientsUpdateResponse;
    } catch {
      return null;
    }
  }

  private normalizeBody(raw: unknown): ClientsUpdateResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      return this.normalizeBodyFromText(raw);
    }
    if (typeof raw === 'object') {
      return raw as ClientsUpdateResponse;
    }
    return null;
  }
}
