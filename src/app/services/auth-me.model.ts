/** Resposta de `GET /api/central/v1/auth/me` — carteira padrão: ver `isWalletMarkedDefault`. */

/**
 * No DB/API o campo pode vir como `0`/`1`, `false`/`true` ou string `"0"`/`"1"`.
 */
export function isWalletMarkedDefault(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    return t === '1' || t === 'true';
  }
  return false;
}

export type DigitalAccountPayload = {
  account_id?: string;
  name?: string;
  endereco?: string;
  province?: string;
  complement?: string;
  postal_code?: string;
  documento?: string;
  personalType?: string;
  state?: string;
  walletID?: string;
  account_number_agency?: string;
  account_number_account?: string;
  account_numberDigit?: string;
  created_at?: string;
} | null;

export type WalletItemPayload = {
  id: number;
  wallet: string;
  /** `1`/`true` ou `0`/`false` (conforme DB). */
  is_default: number | boolean;
  nome_fantasia: string | null;
  admspot_token: string | null;
  email: string;
  contact: string;
  has_webhook: string | null;
  wallet_token_account: string;
  digital_account_approved: boolean;
  has_asaas_api_token: boolean;
  conta_digital_asaas_ativa: boolean;
  asaas_api_token: string | null;
  digital_account: DigitalAccountPayload;
};

export type AuthMeUserPayload = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  level: number;
  document?: string;
};

export type AuthMeResponse = {
  success: boolean;
  message?: string;
  user: AuthMeUserPayload;
  wallets: {
    has_wallets: boolean;
    count: number;
    items: WalletItemPayload[];
  };
};
