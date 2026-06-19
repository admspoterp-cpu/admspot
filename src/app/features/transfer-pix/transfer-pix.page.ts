import { Component, inject } from '@angular/core';
import {
  ActionSheetController,
  NavController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';

import { BalanceService } from '../../services/balance.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { DictService, type DictKeyType, type DictValidationData } from '../../services/dict.service';
import { formatBrlNumber, normalizeMoneyValue } from '../../utils/brl-format';

@Component({
  selector: 'app-transfer-pix',
  templateUrl: './transfer-pix.page.html',
  styleUrls: ['./transfer-pix.page.scss'],
  standalone: false,
})
export class TransferPixPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly toastController = inject(ToastController);
  private readonly authSession = inject(AuthSessionService);
  private readonly balanceService = inject(BalanceService);
  private readonly dictService = inject(DictService);

  accountName = 'Conta digital';
  readonly amountReais = 'R$';
  amountValue = '—';
  balanceLoading = false;

  pixKey = '';
  keyType: DictKeyType = 'CPF';
  /** Seleção manual do tipo: impede que a auto-detecção sobrescreva a escolha. */
  private keyTypeManuallySet = false;
  continuing = false;

  private readonly keyTypes: readonly DictKeyType[] = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'];

  /** Rótulos do select. O valor permanece o código da API (ex.: EVP → "Aleatória"). */
  private readonly keyTypeLabels: Record<DictKeyType, string> = {
    CPF: 'CPF',
    CNPJ: 'CNPJ',
    EMAIL: 'EMAIL',
    PHONE: 'PHONE',
    EVP: 'Aleatória',
  };

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    const wallet = this.authSession.getDefaultWallet();
    this.accountName = wallet?.wallet?.trim() || this.accountName;
    void this.loadBalance();
  }

  private async loadBalance(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const sourceToken = wallet?.asaas_api_token?.trim();

    if (!access || !sourceToken) {
      this.amountValue = '—';
      return;
    }

    this.balanceLoading = true;
    const data = await this.balanceService.fetchBalance(access, sourceToken);
    this.balanceLoading = false;

    if (!data || data.success !== true) {
      this.amountValue = '—';
      return;
    }

    const raw = data.balance ?? data.asaas?.balance;
    if (raw === undefined || raw === null) {
      this.amountValue = '—';
      return;
    }

    const amount = normalizeMoneyValue(raw);
    this.amountValue = formatBrlNumber(amount);
  }

  goBack(): void {
    this.navController.back();
  }

  /** Rótulo do tipo para exibição (EVP → "Aleatória"). */
  keyTypeLabel(t: DictKeyType): string {
    return this.keyTypeLabels[t] ?? t;
  }

  /** Auto-seleciona o tipo conforme o padrão digitado na chave. */
  onPixKeyChange(value: string): void {
    this.pixKey = value;
    // Campo limpo reinicia a detecção automática para a próxima chave.
    if (!value.trim()) {
      this.keyTypeManuallySet = false;
    }
    const detected = this.detectPixKeyType(value);
    if (detected && !this.keyTypeManuallySet) {
      this.keyType = detected;
    }
  }

  /**
   * Identifica o tipo da chave PIX pelo formato informado: e-mail, EVP (UUID),
   * telefone (com DDI), CPF (11 díg.) ou CNPJ (14 díg.). Retorna `null` quando o
   * padrão ainda é ambíguo/incompleto, preservando a seleção atual.
   */
  private detectPixKeyType(raw: string): DictKeyType | null {
    const value = raw.trim();
    if (!value) {
      return null;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'EMAIL';
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'EVP';
    }
    if (value.startsWith('+')) {
      return 'PHONE';
    }
    // CPF/CNPJ/telefone só têm dígitos. Havendo letras, ainda é e-mail/EVP em
    // digitação (ex.: UUID parcial) — não classifica por contagem de dígitos.
    if (/[a-z]/i.test(value)) {
      return null;
    }
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return null;
    }
    // Telefone BR com código do país: 55 + DDD + 8/9 dígitos (12 ou 13 dígitos).
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      return 'PHONE';
    }
    if (digits.length === 11) {
      return 'CPF';
    }
    if (digits.length === 14) {
      return 'CNPJ';
    }
    return null;
  }

  async pickKeyType(): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: 'Tipo de chave',
      buttons: [
        ...this.keyTypes.map((t) => ({
          text: this.keyTypeLabel(t),
          handler: () => {
            this.keyType = t;
            this.keyTypeManuallySet = true;
          },
        })),
        {
          text: 'Cancelar',
          role: 'cancel',
        },
      ],
    });
    await sheet.present();
  }

  async onContinue(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    if (!access || !sourceToken) {
      const toast = await this.toastController.create({
        message: 'Sessão inválida. Faça login novamente.',
        duration: 2000,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
      return;
    }

    const key = this.normalizePixKeyByType(this.pixKey, this.keyType);
    if (!key) {
      const toast = await this.toastController.create({
        message: 'Informe a chave PIX',
        duration: 2000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.continuing = true;
    const dict = await this.dictService.resolveKey(access, sourceToken, key, this.keyType);
    this.continuing = false;
    if (!dict || dict.success !== true || !dict.validation_data) {
      const toast = await this.toastController.create({
        message: dict?.message?.trim() || 'Não foi possível validar a chave PIX.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    await this.navController.navigateForward('/pay-transfer-pix', {
      state: {
        pixKey: key,
        keyType: this.keyType,
        dictValidationData: dict.validation_data as DictValidationData,
      },
    });
  }

  private normalizePixKeyByType(raw: string, keyType: DictKeyType): string {
    const value = raw.trim();
    switch (keyType) {
      case 'CPF':
      case 'CNPJ':
      case 'PHONE':
        return value.replace(/\D/g, '');
      case 'EMAIL':
        return value.toLowerCase();
      case 'EVP':
      default:
        return value;
    }
  }
}
