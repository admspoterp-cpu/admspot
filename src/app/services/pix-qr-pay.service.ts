import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const PAY_PATH = '/api/central/v1/pix/qrCodes/pay';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type PixQrPayAsaas = {
  id?: string;
  transferId?: string;
  endToEndIdentifier?: string | null;
  status?: string;
  value?: number;
  description?: string;
  type?: string;
  originType?: string;
  [key: string]: unknown;
};

export type PixQrPayResponse = {
  success: boolean;
  message?: string;
  reference?: string;
  transfer_id?: string;
  wallet_id?: number;
  end_to_end_identifier?: string | null;
  asaas?: PixQrPayAsaas;
};

@Injectable({ providedIn: 'root' })
export class PixQrPayService {
  async pay(
    accessToken: string,
    sourceToken: string,
    payload: string,
    value: number,
    description: string,
  ): Promise<PixQrPayResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.payNative(accessToken, sourceToken, payload, value, description);
    }
    return this.payWeb(accessToken, sourceToken, payload, value, description);
  }

  private async payNative(
    accessToken: string,
    sourceToken: string,
    payload: string,
    value: number,
    description: string,
  ): Promise<PixQrPayResponse | null> {
    const url = getGestorApiUrl(PAY_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: {
        source_token: sourceToken,
        qrCode: { payload },
        value,
        description,
      },
    });
    return this.normalizeBody(res.data);
  }

  private async payWeb(
    accessToken: string,
    sourceToken: string,
    payload: string,
    value: number,
    description: string,
  ): Promise<PixQrPayResponse | null> {
    const url = getGestorApiUrl(PAY_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          source_token: sourceToken,
          qrCode: { payload },
          value,
          description,
        }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): PixQrPayResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PixQrPayResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PixQrPayResponse;
    }
    return null;
  }
}
