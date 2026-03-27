import { Component, inject } from '@angular/core';
import { NavController, ViewWillEnter } from '@ionic/angular';

import { GESTOR_ORIGIN } from '../../services/api-base-url';
import type { WalletItemPayload } from '../../services/auth-me.model';
import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-wallet-digital-setup',
  templateUrl: './wallet-digital-setup.page.html',
  styleUrls: ['./wallet-digital-setup.page.scss'],
  standalone: false,
})
export class WalletDigitalSetupPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);

  /** Primeira carteira da lista (quando nenhuma está marcada como padrão). */
  wallet: WalletItemPayload | null = null;

  ionViewWillEnter(): void {
    const token = this.authSession.getAccessToken();
    if (!token || this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }

    if (this.authSession.getDefaultWallet()) {
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    this.wallet = this.authSession.getPendingFirstWallet();
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
    void this.navController.navigateRoot('/login');
  }
}
