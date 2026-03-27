import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const BIOMETRIC_RULE_PATH = '/api/central/v1/biometric-rule';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type BiometricRuleResponse = {
  success: boolean;
  message?: string;
  user_id?: number;
  /** YES/NO ou equivalentes vindos do DB (string, número, boolean). */
  is_active?: string | number | boolean;
};

/**
 * A API devolve `is_active` como "YES"/"NO" no GET; no DB pode vir como 0/1.
 * Biometria desligada = ir direto ao dashboard (skip) quando não está ativa.
 */
function shouldSkipBiometricFromPayload(isActive: unknown): boolean {
  if (isActive === null || isActive === undefined) {
    return false;
  }
  if (typeof isActive === 'boolean') {
    return isActive === false;
  }
  if (typeof isActive === 'number') {
    return isActive === 0;
  }
  const s = String(isActive).trim().toUpperCase();
  return s === 'NO' || s === 'N' || s === '0' || s === 'FALSE';
}

@Injectable({ providedIn: 'root' })
export class BiometricRuleService {
  /**
   * `true` = pode ir direto ao dashboard sem biometria (`is_active` indica regra inativa).
   * Em falha de rede/API, devolve `false` (mantém fluxo com biometria).
   */
  async shouldSkipBiometric(accessToken: string): Promise<boolean> {
    try {
      const data = await this.fetchRule(accessToken);
      if (!data || data.success !== true) {
        return false;
      }
      return shouldSkipBiometricFromPayload(data.is_active);
    } catch {
      return false;
    }
  }

  /**
   * **GET** — lê a regra atual (como no curl sem `--data`).
   * **POST** com corpo vazio devolve 422: "Informe is_active com valor YES ou NO." (uso do POST é outro fluxo).
   */
  private async fetchRule(accessToken: string): Promise<BiometricRuleResponse | null> {
    const url = getGestorApiUrl(BIOMETRIC_RULE_PATH);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({
        url,
        headers: {
          ...headers,
          Cookie: `PHPSESSID=${PHPSESSID}`,
        },
      });
      if (res.status < 200 || res.status >= 300) {
        return null;
      }
      return this.parseBody(res.data);
    }

    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        ...headers,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json().catch(() => null)) as BiometricRuleResponse | null;
    return data;
  }

  private parseBody(raw: unknown): BiometricRuleResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as BiometricRuleResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as BiometricRuleResponse;
    }
    return null;
  }
}
