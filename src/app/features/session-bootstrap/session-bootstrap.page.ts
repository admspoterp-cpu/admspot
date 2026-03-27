import { Component, inject } from '@angular/core';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { AuthMeService } from '../../services/auth-me.service';
import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-session-bootstrap',
  templateUrl: './session-bootstrap.page.html',
  styleUrls: ['./session-bootstrap.page.scss'],
  standalone: false,
})
export class SessionBootstrapPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly authSession = inject(AuthSessionService);
  private readonly authMe = inject(AuthMeService);

  ionViewWillEnter(): void {
    void this.run();
  }

  private async run(): Promise<void> {
    const token = this.authSession.getAccessToken();
    if (!token || this.authSession.isTokenExpired()) {
      this.authSession.clear();
      await this.navController.navigateRoot('/login');
      return;
    }

    const me = await this.authMe.fetchMe(token);
    if (!me || me.success !== true || !me.user) {
      const toast = await this.toastController.create({
        message: me?.message?.trim() || 'Não foi possível carregar os dados da conta.',
        duration: 3500,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
      await this.navController.navigateRoot('/login');
      return;
    }

    const { hasDefaultWallet } = this.authSession.applyAuthMeResponse(me);

    if (hasDefaultWallet) {
      await this.navController.navigateRoot('/dashboard');
      return;
    }

    await this.navController.navigateRoot('/wallet-digital-setup');
  }
}
