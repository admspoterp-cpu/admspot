import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, NavController, ViewWillEnter } from '@ionic/angular';

import { GESTOR_ORIGIN } from '../../services/api-base-url';
import type { WalletItemPayload } from '../../services/auth-me.model';
import { AuthMeService } from '../../services/auth-me.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { WalletSetDefaultService } from '../../services/wallet-set-default.service';

const SET_DEFAULT_FAILURE_MESSAGE =
  'Pedimos desculpas, estamos enfrentando dificuldades para processar sua solicitação no momento. ' +
  'Por favor, aguarde alguns minutos e tente novamente. Caso o problema persista, entre em contato com o suporte.';

@Component({
  selector: 'app-wallet-digital-setup',
  templateUrl: './wallet-digital-setup.page.html',
  styleUrls: ['./wallet-digital-setup.page.scss'],
  standalone: false,
})
export class WalletDigitalSetupPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly alertController = inject(AlertController);
  private readonly loadingController = inject(LoadingController);
  private readonly authSession = inject(AuthSessionService);
  private readonly authMe = inject(AuthMeService);
  private readonly walletSetDefault = inject(WalletSetDefaultService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /**
   * `true` quando aberto a partir do dashboard (`?pick=1`) para trocar de carteira
   * mesmo já existindo uma padrão no storage.
   */
  pickMode = false;

  /** Carteiras do utilizador quando nenhuma está como padrão (`is_default`). */
  wallets: WalletItemPayload[] = [];

  ionViewWillEnter(): void {
    this.pickMode = this.route.snapshot.queryParamMap.get('pick') === '1';

    const token = this.authSession.getAccessToken();
    if (!token || this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }

    if (this.authSession.getDefaultWallet() && !this.pickMode) {
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    this.wallets = this.authSession.getAllWallets();
  }

  openCreateDigitalAccount(): void {
    const url = `${GESTOR_ORIGIN}/`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Volta a chamar `/auth/me` (útil após marcar uma carteira como padrão no gestor). */
  checkAgain(): void {
    void this.navController.navigateRoot('/session-bootstrap');
  }

  goBack(): void {
    if (this.pickMode) {
      void this.navController.navigateRoot('/dashboard');
      return;
    }
    void this.navController.navigateRoot('/login');
  }

  /**
   * Conta digital inativa → tela informativa. Ativa → `POST /wallet/set-default` e sincroniza com `/auth/me`.
   */
  async onWalletTap(wallet: WalletItemPayload): Promise<void> {
    if (!wallet.conta_digital_asaas_ativa) {
      void this.router.navigate(['/wallet-digital-unavailable'], {
        queryParams: this.pickMode ? { returnPick: '1' } : {},
      });
      return;
    }

    const access = this.authSession.getAccessToken();
    const walletToken = wallet.wallet_token_account?.trim();
    if (!access || !walletToken) {
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Atualizando carteira padrão…',
    });
    await loading.present();

    const res = await this.walletSetDefault.setDefaultWallet(access, walletToken);

    await loading.dismiss().catch(() => undefined);

    if (res?.success === true) {
      const me = await this.authMe.fetchMe(access);
      if (me?.success === true) {
        this.authSession.applyAuthMeResponse(me);
      } else {
        this.authSession.setSelectedWalletAsDefaultLocal(wallet);
      }
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Não foi possível concluir',
      message: SET_DEFAULT_FAILURE_MESSAGE,
      buttons: ['Ok'],
    });
    await alert.present();
  }
}
