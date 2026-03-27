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
  continuing = false;

  private readonly keyTypes: readonly DictKeyType[] = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'];

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

  async pickKeyType(): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: 'Tipo de chave',
      buttons: [
        ...this.keyTypes.map((t) => ({
          text: t,
          handler: () => {
            this.keyType = t;
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
