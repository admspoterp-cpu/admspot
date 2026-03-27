import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';
import type { PixTransferAsaasPayload } from './pix-transfer.service';

const INFO_PATH = '/api/central/v1/pix/transfers/info';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type PixTransferInfoRecipient = {
  owner_name?: string;
  cpf_cnpj?: string;
  bank_name?: string;
  bank_code?: string;
};

export type PixTransferInfoSummary = {
  id?: string;
  end_to_end_identifier?: string;
  value?: number;
  net_value?: number;
  effective_date?: string;
  schedule_date?: string | null;
  operation_type?: string;
  status?: string;
  type?: string;
  description?: string;
  fail_reason?: string | null;
  recipient?: PixTransferInfoRecipient;
};

export type PixTransferInfoResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  transfer_id?: string;
  summary?: PixTransferInfoSummary;
  asaas?: PixTransferAsaasPayload;
};

@Injectable({ providedIn: 'root' })
export class PixTransferInfoService {
  async fetchInfo(
    accessToken: string,
    sourceToken: string,
    transferId: string,
  ): Promise<PixTransferInfoResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, sourceToken, transferId);
    }
    return this.fetchWeb(accessToken, sourceToken, transferId);
  }

  private async fetchNative(
    accessToken: string,
    sourceToken: string,
    transferId: string,
  ): Promise<PixTransferInfoResponse | null> {
    const url = getGestorApiUrl(INFO_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { source_token: sourceToken, transfer_id: transferId },
    });
    return this.normalizeBody(res.data);
  }

  private async fetchWeb(
    accessToken: string,
    sourceToken: string,
    transferId: string,
  ): Promise<PixTransferInfoResponse | null> {
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
        body: JSON.stringify({ source_token: sourceToken, transfer_id: transferId }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): PixTransferInfoResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PixTransferInfoResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PixTransferInfoResponse;
    }
    return null;
  }
}
