import { Component, inject } from '@angular/core';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';
import { PixAddressKeysService } from '../../services/pix-address-keys.service';
import { WalletAccountService } from '../../services/wallet-account.service';

@Component({
  selector: 'app-depositar',
  templateUrl: './depositar.page.html',
  styleUrls: ['./depositar.page.scss'],
  standalone: false,
})
export class DepositarPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly authSession = inject(AuthSessionService);
  private readonly walletAccountService = inject(WalletAccountService);
  private readonly pixAddressKeysService = inject(PixAddressKeysService);

  loading = false;
  /** Evita toques repetidos enquanto cria chave PIX. */
  creatingPixKey = false;
  errorMessage = '';

  /** `data:image/png;base64,...` a partir de `latest_encoded_image`. */
  qrImageSrc: string | null = null;

  pixKeys: string[] = [];

  accountName = '';
  accountAgency = '';
  accountNumber = '';

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadWalletAccount();
  }

  private async loadWalletAccount(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const walletToken = wallet?.wallet_token_account?.trim();

    this.errorMessage = '';
    this.qrImageSrc = null;
    this.pixKeys = [];

    if (!access || !walletToken) {
      this.errorMessage =
        'Não foi possível identificar a carteira. Faça login novamente ou defina uma carteira padrão.';
      return;
    }

    this.loading = true;

    const data = await this.walletAccountService.fetchWalletAccount(access, walletToken);
    this.loading = false;

    if (!data) {
      this.errorMessage = 'Não foi possível carregar os dados da conta.';
      return;
    }

    if (!data.success) {
      this.errorMessage = data.message?.trim() || 'Não foi possível carregar os dados da conta.';
      return;
    }

    if (data.latest_encoded_image?.trim()) {
      this.qrImageSrc = `data:image/png;base64,${data.latest_encoded_image.trim()}`;
    }

    this.pixKeys = Array.isArray(data.pix_keys) ? [...data.pix_keys] : [];

    const da = data.digital_account;
    if (da) {
      this.accountName = (da.name ?? '').trim();
      this.accountAgency = (da.account_number_agency ?? '').trim();
      const acc = (da.account_number_account ?? '').trim();
      const dig = (da.account_number_accountDigit ?? '').trim();
      this.accountNumber = [acc, dig].filter((p) => p.length > 0).join('-');
    }
  }

  goBack(): void {
    this.navController.back();
  }

  async copyKey(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      const toast = await this.toastController.create({
        message: 'Chave PIX copiada',
        duration: 1800,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await this.toastController.create({
        message: 'Não foi possível copiar. Tente selecionar manualmente.',
        duration: 2500,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
    }
  }

  async onCreateNewKey(): Promise<void> {
    if (this.creatingPixKey) {
      return;
    }

    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const sourceToken = wallet?.asaas_api_token?.trim();

    const showToast = async (message: string, color: 'success' | 'medium' | 'danger'): Promise<void> => {
      const toast = await this.toastController.create({
        message,
        duration: 2800,
        position: 'bottom',
        color,
      });
      await toast.present();
    };

    if (!access || !sourceToken) {
      await showToast('Desculpe, estamos trabalhando nisso', 'medium');
      return;
    }

    this.creatingPixKey = true;
    let data;
    try {
      data = await this.pixAddressKeysService.createAddressKey(access, sourceToken);
    } finally {
      this.creatingPixKey = false;
    }

    if (data?.success === true) {
      await showToast('Chave criado com sucesso.', 'success');
      await this.loadWalletAccount();
      return;
    }

    await showToast('Desculpe, estamos trabalhando nisso', 'medium');
  }
}
