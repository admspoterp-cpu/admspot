import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';
import type { PixTransferAsaasPayload } from './pix-transfer.service';

const INFO_PATH = '/api/central/v1/pix/transactions/info';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type PixTransactionInfoQrCode = {
  payload?: string | null;
  change_value?: number | null;
};

export type PixTransactionInfoSummary = {
  id?: string;
  status?: string;
  value?: number;
  net_value?: number | null;
  end_to_end_identifier?: string | null;
  type?: string;
  description?: string;
  date_created?: string;
  payment_date?: string | null;
  scheduled_date?: string | null;
  fail_reason?: string | null;
  qr_code?: PixTransactionInfoQrCode;
};

export type PixTransactionExternalAccount = {
  ispb?: number;
  ispbName?: string;
  name?: string;
  cpfCnpj?: string;
  agency?: string;
  account?: string;
  accountDigit?: string;
  accountType?: string;
  addressKey?: string;
  addressKeyType?: string;
};

export type PixTransactionInfoResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  transaction_id?: string;
  summary?: PixTransactionInfoSummary;
  asaas?: PixTransferAsaasPayload & {
    externalAccount?: PixTransactionExternalAccount;
    qrCode?: {
      payer?: { name?: string; cpfCnpj?: string };
      conciliationIdentifier?: string;
      originalValue?: number;
      dueDate?: string;
      description?: string;
    };
  };
};

@Injectable({ providedIn: 'root' })
export class PixTransactionInfoService {
  async fetchInfo(
    accessToken: string,
    sourceToken: string,
    transactionId: string,
  ): Promise<PixTransactionInfoResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, sourceToken, transactionId);
    }
    return this.fetchWeb(accessToken, sourceToken, transactionId);
  }

  private async fetchNative(
    accessToken: string,
    sourceToken: string,
    transactionId: string,
  ): Promise<PixTransactionInfoResponse | null> {
    const url = getGestorApiUrl(INFO_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { source_token: sourceToken, transaction_id: transactionId },
    });
    return this.normalizeBody(res.data);
  }

  private async fetchWeb(
    accessToken: string,
    sourceToken: string,
    transactionId: string,
  ): Promise<PixTransactionInfoResponse | null> {
    const url = getGestorApiUrl(INFO_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ source_token: sourceToken, transaction_id: transactionId }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): PixTransactionInfoResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PixTransactionInfoResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PixTransactionInfoResponse;
    }
    return null;
  }
}
