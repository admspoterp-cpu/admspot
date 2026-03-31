import { Component, inject } from '@angular/core';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

@Component({
  selector: 'app-mais',
  templateUrl: './mais.page.html',
  styleUrls: ['./mais.page.scss'],
  standalone: false,
})
export class MaisPage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-929df931-e44c-4c48-af18-efc51b7cea16.svg`;
  readonly avatarSrc = `${G}/Frame427319717-82588a42-8267-485c-b49b-e07e0051f7bf.svg`;
  readonly caretRightSrc = `${G}/CaretRight-7a8f7f03-b122-4c42-85a7-4b3bafb16d74.svg`;

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly toastController = inject(ToastController);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
    }
  }

  get displayName(): string {
    const u = this.authSession.getUser();
    if (!u) {
      return '—';
    }
    const first = (u.first_name ?? '').trim();
    const last = (u.last_name ?? '').trim();
    const full = `${first} ${last}`.trim();
    return full.length > 0 ? full : u.email;
  }

  /** Mesmo valor enviado como `wallet_token` nas rotas (`wallet_token_account` em `/auth/me`). */
  get walletTokenDisplay(): string {
    const t = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    return t && t.length > 0 ? t : '—';
  }

  get isApproved(): boolean {
    const w = this.authSession.getDefaultWallet();
    return w?.digital_account_approved === true;
  }

  goBack(): void {
    void this.navController.back();
  }

  goToTransacoes(): void {
    void this.navController.navigateForward('/transacoes');
  }

  goToCobrancas(): void {
    void this.navController.navigateForward('/cobrancas');
  }

  goToPagamentoContas(): void {
    void this.navController.navigateForward('/pagamento-contas');
  }

  goToClientes(): void {
    void this.navController.navigateForward('/clientes');
  }

  async onSair(): Promise<void> {
    this.authSession.clear();
    await this.navController.navigateRoot('/login');
  }

  async onComingSoon(label: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `${label}: em breve`,
      duration: 2200,
      position: 'bottom',
      color: 'medium',
    });
    await toast.present();
  }
}
