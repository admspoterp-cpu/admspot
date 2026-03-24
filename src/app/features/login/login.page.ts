import { Component, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { NavController, ToastController } from '@ionic/angular';

import { BiometricAuthService } from '../../services/biometric-auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly biometricAuth = inject(BiometricAuthService);

  showPassword = false;

  /** Pulso visual após biometria incorreta */
  biometricFeedbackError = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Acesso ao dashboard só após biometria nativa (Face ID / Touch ID / digital).
   */
  async onAccess(): Promise<void> {
    const outcome = await this.biometricAuth.authenticateForLogin();

    switch (outcome.kind) {
      case 'success':
        await this.navController.navigateRoot('/dashboard');
        return;

      case 'not_native': {
        const toast = await this.toastController.create({
          message:
            'O login com Face ID ou digital está disponível apenas no app instalado no celular (iOS ou Android).',
          duration: 4000,
          position: 'bottom',
          color: 'medium',
        });
        await toast.present();
        return;
      }

      case 'not_available': {
        const toast = await this.toastController.create({
          message:
            'Biometria não disponível. Ative Face ID, Touch ID ou impressão digital nas configurações do celular.',
          duration: 4500,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      case 'user_cancelled':
        return;

      case 'authentication_failed':
        await this.playErrorFeedback();
        {
          const toast = await this.toastController.create({
            message: 'Não reconhecemos sua digital ou rosto. Tente de novo ou use outra digital cadastrada.',
            duration: 3800,
            position: 'bottom',
            color: 'danger',
            cssClass: 'login-biometric-toast',
          });
          await toast.present();
        }
        return;

      case 'lockout':
        await this.playErrorFeedback();
        {
          const msg = outcome.temporary
            ? 'Muitas tentativas. Aguarde alguns segundos e tente de novo.'
            : 'Biometria bloqueada por segurança. Desbloqueie o celular ou use a senha nas Configurações e tente novamente.';
          const toast = await this.toastController.create({
            message: msg,
            duration: 5000,
            position: 'bottom',
            color: 'warning',
            cssClass: 'login-biometric-toast',
          });
          await toast.present();
        }
        return;

      case 'other_error':
        await this.playErrorFeedback();
        {
          const toast = await this.toastController.create({
            message:
              outcome.message?.trim() ||
              'Não foi possível validar a biometria. Tente novamente.',
            duration: 3500,
            position: 'bottom',
            color: 'medium',
            cssClass: 'login-biometric-toast',
          });
          await toast.present();
        }
        return;

      default:
        return;
    }
  }

  private async playErrorFeedback(): Promise<void> {
    this.triggerBiometricVisualError();
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.notification({ type: NotificationType.Error });
      } catch {
        try {
          await Haptics.vibrate({ duration: 120 });
        } catch {
          // ignora
        }
      }
    }
  }

  private triggerBiometricVisualError(): void {
    this.biometricFeedbackError = true;
    window.setTimeout(() => {
      this.biometricFeedbackError = false;
    }, 650);
  }
}
