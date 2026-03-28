import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const PAY_PATH = '/api/central/v1/boleto/pay';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type BoletoPayBankSlip = {
  identificationField?: string;
  value?: number;
  dueDate?: string;
  beneficiaryName?: string | null;
  beneficiaryCpfCnpj?: string | null;
  isOverdue?: boolean;
  bank?: string;
};

export type BoletoPayAsaasPayout = {
  id?: string;
  status?: string;
  value?: number;
  identificationField?: string;
  dueDate?: string;
  scheduleDate?: string | null;
  paymentDate?: string | null;
  transactionReceiptUrl?: string | null;
  canBeCancelled?: boolean;
  externalReference?: string | null;
};

export type BoletoPayResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  digital_account_id?: number;
  external_reference?: string;
  simulate_mode?: string;
  bill_payment_id?: string;
  status?: string;
  schedule_date?: string;
  digitavel_informed?: string;
  identification_field_asaas?: string;
  bank_slip?: BoletoPayBankSlip;
  asaas_payout?: BoletoPayAsaasPayout;
};

@Injectable({ providedIn: 'root' })
export class BoletoPayService {
  /**
   * `linha_digitavel`: apenas dígitos (47 posições, conforme retorno do campo de identificação).
   * `schedule_date`: opcional — ex.: `2026-03-30 09:00:00` (horário de Brasília), quando boleto vencido.
   */
  async pay(
    accessToken: string,
    sourceToken: string,
    linhaDigitavelDigits: string,
    scheduleDate?: string,
  ): Promise<BoletoPayResponse | null> {
    const linha = String(linhaDigitavelDigits ?? '').replace(/\D/g, '');
    if (Capacitor.isNativePlatform()) {
      return this.payNative(accessToken, sourceToken, linha, scheduleDate);
    }
    return this.payWeb(accessToken, sourceToken, linha, scheduleDate);
  }

  private async payNative(
    accessToken: string,
    sourceToken: string,
    linhaDigitavel: string,
    scheduleDate?: string,
  ): Promise<BoletoPayResponse | null> {
    const url = getGestorApiUrl(PAY_PATH);
    const data: Record<string, unknown> = {
      source_token: sourceToken,
      linha_digitavel: linhaDigitavel,
    };
    if (scheduleDate?.trim()) {
      data['schedule_date'] = scheduleDate.trim();
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
    return this.normalizeBody(res.data);
  }

  private async payWeb(
    accessToken: string,
    sourceToken: string,
    linhaDigitavel: string,
    scheduleDate?: string,
  ): Promise<BoletoPayResponse | null> {
    const url = getGestorApiUrl(PAY_PATH);
    const body: Record<string, unknown> = {
      source_token: sourceToken,
      linha_digitavel: linhaDigitavel,
    };
    if (scheduleDate?.trim()) {
      body['schedule_date'] = scheduleDate.trim();
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
        body: JSON.stringify(body),
      });
    } catch {
      return null;
    }
    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeBody(raw: unknown): BoletoPayResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as BoletoPayResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as BoletoPayResponse;
    }
    return null;
  }
}
