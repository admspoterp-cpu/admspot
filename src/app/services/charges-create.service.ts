import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const CREATE_PATH = '/api/central/v1/charges/create';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

/** Corpo enviado a `POST /api/central/v1/charges/create` (campos opcionais omitidos quando ausentes). */
export type ChargesCreateBody = {
  source_token: string;
  asaas_customer_id: string;
  value: string;
  due_date: string;
  billing_mode: string;
  description?: string;
  discount?: {
    value: number;
    days_before_due: number;
    type: 'PERCENTAGE' | 'FIXED';
  };
  interest?: { value: number };
  fine?: { value: number; type: 'PERCENTAGE' | 'FIXED' };
};

export type ChargesCreateResponse = {
  success: boolean;
  message?: string;
  payment_id?: string;
  /** ID local do boleto na carteira (para abrir detalhe). */
  boleto_id?: number;
  boleto_local?: { id?: number };
  payment?: Record<string, unknown>;
  identification_field?: string;
  pix_qr_code?: string;
  [key: string]: unknown;
};

/** Extrai o id do boleto na resposta de criação (várias formas possíveis na API). */
export function extractBoletoIdFromCreateResponse(r: ChargesCreateResponse | null): number | null {
  if (!r || r.success !== true) {
    return null;
  }
  if (typeof r.boleto_id === 'number' && Number.isFinite(r.boleto_id)) {
    return r.boleto_id;
  }
  const bl = r.boleto_local;
  if (bl && typeof bl === 'object' && typeof bl.id === 'number' && Number.isFinite(bl.id)) {
    return bl.id;
  }
  const pay = r.payment as { boleto_local_id?: number; boleto_id?: number } | undefined;
  if (pay) {
    if (typeof pay.boleto_id === 'number') {
      return pay.boleto_id;
    }
    if (typeof pay.boleto_local_id === 'number') {
      return pay.boleto_local_id;
    }
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class ChargesCreateService {
  async create(accessToken: string, body: ChargesCreateBody): Promise<ChargesCreateResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, body);
    }
    return this.postWeb(accessToken, body);
  }

  private async postNative(
    accessToken: string,
    body: ChargesCreateBody,
  ): Promise<ChargesCreateResponse | null> {
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

  private async postWeb(accessToken: string, body: ChargesCreateBody): Promise<ChargesCreateResponse | null> {
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
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): ChargesCreateResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ChargesCreateResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as ChargesCreateResponse;
    }
    return null;
  }
}
