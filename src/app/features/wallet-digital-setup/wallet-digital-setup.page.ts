import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, NavController, ViewWillEnter } from '@ionic/angular';

import { GESTOR_ORIGIN } from '../../services/api-base-url';
import type { WalletItemPayload } from '../../services/auth-me.model';
import { AuthMeService } from '../../services/auth-me.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { WalletSetDefaultService } from '../../services/wallet-set-default.service';

@Component({
  selector: 'app-wallet-digital-setup',
  templateUrl: './wallet-digital-setup.page.html',
  styleUrls: ['./wallet-digital-setup.page.scss'],
  standalone: false,
})
export class WalletDigitalSetupPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
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

  /** Evita toques concorrentes (duplo-toque / clique+enter) disparando set-default e navegação em duplicado. */
  private tapInFlight = false;

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
   * Conta digital inativa → tela informativa. Ativa → define como carteira padrão e abre o dashboard.
   *
   * A seleção é gravada **localmente primeiro** (`setSelectedWalletAsDefaultLocal`): isso garante que
   * o dashboard tenha uma carteira ativa imediatamente e que as próximas aberturas abram direto nela,
   * mesmo se o servidor falhar ou o `/auth/me` ainda não refletir `is_default`. A sincronização com
   * `POST /wallet/set-default` + `/auth/me` é best-effort e nunca bloqueia a navegação.
   */
  async onWalletTap(wallet: WalletItemPayload): Promise<void> {
    if (this.tapInFlight) {
      return;
    }
    this.tapInFlight = true;
    try {
      if (!wallet.conta_digital_asaas_ativa) {
        void this.router.navigate(['/wallet-digital-unavailable'], {
          queryParams: this.pickMode ? { returnPick: '1' } : {},
        });
        return;
      }

      const access = this.authSession.getAccessToken();
      if (!access) {
        this.authSession.clear();
        void this.navController.navigateRoot('/login');
        return;
      }

      // Padrão local imediato: semeia o `previousDefault`, então a reconciliação com `/auth/me`
      // preserva a escolha mesmo que o servidor ainda não tenha gravado `is_default`.
      this.authSession.setSelectedWalletAsDefaultLocal(wallet);

      const walletToken = wallet.wallet_token_account?.trim();
      if (walletToken) {
        const loading = await this.loadingController.create({
          message: 'Atualizando carteira padrão…',
        });
        await loading.present();
        try {
          const res = await this.walletSetDefault.setDefaultWallet(access, walletToken);
          if (res?.success === true) {
            const me = await this.authMe.fetchMe(access);
            if (me?.success === true) {
              this.authSession.applyAuthMeResponse(me);
            }
          }
        } catch {
          // Sincronização com o servidor é best-effort: a seleção local já vale.
        } finally {
          await loading.dismiss().catch(() => undefined);
        }
      }

      void this.navController.navigateRoot('/dashboard');
    } finally {
      this.tapInFlight = false;
    }
  }
}
