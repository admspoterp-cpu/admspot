import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const DICT_PATH = '/api/central/v1/dict';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type DictKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

export type DictValidationData = {
  ispb_name?: string;
  receiver_name?: string;
  doc?: string;
  chave?: string;
  chave_type?: DictKeyType;
  key_pix?: string;
  key_type?: DictKeyType;
  free_transfers?: number;
  transfer_fee?: string;
};

export type DictResponse = {
  success?: boolean;
  message?: string;
  validation_data?: DictValidationData;
};

@Injectable({ providedIn: 'root' })
export class DictService {
  async resolveKey(
    accessToken: string,
    sourceToken: string,
    chave: string,
    chaveType: DictKeyType,
  ): Promise<DictResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.resolveNative(accessToken, sourceToken, chave, chaveType);
    }
    return this.resolveWeb(accessToken, sourceToken, chave, chaveType);
  }

  private async resolveNative(
    accessToken: string,
    sourceToken: string,
    chave: string,
    chaveType: DictKeyType,
  ): Promise<DictResponse | null> {
    const url = getGestorApiUrl(DICT_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { source_token: sourceToken, chave, chave_type: chaveType },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.parseBody(res.data);
  }

  private async resolveWeb(
    accessToken: string,
    sourceToken: string,
    chave: string,
    chaveType: DictKeyType,
  ): Promise<DictResponse | null> {
    const url = getGestorApiUrl(DICT_PATH);
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ source_token: sourceToken, chave, chave_type: chaveType }),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json().catch(() => null)) as DictResponse | null;
  }

  private parseBody(raw: unknown): DictResponse | null {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as DictResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') return raw as DictResponse;
    return null;
  }
}
