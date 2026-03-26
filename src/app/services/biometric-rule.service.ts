import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const BIOMETRIC_RULE_PATH = '/api/central/v1/biometric-rule';

const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type BiometricRuleResponse = {
  success: boolean;
  user_id?: number;
  is_active?: string;
};

@Injectable({ providedIn: 'root' })
export class BiometricRuleService {
  /**
   * `true` = pode ir direto ao dashboard sem biometria (`is_active === "NO"`).
   * Em falha de rede/API, devolve `false` (mantém fluxo com biometria).
   */
  async shouldSkipBiometric(accessToken: string): Promise<boolean> {
    try {
      const data = await this.fetchRule(accessToken);
      if (!data || data.success !== true) {
        return false;
      }
      return data.is_active?.trim().toUpperCase() === 'NO';
    } catch {
      return false;
    }
  }

  private async fetchRule(accessToken: string): Promise<BiometricRuleResponse | null> {
    const url = getGestorApiUrl(BIOMETRIC_RULE_PATH);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({
        url,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          Cookie: `PHPSESSID=${PHPSESSID}`,
        },
        data: '',
      });
      return this.parseBody(res.data);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: '',
    });

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
