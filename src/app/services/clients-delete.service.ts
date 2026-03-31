import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const DELETE_PATH = '/api/central/v1/clients/delete';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type ClientsDeleteBody = {
  wallet_token: string;
  client_id: number;
};

export type ClientsDeleteResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
};

@Injectable({ providedIn: 'root' })
export class ClientsDeleteService {
  async delete(accessToken: string, body: ClientsDeleteBody): Promise<ClientsDeleteResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, body);
    }
    return this.postWeb(accessToken, body);
  }

  private async postNative(
    accessToken: string,
    body: ClientsDeleteBody,
  ): Promise<ClientsDeleteResponse | null> {
    const url = getGestorApiUrl(DELETE_PATH);
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
    body: ClientsDeleteBody,
  ): Promise<ClientsDeleteResponse | null> {
    const url = getGestorApiUrl(DELETE_PATH);
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

  private normalizeBodyFromText(text: string): ClientsDeleteResponse | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    const idx = trimmed.indexOf('{');
    if (idx < 0) {
      return null;
    }
    try {
      return JSON.parse(trimmed.slice(idx)) as ClientsDeleteResponse;
    } catch {
      return null;
    }
  }

  private normalizeBody(raw: unknown): ClientsDeleteResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      return this.normalizeBodyFromText(raw);
    }
    if (typeof raw === 'object') {
      return raw as ClientsDeleteResponse;
    }
    return null;
  }
}
