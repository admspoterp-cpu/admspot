import { Component, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { NavController, ToastController } from '@ionic/angular';

import { BiometricAuthService } from '../../services/biometric-auth.service';
import { BiometricRuleService } from '../../services/biometric-rule.service';
import { AuthLoginService } from '../../services/auth-login.service';
import { AuthSessionService } from '../../services/auth-session.service';

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
  private readonly biometricRule = inject(BiometricRuleService);
  private readonly authLogin = inject(AuthLoginService);
  private readonly authSession = inject(AuthSessionService);

  showPassword = false;

  loginUser = '23538948879';
  loginPassword = 'ab31hgTT!@';

  /** Pulso visual após biometria incorreta */
  biometricFeedbackError = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Após login: consulta `/biometric-rule`; se `is_active === "NO"`, vai ao dashboard sem biometria.
   * Caso contrário (ou se a API falhar), mantém o fluxo com biometria nativa.
   */
  async onAccess(): Promise<void> {
    const normalizedUser = this.loginUser.replace(/\D/g, '');
    try {
      const { session, user } = await this.authLogin.login(normalizedUser, this.loginPassword);
      this.authSession.save(session.access_token, user);

      const skipBiometric = await this.biometricRule.shouldSkipBiometric(
        session.access_token,
      );
      if (skipBiometric) {
        await this.navController.navigateRoot('/dashboard');
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível fazer login.';
      const toast = await this.toastController.create({
        message: msg,
        duration: 3800,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
      return;
    }

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
