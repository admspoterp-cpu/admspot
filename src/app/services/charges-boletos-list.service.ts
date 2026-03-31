import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const LIST_PATH = '/api/central/v1/charges/boletos/list';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type BoletoListItem = {
  id: number;
  client_id?: number;
  client_name?: string | null;
  client_email?: string | null;
  boleto_invoice_number?: string | null;
  boleto_nosso_numero?: string | null;
  boleto_status?: string;
  valor?: number;
  dueDate?: string;
  info?: string | null;
};

export type BoletoListSummary = {
  quantidade_criada?: number;
  valor_a_receber_centavos?: number;
  valor_recebido_centavos?: number;
  valor_a_receber?: string;
  valor_recebido?: string;
  quantidade_vencidos_atrasados?: number;
  valor_vencidos_atrasados_centavos?: number;
  valor_vencidos_atrasados?: string;
};

export type ChargesBoletosListResponse = {
  success: boolean;
  /** Mensagem de erro quando `success` é falso. */
  message?: string;
  wallet_id?: number;
  summary?: BoletoListSummary;
  limit?: number;
  offset?: number;
  items?: BoletoListItem[];
};

@Injectable({ providedIn: 'root' })
export class ChargesBoletosListService {
  async fetchList(accessToken: string, walletToken: string): Promise<ChargesBoletosListResponse | null> {
    if (Capacitor.isNativePlatform()) {
      return this.fetchNative(accessToken, walletToken);
    }
    return this.fetchWeb(accessToken, walletToken);
  }

  private async fetchNative(
    accessToken: string,
    walletToken: string,
  ): Promise<ChargesBoletosListResponse | null> {
    const url = getGestorApiUrl(LIST_PATH);
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
  ): Promise<ChargesBoletosListResponse | null> {
    const url = getGestorApiUrl(LIST_PATH);
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

  private normalizeBody(raw: unknown): ChargesBoletosListResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ChargesBoletosListResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as ChargesBoletosListResponse;
    }
    return null;
  }
}
