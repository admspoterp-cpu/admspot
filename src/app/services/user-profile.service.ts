import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const PROFILE_PATH = '/api/central/v1/user/profile';
const UPDATE_PATH = '/api/central/v1/user/profile/update';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type UserProfilePayload = {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  level?: number;
  acc_type?: number;
  genre?: string;
  datebirth?: string;
  document?: string;
  photo?: string;
  status?: string;
  whatsapp?: string;
  state?: string;
  city?: string;
  postal_code?: string;
  line1?: string;
  buyer_id?: string;
  admspot_aff?: number;
  has_merchantapp?: number;
  is_block?: number;
  created_at?: string;
  updated_at?: string;
};

export type UserProfileResponse = {
  success: boolean;
  message?: string;
  user?: UserProfilePayload;
};

export type UserProfileUpdateBody = {
  first_name: string;
  last_name: string;
  genre: string;
  datebirth: string;
  whatsapp: string;
  /** Data URL base64 ou string vazia para não alterar envio explícito. */
  photo: string;
  postal_code: string;
  /** Quando `photo` é base64 sem prefixo data URL. */
  photo_mime?: string;
};

export type UserProfileUpdateResponse = {
  success: boolean;
  message?: string;
  user?: UserProfilePayload;
  cep?: unknown;
};

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  async fetchProfile(accessToken: string): Promise<UserProfileResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchProfileNative(accessToken);
    }
    return this.fetchProfileWeb(accessToken);
  }

  async updateProfile(
    accessToken: string,
    body: UserProfileUpdateBody,
  ): Promise<UserProfileUpdateResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.updateNative(accessToken, body);
    }
    return this.updateWeb(accessToken, body);
  }

  private async fetchProfileNative(accessToken: string): Promise<UserProfileResponse | null> {
    const url = getGestorApiUrl(PROFILE_PATH);
    const res = await CapacitorHttp.get({
      url,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.normalizeBody(res.data);
  }

  private async fetchProfileWeb(accessToken: string): Promise<UserProfileResponse | null> {
    const url = getGestorApiUrl(PROFILE_PATH);
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
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private async updateNative(
    accessToken: string,
    body: UserProfileUpdateBody,
  ): Promise<UserProfileUpdateResponse | null> {
    const url = getGestorApiUrl(UPDATE_PATH);
    const data: Record<string, unknown> = { ...body };
    if (!body.photo_mime) {
      delete data['photo_mime'];
    }
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data,
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.normalizeUpdateBody(res.data);
  }

  private async updateWeb(
    accessToken: string,
    body: UserProfileUpdateBody,
  ): Promise<UserProfileUpdateResponse | null> {
    const url = getGestorApiUrl(UPDATE_PATH);
    const payload: Record<string, unknown> = { ...body };
    if (!body.photo_mime) {
      delete payload['photo_mime'];
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeUpdateBody(raw);
  }

  private normalizeBody(raw: unknown): UserProfileResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as UserProfileResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as UserProfileResponse;
    }
    return null;
  }

  private normalizeUpdateBody(raw: unknown): UserProfileUpdateResponse | null {
    return this.normalizeBody(raw) as UserProfileUpdateResponse | null;
  }
}
