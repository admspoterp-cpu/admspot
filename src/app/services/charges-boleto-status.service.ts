import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const STATUS_PATH = '/api/central/v1/charges/boletos/status';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type BoletoLocalDetail = {
  id: number;
  user_id?: number;
  wallet_id?: number;
  client_id?: number;
  workspot_name?: string | null;
  workspot_email?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  cus_id?: string | null;
  document?: string | null;
  status?: string | null;
  boleto_status?: string | null;
  valor?: number;
  info?: string | null;
  externalReference?: string | null;
  billingType?: string | null;
  pix_payload?: string | null;
  boleto_linha_digitavel?: string | null;
  boleto_invoice_number?: string | null;
  boleto_nosso_numero?: string | null;
  dueDate?: string | null;
  boleto_discount?: string | null;
  boleto_penalty?: string | null;
  discount_value?: number | null;
  discount_dueDateLimitDays?: number | null;
  discount_type?: string | null;
  interest_value?: number | null;
  fine_value?: number | null;
  fine_type?: string | null;
  [key: string]: unknown;
};

export type BoletoStatusResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  boleto_invoice_number?: string;
  boleto_local?: BoletoLocalDetail | null;
  asaas_payment?: Record<string, unknown> | null;
  asaas_error?: unknown;
};

@Injectable({ providedIn: 'root' })
export class ChargesBoletoStatusService {
  async fetchStatus(
    accessToken: string,
    walletToken: string,
    boletoId: number,
  ): Promise<BoletoStatusResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, walletToken, boletoId);
    }
    return this.postWeb(accessToken, walletToken, boletoId);
  }

  private async postNative(
    accessToken: string,
    walletToken: string,
    boletoId: number,
  ): Promise<BoletoStatusResponse | null> {
    const url = getGestorApiUrl(STATUS_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { wallet_token: walletToken, boleto_id: boletoId },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.normalizeBody(res.data);
  }

  private async postWeb(
    accessToken: string,
    walletToken: string,
    boletoId: number,
  ): Promise<BoletoStatusResponse | null> {
    const url = getGestorApiUrl(STATUS_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ wallet_token: walletToken, boleto_id: boletoId }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): BoletoStatusResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as BoletoStatusResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as BoletoStatusResponse;
    }
    return null;
  }
}
