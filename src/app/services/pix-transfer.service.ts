import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';
import type { DictKeyType } from './dict.service';

const PIX_TRANSFER_PATH = '/api/central/v1/pix-transfer';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type PixTransferAsaasBank = {
  code?: string;
  name?: string;
  ispb?: string;
};

export type PixTransferAsaasBankAccount = {
  bank?: PixTransferAsaasBank;
  accountName?: string | null;
  ownerName?: string | null;
  cpfCnpj?: string | null;
  type?: string;
  agency?: string;
  agencyDigit?: string | null;
  account?: string;
  accountDigit?: string;
  pixAddressKey?: string;
};

export type PixTransferAsaasPayload = {
  object?: string;
  id?: string;
  value?: number;
  netValue?: number;
  transferFee?: number;
  dateCreated?: string;
  status?: string;
  effectiveDate?: string | null;
  confirmedDate?: string | null;
  endToEndIdentifier?: string | null;
  transactionReceiptUrl?: string | null;
  operationType?: string;
  failReason?: string | null;
  walletId?: string | null;
  description?: string | null;
  externalReference?: string | null;
  authorized?: boolean;
  scheduleDate?: string;
  type?: string;
  bankAccount?: PixTransferAsaasBankAccount;
  recurring?: unknown;
  canBeCancelled?: boolean;
};

export type PixTransferResponse = {
  success: boolean;
  message?: string;
  reference?: string;
  transfer_id?: string;
  wallet_id?: number;
  asaas?: PixTransferAsaasPayload;
};

@Injectable({ providedIn: 'root' })
export class PixTransferService {
  /**
   * `amount` em string com ponto decimal (ex.: `"1.50"`), como na API central.
   */
  async executeTransfer(
    accessToken: string,
    sourceToken: string,
    amount: string,
    chave: string,
    chaveType: DictKeyType,
  ): Promise<PixTransferResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.executeNative(accessToken, sourceToken, amount, chave, chaveType);
    }
    return this.executeWeb(accessToken, sourceToken, amount, chave, chaveType);
  }

  private async executeNative(
    accessToken: string,
    sourceToken: string,
    amount: string,
    chave: string,
    chaveType: DictKeyType,
  ): Promise<PixTransferResponse | null> {
    const url = getGestorApiUrl(PIX_TRANSFER_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: {
        source_token: sourceToken,
        amount,
        chave,
        chave_type: chaveType,
      },
    });
    return this.normalizeBody(res.data);
  }

  private async executeWeb(
    accessToken: string,
    sourceToken: string,
    amount: string,
    chave: string,
    chaveType: DictKeyType,
  ): Promise<PixTransferResponse | null> {
    const url = getGestorApiUrl(PIX_TRANSFER_PATH);
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
          amount,
          chave,
          chave_type: chaveType,
        }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): PixTransferResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PixTransferResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PixTransferResponse;
    }
    return null;
  }
}
