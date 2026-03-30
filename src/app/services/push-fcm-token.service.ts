import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';
import { AuthSessionService } from './auth-session.service';

const PUSH_FCM_PATH = '/api/central/v1/push-fcm-token';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';
const DEVICE_ID_STORAGE_KEY = 'admspot_push_device_id';

/** Resposta do `POST` de registro FCM. */
export type PushFcmTokenApiResponse = {
  success: boolean;
  message?: string;
  user_id?: number;
  wallet_id?: number;
  id?: number;
};

/** Resposta do `GET ?wallet_token=` — status de registro push para a carteira. */
export type PushFcmTokenStatusResponse = {
  success: boolean;
  registered?: boolean;
  user_id?: number;
  wallet_id?: number;
  registro_id?: number;
  device_id_registro?: string;
  created_at?: string;
  updated_at?: string;
};

/**
 * Registra o token FCM no gestor (`POST /api/central/v1/push-fcm-token`).
 * Usa `wallet_token_account` da carteira padrão (mesmo valor enviado como `wallet_token` nas outras rotas).
 */
@Injectable({ providedIn: 'root' })
export class PushFcmTokenService {
  private lastFcmToken: string | null = null;
  /** Evita POST repetido com o mesmo par FCM + carteira. */
  private lastPostedFingerprint: string | null = null;

  constructor(private readonly authSession: AuthSessionService) {}

  /** Chamado quando o Capacitor emite o token FCM (Android). */
  async registerFromToken(fcmToken: string): Promise<boolean> {
    this.lastFcmToken = fcmToken;
    return this.tryPost();
  }

  /**
   * Chamar após login / `/auth/me` quando a carteira padrão já pode estar disponível
   * (token FCM pode ter chegado antes da sessão).
   */
  async retryAfterAuth(): Promise<boolean> {
    return this.tryPost();
  }

  /**
   * `GET /api/central/v1/push-fcm-token?wallet_token=...` — verifica se o push já está registrado para a carteira.
   */
  async fetchRegistrationStatus(
    accessToken: string,
    walletTokenAccount: string,
  ): Promise<PushFcmTokenStatusResponse | null> {
    const q = new URLSearchParams({ wallet_token: walletTokenAccount });
    const url = `${getGestorApiUrl(PUSH_FCM_PATH)}?${q.toString()}`;
    if (Capacitor.isNativePlatform()) {
      return this.fetchStatusNative(accessToken, url);
    }
    return this.fetchStatusWeb(accessToken, url);
  }

  private async fetchStatusNative(
    accessToken: string,
    url: string,
  ): Promise<PushFcmTokenStatusResponse | null> {
    const res = await CapacitorHttp.get({
      url,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}; access=1`,
      },
    });
    if (res.status < 200 || res.status >= 300) {
      console.warn('[Push] GET status FCM (HTTP', res.status, ')');
      return null;
    }
    return this.parseStatusBody(res.data);
  }

  private async fetchStatusWeb(
    accessToken: string,
    url: string,
  ): Promise<PushFcmTokenStatusResponse | null> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      return null;
    }
    if (!res.ok) {
      console.warn('[Push] GET status FCM (HTTP', res.status, ')');
      return null;
    }
    return (await res.json().catch(() => null)) as PushFcmTokenStatusResponse | null;
  }

  private parseStatusBody(raw: unknown): PushFcmTokenStatusResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PushFcmTokenStatusResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PushFcmTokenStatusResponse;
    }
    return null;
  }

  private async tryPost(): Promise<boolean> {
    const fcm = this.lastFcmToken?.trim();
    if (!fcm) {
      return false;
    }

    const access = this.authSession.getAccessToken()?.trim();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!access || !walletToken || this.authSession.isTokenExpired()) {
      return false;
    }

    const fingerprint = `${fcm}|${walletToken}`;
    if (fingerprint === this.lastPostedFingerprint) {
      return true;
    }

    const deviceId = this.getOrCreateDeviceId();
    const body: { wallet_token: string; fcm_token: string; device_id?: string } = {
      wallet_token: walletToken,
      fcm_token: fcm,
    };
    if (deviceId) {
      body.device_id = deviceId;
    }

    const ok = await this.postToApi(access, body);
    if (ok) {
      this.lastPostedFingerprint = fingerprint;
      console.info('[Push] FCM token registrado na API.');
    }
    return ok;
  }

  private getOrCreateDeviceId(): string {
    try {
      let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (!id?.trim()) {
        id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
      }
      return id.trim();
    } catch {
      return '';
    }
  }

  private async postToApi(
    accessToken: string,
    body: { wallet_token: string; fcm_token: string; device_id?: string },
  ): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      return this.postNative(accessToken, body);
    }
    return this.postWeb(accessToken, body);
  }

  private async postNative(
    accessToken: string,
    body: { wallet_token: string; fcm_token: string; device_id?: string },
  ): Promise<boolean> {
    const url = getGestorApiUrl(PUSH_FCM_PATH);
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
      console.warn('[Push] Falha ao registrar FCM na API (HTTP', res.status, ')');
      return false;
    }
    const parsed = this.parseBody(res.data);
    return parsed?.success === true;
  }

  private async postWeb(
    accessToken: string,
    body: { wallet_token: string; fcm_token: string; device_id?: string },
  ): Promise<boolean> {
    const url = getGestorApiUrl(PUSH_FCM_PATH);
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
      return false;
    }
    if (!res.ok) {
      console.warn('[Push] Falha ao registrar FCM na API (HTTP', res.status, ')');
      return false;
    }
    const parsed = (await res.json().catch(() => null)) as PushFcmTokenApiResponse | null;
    return parsed?.success === true;
  }

  private parseBody(raw: unknown): PushFcmTokenApiResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PushFcmTokenApiResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as PushFcmTokenApiResponse;
    }
    return null;
  }
}
