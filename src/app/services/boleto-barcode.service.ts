import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { normalizarCodigoBarrasParaApi } from '../shared/utils/boleto-barcode.util';
import { getGestorApiUrl } from './api-base-url';

const BOLETO_BARCODE_PATH = '/api/central/v1/boleto/barcode';
const BOLETO_LINHA_DIGITAVEL_PATH = '/api/central/v1/boleto/linha-digitavel';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

/** Trecho comum em `bank_slip` e `asaas.bankSlipInfo`. */
export type BoletoBankSlipInfo = {
  identificationField?: string | null;
  value?: number;
  dueDate?: string | null;
  companyName?: string | null;
  beneficiaryCpfCnpj?: string | null;
  beneficiaryName?: string | null;
  allowChangeValue?: boolean;
  minValue?: number;
  maxValue?: number;
  discountValue?: number | null;
  interestValue?: number | null;
  fineValue?: number | null;
  originalValue?: number;
  totalDiscountValue?: number | null;
  totalAdditionalValue?: number | null;
  isOverdue?: boolean;
  bank?: unknown;
};

export type BoletoBarcodeResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  digital_account_id?: number;
  barcode_input?: string;
  barcode?: string;
  barcode_normalize_mode?: string;
  asaas_field?: string;
  bank_slip?: BoletoBankSlipInfo;
  asaas?: {
    minimumScheduleDate?: string;
    fee?: number;
    bankSlipInfo?: BoletoBankSlipInfo;
  };
};

@Injectable({ providedIn: 'root' })
export class BoletoBarcodeService {
  async fetchByBarcode(
    accessToken: string,
    sourceToken: string,
    barcode: string,
  ): Promise<BoletoBarcodeResponse | null> {
    const payload = normalizarCodigoBarrasParaApi(barcode);
    return this.postLookup(accessToken, sourceToken, BOLETO_BARCODE_PATH, {
      barcode: payload,
    });
  }

  async fetchByLinhaDigitavel(
    accessToken: string,
    sourceToken: string,
    linhaDigitavel: string,
  ): Promise<BoletoBarcodeResponse | null> {
    const payload = String(linhaDigitavel ?? '').replace(/\D/g, '');
    return this.postLookup(accessToken, sourceToken, BOLETO_LINHA_DIGITAVEL_PATH, {
      linha_digitavel: payload,
    });
  }

  private async postLookup(
    accessToken: string,
    sourceToken: string,
    path: string,
    boletoField: { barcode?: string; linha_digitavel?: string },
  ): Promise<BoletoBarcodeResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, sourceToken, path, boletoField);
    }
    return this.fetchWeb(accessToken, sourceToken, path, boletoField);
  }

  private async fetchNative(
    accessToken: string,
    sourceToken: string,
    path: string,
    boletoField: { barcode?: string; linha_digitavel?: string },
  ): Promise<BoletoBarcodeResponse | null> {
    const url = getGestorApiUrl(path);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: {
        source_token: sourceToken,
        ...boletoField,
      },
    });
    return this.normalizeBody(res.data);
  }

  private async fetchWeb(
    accessToken: string,
    sourceToken: string,
    path: string,
    boletoField: { barcode?: string; linha_digitavel?: string },
  ): Promise<BoletoBarcodeResponse | null> {
    const url = getGestorApiUrl(path);
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
          ...boletoField,
        }),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): BoletoBarcodeResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as BoletoBarcodeResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as BoletoBarcodeResponse;
    }
    return null;
  }
}
