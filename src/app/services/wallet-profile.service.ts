import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const PROFILE_PATH = '/api/central/v1/wallet/profile';
const UPDATE_PATH = '/api/central/v1/wallet/profile/update';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

/** Objeto `wallet` na resposta do GET profile. */
export type WalletEntityPayload = {
  id?: number;
  wallet?: string;
  email?: string;
  contact?: string;
  atividade?: string;
  tipo_tributacao?: string;
  workspot_logo?: string;
  spending_cap?: string;
  earning_goal?: string;
  street?: string;
  district?: string;
  number?: string;
  country?: string;
  state?: string;
  city?: string;
  zipcode?: string;
  document?: string;
  cnpj?: string;
  nome_fantasia?: string;
  gestor_nome?: string;
  company_registro_date?: string;
  type?: string;
  plan_pro?: string | null;
  has_digital_account?: string;
  wallet_token_account?: string;
};

/** Bloco `cep` na resposta do `POST .../wallet/profile/update`. */
export type WalletProfileUpdateCepResponse = {
  ok?: boolean;
  data?: {
    cep?: string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    ibge?: string;
  };
  filled?: {
    city?: string;
    state?: string;
    zipcode?: string;
  };
  ibge?: string;
};

export type WalletProfileResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  wallet_token?: string;
  wallet?: WalletEntityPayload;
  /** Presente no retorno do update quando o CEP é resolvido no servidor. */
  cep?: WalletProfileUpdateCepResponse;
  digital_account?: unknown;
  pix_keys?: unknown;
  latest_payload?: string;
  latest_encoded_image?: string;
};

/**
 * Corpo oficial `POST /api/central/v1/wallet/profile/update`
 * (wallet_token, zipcode, número do endereço, workspot_logo, dados cadastrais e metas).
 */
export type WalletProfileUpdateBody = {
  wallet_token: string;
  zipcode: string;
  /** Número do endereço (ex.: `Nº 15` ou `15`). */
  number: string;
  /** Base64 / data URL ou string vazia. */
  workspot_logo: string;
  wallet: string;
  nome_fantasia: string;
  email: string;
  /** Apenas dígitos (ex.: DDD + número). */
  contact: string;
  atividade: string;
  company_registro_date: string;
  /** Valor em reais como string (ex.: `"100000"`). */
  spending_cap: string;
  earning_goal: string;
  type: string;
  tipo_tributacao: string;
};

@Injectable({ providedIn: 'root' })
export class WalletProfileService {
  async fetchProfile(accessToken: string, walletToken: string): Promise<WalletProfileResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, walletToken);
    }
    return this.fetchWeb(accessToken, walletToken);
  }

  async updateProfile(
    accessToken: string,
    body: WalletProfileUpdateBody,
  ): Promise<WalletProfileResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.updateNative(accessToken, body);
    }
    return this.updateWeb(accessToken, body);
  }

  private buildProfileUrl(walletToken: string): string {
    const q = new URLSearchParams({ wallet_token: walletToken });
    return `${getGestorApiUrl(PROFILE_PATH)}?${q.toString()}`;
  }

  private async fetchNative(
    accessToken: string,
    walletToken: string,
  ): Promise<WalletProfileResponse | null> {
    const res = await CapacitorHttp.get({
      url: this.buildProfileUrl(walletToken),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.normalize(res.data);
  }

  private async fetchWeb(accessToken: string, walletToken: string): Promise<WalletProfileResponse | null> {
    let res: Response;
    try {
      res = await fetch(this.buildProfileUrl(walletToken), {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    return this.normalize(await res.json().catch(() => null));
  }

  private async updateNative(
    accessToken: string,
    body: WalletProfileUpdateBody,
  ): Promise<WalletProfileResponse | null> {
    const url = getGestorApiUrl(UPDATE_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: body,
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.normalize(res.data);
  }

  private async updateWeb(
    accessToken: string,
    body: WalletProfileUpdateBody,
  ): Promise<WalletProfileResponse | null> {
    const url = getGestorApiUrl(UPDATE_PATH);
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
    if (!res.ok) {
      return null;
    }
    return this.normalize(await res.json().catch(() => null));
  }

  private normalize(raw: unknown): WalletProfileResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as WalletProfileResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as WalletProfileResponse;
    }
    return null;
  }
}
