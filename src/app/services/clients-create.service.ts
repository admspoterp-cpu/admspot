import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const CREATE_PATH = '/api/central/v1/clients/create';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type ClientsCreateBody = {
  wallet_token: string;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  zip_code: string;
  number: string;
};

export type ClientsCreateResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  client?: Record<string, unknown>;
};

@Injectable({ providedIn: 'root' })
export class ClientsCreateService {
  async create(accessToken: string, body: ClientsCreateBody): Promise<ClientsCreateResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, body);
    }
    return this.postWeb(accessToken, body);
  }

  private async postNative(
    accessToken: string,
    body: ClientsCreateBody,
  ): Promise<ClientsCreateResponse | null> {
    const url = getGestorApiUrl(CREATE_PATH);
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
    body: ClientsCreateBody,
  ): Promise<ClientsCreateResponse | null> {
    const url = getGestorApiUrl(CREATE_PATH);
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

  /** API pode prefixar HTML de warning antes do JSON. */
  private normalizeBodyFromText(text: string): ClientsCreateResponse | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    const idx = trimmed.indexOf('{');
    if (idx < 0) {
      return null;
    }
    try {
      return JSON.parse(trimmed.slice(idx)) as ClientsCreateResponse;
    } catch {
      return null;
    }
  }

  private normalizeBody(raw: unknown): ClientsCreateResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      return this.normalizeBodyFromText(raw);
    }
    if (typeof raw === 'object') {
      return raw as ClientsCreateResponse;
    }
    return null;
  }
}
