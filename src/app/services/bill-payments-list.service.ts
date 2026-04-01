import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const LIST_PATH = '/api/central/v1/bill-payments/list';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type BillPaymentListItem = {
  id: number;
  /** Quando presente, deve coincidir com a carteira da sessão. */
  wallet_id?: number | null;
  token?: string | null;
  status?: string | null;
  digitavel?: string | null;
  value?: string | null;
  original_value?: string | null;
  dueDate?: string | null;
  scheduleDate?: string | null;
  paymentDate?: string | null;
  description?: string | null;
  companyName?: string | null;
  boleto_id?: string | null;
  bill_id?: string | null;
  type_bill?: string | null;
  banco_recebedor?: string | null;
  value_brl?: string | null;
  original_value_brl?: string | null;
  status_label?: string | null;
};

export type BillPaymentListSummary = {
  quantidade?: number;
  total_valor?: string;
  total_pago?: string;
  total_agendado?: string;
  total_nao_efetivado?: string;
  total_valor_brl?: string;
  total_pago_brl?: string;
  total_agendado_brl?: string;
  total_nao_efetivado_brl?: string;
};

export type BillPaymentsListResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  wallet_token?: string;
  summary?: BillPaymentListSummary;
  filters?: { status?: string | null; type_bill?: string | null };
  limit?: number;
  offset?: number;
  items?: BillPaymentListItem[];
};

@Injectable({ providedIn: 'root' })
export class BillPaymentsListService {
  async fetchList(accessToken: string, walletToken: string): Promise<BillPaymentsListResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, walletToken);
    }
    return this.fetchWeb(accessToken, walletToken);
  }

  private async fetchNative(
    accessToken: string,
    walletToken: string,
  ): Promise<BillPaymentsListResponse | null> {
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

  private async fetchWeb(
    accessToken: string,
    walletToken: string,
  ): Promise<BillPaymentsListResponse | null> {
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

  private normalizeBody(raw: unknown): BillPaymentsListResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as BillPaymentsListResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as BillPaymentsListResponse;
    }
    return null;
  }
}
