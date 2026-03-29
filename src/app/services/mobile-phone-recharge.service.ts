import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const RECHARGE_PATH = '/api/central/v1/mobile-phone-recharge';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type MobilePhoneRechargeRequest = {
  source_token: string;
  value: number;
  /** 11 dígitos com DDD, sem máscara */
  phoneNumber: string;
};

export type MobilePhoneRechargeAsaas = {
  id?: string;
  value?: number;
  phoneNumber?: string;
  status?: string;
  canBeCancelled?: boolean;
  operatorName?: string;
};

export type MobilePhoneRechargeResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  digital_account_id?: number;
  value?: number;
  phone_number?: string;
  api_mobile_carga_id?: number;
  asaas?: MobilePhoneRechargeAsaas;
};

/** UI da tela pós-recarga conforme `asaas.status`. */
export function recargaResultUiMode(status: string | undefined | null): 'success' | 'pending' | 'failed' {
  const s = String(status ?? '').toUpperCase().trim();
  if (s === 'PENDING') {
    return 'pending';
  }
  if (s === 'FAILED' || s === 'CANCELED' || s === 'CANCELLED') {
    return 'failed';
  }
  return 'success';
}

@Injectable({ providedIn: 'root' })
export class MobilePhoneRechargeService {
  async requestRecharge(
    accessToken: string,
    body: MobilePhoneRechargeRequest,
  ): Promise<MobilePhoneRechargeResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, body);
    }
    return this.postWeb(accessToken, body);
  }

  private async postNative(
    accessToken: string,
    body: MobilePhoneRechargeRequest,
  ): Promise<MobilePhoneRechargeResponse | null> {
    const url = getGestorApiUrl(RECHARGE_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: body,
    });
    const parsed = this.normalizeBody(res.data);
    if (res.status < 200 || res.status >= 300) {
      return parsed ?? null;
    }
    return parsed;
  }

  private async postWeb(
    accessToken: string,
    body: MobilePhoneRechargeRequest,
  ): Promise<MobilePhoneRechargeResponse | null> {
    const url = getGestorApiUrl(RECHARGE_PATH);
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
    const parsed = this.normalizeBody(raw);
    if (!res.ok) {
      return parsed ?? null;
    }
    return parsed;
  }

  private normalizeBody(raw: unknown): MobilePhoneRechargeResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as MobilePhoneRechargeResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as MobilePhoneRechargeResponse;
    }
    return null;
  }
}
