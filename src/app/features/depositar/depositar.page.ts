import { Component, inject } from '@angular/core';
import { AlertController, NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';
import { PixAddressKeysService } from '../../services/pix-address-keys.service';
import { WalletAccountService, type WalletAccountPixKey } from '../../services/wallet-account.service';

/** Chave PIX exibida na tela: valor + id da Asaas (quando presente, habilita a exclusão). */
interface DepositPixKey {
  value: string;
  id: string | null;
}

@Component({
  selector: 'app-depositar',
  templateUrl: './depositar.page.html',
  styleUrls: ['./depositar.page.scss'],
  standalone: false,
})
export class DepositarPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly authSession = inject(AuthSessionService);
  private readonly walletAccountService = inject(WalletAccountService);
  private readonly pixAddressKeysService = inject(PixAddressKeysService);

  loading = false;
  /** Evita toques repetidos enquanto cria chave PIX. */
  creatingPixKey = false;
  /** `pix_key_id` da chave em exclusão (spinner/disable no item); `null` quando ocioso. */
  deletingKeyId: string | null = null;
  errorMessage = '';

  /** `data:image/png;base64,...` a partir de `latest_encoded_image`. */
  qrImageSrc: string | null = null;

  pixKeys: DepositPixKey[] = [];

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

    if (!access || !walletToken) {
      this.qrImageSrc = null;
      this.pixKeys = [];
      this.errorMessage =
        'Não foi possível identificar a carteira. Faça login novamente ou defina uma carteira padrão.';
      return;
    }

    this.loading = true;

    const data = await this.walletAccountService.fetchWalletAccount(access, walletToken);
    this.loading = false;

    // Em falha de reload (rede/HTTP), mantém o que já está na tela — não apaga a lista de chaves.
    if (!data) {
      this.errorMessage = 'Não foi possível carregar os dados da conta.';
      return;
    }

    if (!data.success) {
      this.errorMessage = data.message?.trim() || 'Não foi possível carregar os dados da conta.';
      return;
    }

    // Sucesso: substitui o estado completo pela resposta.
    this.qrImageSrc = data.latest_encoded_image?.trim()
      ? `data:image/png;base64,${data.latest_encoded_image.trim()}`
      : null;

    this.pixKeys = this.buildPixKeys(data.pix_keys_detailed, data.pix_keys);

    this.accountName = '';
    this.accountAgency = '';
    this.accountNumber = '';
    const da = data.digital_account;
    if (da) {
      this.accountName = (da.name ?? '').trim();
      this.accountAgency = (da.account_number_agency ?? '').trim();
      const acc = (da.account_number_account ?? '').trim();
      const dig = (da.account_number_accountDigit ?? '').trim();
      this.accountNumber = [acc, dig].filter((p) => p.length > 0).join('-');
    }
  }

  /**
   * Monta a lista exibida deduplicando por valor: usa `pix_keys_detailed` (traz `pix_key_id` →
   * habilita excluir) e, em seguida, inclui qualquer chave de `pix_keys` ainda não coberta
   * (sem id → exclusão oculta). Cobre backends antigos e respostas mistas.
   */
  private buildPixKeys(
    detailed: WalletAccountPixKey[] | undefined,
    plain: string[] | undefined,
  ): DepositPixKey[] {
    const out: DepositPixKey[] = [];
    const seen = new Set<string>();

    if (Array.isArray(detailed)) {
      for (const k of detailed) {
        const value = (k?.pix_key ?? '').trim();
        if (!value || seen.has(value)) {
          continue;
        }
        seen.add(value);
        out.push({ value, id: (k?.pix_key_id ?? '').trim() || null });
      }
    }

    if (Array.isArray(plain)) {
      for (const v of plain) {
        const value = (v ?? '').trim();
        if (!value || seen.has(value)) {
          continue;
        }
        seen.add(value);
        out.push({ value, id: null });
      }
    }

    return out;
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
    if (this.creatingPixKey || this.deletingKeyId) {
      return;
    }

    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const sourceToken = wallet?.asaas_api_token?.trim();

    if (!access || !sourceToken) {
      await this.presentToast(
        'Não foi possível identificar a carteira. Faça login novamente ou defina uma carteira padrão.',
        'medium',
      );
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
      await this.presentToast('Chave PIX criada com sucesso.', 'success');
      await this.loadWalletAccount();
      return;
    }

    // Mostra o motivo real devolvido pela API (tipo/limite/conta não aprovada, etc.) em vez de um
    // aviso genérico. `data === null` indica falha de rede/HTTP, sem corpo para detalhar.
    const reason = data?.message?.trim();
    await this.presentToast(
      reason || 'Não foi possível criar a chave PIX agora. Tente novamente.',
      data ? 'danger' : 'medium',
    );
  }

  /** Remove uma chave PIX: confirma → `POST /pix/addressKeys/delete` → recarrega a lista. */
  async onDeleteKey(key: DepositPixKey): Promise<void> {
    if (this.deletingKeyId || this.creatingPixKey) {
      return;
    }
    if (!key.id) {
      await this.presentToast('Esta chave não pode ser removida pelo app no momento.', 'medium');
      return;
    }

    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const sourceToken = wallet?.asaas_api_token?.trim();
    if (!access || !sourceToken) {
      await this.presentToast(
        'Não foi possível identificar a carteira. Faça login novamente ou defina uma carteira padrão.',
        'medium',
      );
      return;
    }

    if (!(await this.confirmDelete(key.value))) {
      return;
    }

    // Mantém `deletingKeyId` setado durante todo o fluxo (inclui o reload), evitando uma segunda
    // exclusão concorrente correr em paralelo ao refetch.
    this.deletingKeyId = key.id;
    try {
      const data = await this.pixAddressKeysService.deleteAddressKey(access, sourceToken, key.id);

      if (data?.success === true) {
        // Remoção otimista: tira a chave da lista já, depois reconcilia com o servidor.
        this.pixKeys = this.pixKeys.filter((k) => k.id !== key.id);
        await this.presentToast('Chave PIX removida.', 'success');
        await this.loadWalletAccount();
        return;
      }

      const reason = data?.message?.trim();
      await this.presentToast(
        reason || 'Não foi possível remover a chave PIX agora. Tente novamente.',
        data ? 'danger' : 'medium',
      );
    } finally {
      this.deletingKeyId = null;
    }
  }

  private async confirmDelete(keyValue: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Remover chave PIX',
      message: `Deseja remover esta chave?\n${keyValue}`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Remover', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }

  private async presentToast(
    message: string,
    color: 'success' | 'medium' | 'danger' | 'warning',
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2800,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
