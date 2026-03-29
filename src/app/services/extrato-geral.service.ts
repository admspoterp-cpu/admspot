import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const EXTRATO_PATH = '/api/central/v1/extrato-geral';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

/** Registro genérico retornado pelo extrato (transferência, boleto, etc.). */
export type ExtratoOperacaoRaw = Record<string, unknown> & {
  tipo_registro?: string;
  data_hora_br?: string;
  created_at?: string;
  trasnfer_bank_ownerName?: string;
  companyName?: string;
  trasnfer_value?: string;
  /** Valor em reais (número ou string) — usado em lançamentos genéricos / “movimento”. */
  amount?: number | string;
  valor?: number | string;
  value?: number | string;
  values?: string;
  trasnfer_object?: string;
  trasnfer_type?: string;
  trasnfer_id?: string;
  trasnfer_operationType?: string;
  trasnfer_bank_name?: string;
  atividade?: string;
  banco_recebedor?: string | null;
  /** Campos opcionais conforme retorno do extrato — usados em filtros / exibição. */
  trasnfer_bank_ownerCPF?: string;
  trasnfer_bank_ownerCnpj?: string;
  cpfCnpj?: string;
  cpf_cnpj?: string;
  documento?: string;
  beneficiary_document?: string;
  trasnfer_document?: string;
};

export type ExtratoGeralResponse = {
  success: boolean;
  message?: string;
  wallet_id?: number;
  total?: number;
  operacoes?: ExtratoOperacaoRaw[];
};

@Injectable({ providedIn: 'root' })
export class ExtratoGeralService {
  async fetchExtrato(accessToken: string, walletToken: string): Promise<ExtratoGeralResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, walletToken);
    }
    return this.fetchWeb(accessToken, walletToken);
  }

  private async fetchNative(
    accessToken: string,
    walletToken: string,
  ): Promise<ExtratoGeralResponse | null> {
    const url = getGestorApiUrl(EXTRATO_PATH);
    const res = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Cookie: `PHPSESSID=${PHPSESSID}`,
      },
      data: { wallet_token: walletToken },
    });
    if (res.status < 200 || res.status >= 300) {
      return null;
    }
    return this.normalizeBody(res.data);
  }

  private async fetchWeb(
    accessToken: string,
    walletToken: string,
  ): Promise<ExtratoGeralResponse | null> {
    const url = getGestorApiUrl(EXTRATO_PATH);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ wallet_token: walletToken }),
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

  private normalizeBody(raw: unknown): ExtratoGeralResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ExtratoGeralResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as ExtratoGeralResponse;
    }
    return null;
  }
}
