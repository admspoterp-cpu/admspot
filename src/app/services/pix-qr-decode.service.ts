import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const PIX_QR_DECODE_PATH = '/api/central/v1/pix/qrCodes/decode';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type PixQrDecodeSummary = {
  tipo_pagamento?: string;
  pix_payload?: string;
  valor?: number;
  valor_original?: number;
  discount?: number;
  juros?: number;
  multa?: number;
  descricao?: string;
  nome_recebedor?: string;
  recebedor_doc?: string;
  banco_recebedor?: string;
  conciliation_identifier?: string;
  vencimento?: string;
  type?: string;
  transaction_origin_type?: string;
};

export type PixQrDecodeAsaasReceiver = {
  ispb?: number;
  ispbName?: string;
  name?: string;
  tradingName?: string;
  cpfCnpj?: string;
  personType?: string;
  agency?: string;
  account?: string;
  accountType?: string;
};

export type PixQrDecodeAsaas = {
  payload?: string;
  type?: string;
  transactionOriginType?: string;
  pixKey?: string;
  conciliationIdentifier?: string;
  dueDate?: string;
  expirationDate?: string;
  finality?: string | null;
  value?: number;
  changeValue?: number | null;
  canBePaidWithDifferentValue?: boolean;
  canModifyCashValue?: boolean;
  interest?: number;
  fine?: number;
  discount?: number;
  totalValue?: number;
  receiver?: PixQrDecodeAsaasReceiver;
  payer?: { name?: string; cpfCnpj?: string };
  description?: string;
  canBePaid?: boolean;
  cannotBePaidReason?: string | null;
};

export type PixQrDecodeResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  digital_account_id?: number;
  summary?: PixQrDecodeSummary;
  asaas?: PixQrDecodeAsaas;
};

@Injectable({ providedIn: 'root' })
export class PixQrDecodeService {
  async decode(
    accessToken: string,
    sourceToken: string,
    payload: string,
  ): Promise<PixQrDecodeResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.decodeNative(accessToken, sourceToken, payload);
    }
    return this.decodeWeb(accessToken, sourceToken, payload);
  }

  private async decodeNative(
    accessToken: string,
    sourceToken: string,
    payload: string,
  ): Promise<PixQrDecodeResponse | null> {
    const url = getGestorApiUrl(PIX_QR_DECODE_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: {
        source_token: sourceToken,
        payload,
      },
    });
    return this.normalizeBody(res.data);
  }

  private async decodeWeb(
    accessToken: string,
    sourceToken: string,
    payload: string,
  ): Promise<PixQrDecodeResponse | null> {
    const url = getGestorApiUrl(PIX_QR_DECODE_PATH);
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
          payload,
        }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): PixQrDecodeResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PixQrDecodeResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PixQrDecodeResponse;
    }
    return null;
  }
}
