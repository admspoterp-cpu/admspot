import { Component, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AlertController, NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { AppVersionService } from '../../services/app-version.service';
import { AuthMeService } from '../../services/auth-me.service';
import { AuthSessionService } from '../../services/auth-session.service';
import type { CheckUpdateResponse } from '../../services/check-update.service';
import { CheckUpdateService } from '../../services/check-update.service';
import { PushFcmTokenService } from '../../services/push-fcm-token.service';
import { PushNotificationsService } from '../../services/push-notifications.service';

@Component({
  selector: 'app-session-bootstrap',
  templateUrl: './session-bootstrap.page.html',
  styleUrls: ['./session-bootstrap.page.scss'],
  standalone: false,
})
export class SessionBootstrapPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly authSession = inject(AuthSessionService);
  private readonly authMe = inject(AuthMeService);
  private readonly appVersion = inject(AppVersionService);
  private readonly checkUpdate = inject(CheckUpdateService);
  private readonly pushFcmToken = inject(PushFcmTokenService);
  private readonly pushNotifications = inject(PushNotificationsService);

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

    const currentVersion = await this.appVersion.getCurrentVersionForApi();
    const updateInfo = await this.checkUpdate.checkClientVersion(token, currentVersion);
    if (this.mustForceUpdate(updateInfo)) {
      await this.presentForceUpdateAlert(updateInfo!);
      return;
    }

    if (!hasDefaultWallet) {
      await this.navController.navigateRoot('/wallet-digital-setup');
      return;
    }

    const wallet = this.authSession.getDefaultWallet();
    const walletToken = wallet?.wallet_token_account?.trim();
    const walletId = wallet?.id;

    if (walletToken && walletId != null) {
      const isAndroidNative =
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

      if (isAndroidNative) {
        const status = await this.pushFcmToken.fetchRegistrationStatus(token, walletToken);
        const okForWallet =
          status != null &&
          status.success === true &&
          status.registered === true &&
          (status.wallet_id == null || status.wallet_id === walletId);

        if (!okForWallet && status != null) {
          const alert = await this.alertController.create({
            header: 'Notificações',
            message:
              'Ative as notificações para receber alertas importantes da sua conta e segurança. ' +
              'Toque em Ativar e aceite a permissão do sistema.',
            buttons: [
              { text: 'Agora não', role: 'cancel' },
              { text: 'Ativar', role: 'confirm' },
            ],
          });
          await alert.present();
          const { role } = await alert.onDidDismiss();
          if (role === 'confirm') {
            await this.pushNotifications.pushOptInFlow();
          }
        } else {
          void this.pushFcmToken.retryAfterAuth();
        }
      } else {
        void this.pushFcmToken.retryAfterAuth();
      }
    } else {
      void this.pushFcmToken.retryAfterAuth();
    }

    await this.navController.navigateRoot('/dashboard');
  }

  /** API indica que o cliente precisa atualizar antes de usar o app. */
  private mustForceUpdate(info: CheckUpdateResponse | null): boolean {
    if (!info || info.success !== true) {
      return false;
    }
    if (info.status === 'precisa_atualizar') {
      return true;
    }
    if (info.atualizado === false) {
      return true;
    }
    return false;
  }

  private pickStoreUrl(data: CheckUpdateResponse): string | null {
    const p = Capacitor.getPlatform();
    if (p === 'ios') {
      return data.link_apple_store?.trim() || data.link_play_store?.trim() || null;
    }
    return data.link_play_store?.trim() || data.link_apple_store?.trim() || null;
  }

  private async presentForceUpdateAlert(data: CheckUpdateResponse): Promise<void> {
    const storeUrl = this.pickStoreUrl(data);
    const ver = data.version?.trim() ?? '—';
    const alert = await this.alertController.create({
      header: `v.${ver} disponível`,
      message: data.message?.trim() || 'É preciso atualizar o aplicativo AdmSpot Finance para continuar.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Atualizar na loja',
          handler: () => {
            if (storeUrl) {
              window.open(storeUrl, '_blank', 'noopener,noreferrer');
            }
          },
        },
      ],
    });
    await alert.present();
    await alert.onDidDismiss();
  }
}
