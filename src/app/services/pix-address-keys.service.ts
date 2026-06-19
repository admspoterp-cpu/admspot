import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const PIX_ADDRESS_KEYS_PATH = '/api/central/v1/pix/addressKeys';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type PixAddressKeysResponse = {
  success?: boolean;
  message?: string;
};

/** Tipo de chave PIX a registrar. A tela Depositar cria sempre uma aleatória (`EVP`). */
export type PixAddressKeyType = 'EVP' | 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE';

@Injectable({ providedIn: 'root' })
export class PixAddressKeysService {
  /**
   * Registra uma chave PIX na conta digital da carteira padrão.
   * `source_token` = `asaas_api_token` da carteira padrão (`GET /auth/me`).
   * `type` é obrigatório no Asaas; o botão "Criar nova chave PIX" cria uma aleatória (`EVP`).
   */
  async createAddressKey(
    accessToken: string,
    sourceToken: string,
    keyType: PixAddressKeyType = 'EVP',
  ): Promise<PixAddressKeysResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.createNative(accessToken, sourceToken, keyType);
    }
    return this.createWeb(accessToken, sourceToken, keyType);
  }

  private async createNative(
    accessToken: string,
    sourceToken: string,
    keyType: PixAddressKeyType,
  ): Promise<PixAddressKeysResponse | null> {
    const url = getGestorApiUrl(PIX_ADDRESS_KEYS_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { source_token: sourceToken, type: keyType },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.parseBody(res.data);
  }

  private async createWeb(
    accessToken: string,
    sourceToken: string,
    keyType: PixAddressKeyType,
  ): Promise<PixAddressKeysResponse | null> {
    const url = getGestorApiUrl(PIX_ADDRESS_KEYS_PATH);
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ source_token: sourceToken, type: keyType }),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json().catch(() => null)) as PixAddressKeysResponse | null;
  }

  private parseBody(raw: unknown): PixAddressKeysResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PixAddressKeysResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PixAddressKeysResponse;
    }
    return null;
  }
}
