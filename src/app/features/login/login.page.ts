import { Component, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { BiometricAuthService } from '../../services/biometric-auth.service';
import type { BiometricErrorOutcome } from '../../services/biometric-auth.service';
import { BiometricRuleService } from '../../services/biometric-rule.service';
import { AuthLoginService } from '../../services/auth-login.service';
import { AuthSessionService } from '../../services/auth-session.service';
import type { AuthUser } from '../../services/auth-session.service';
import { RememberedLoginService } from '../../services/remembered-login.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly biometricAuth = inject(BiometricAuthService);
  private readonly biometricRule = inject(BiometricRuleService);
  private readonly authLogin = inject(AuthLoginService);
  private readonly authSession = inject(AuthSessionService);
  private readonly remembered = inject(RememberedLoginService);

  showPassword = false;

  /** Sem documento pré-preenchido: o usuário informa o documento. */
  loginUser = '';
  loginPassword = '';

  /** Opt-in do acesso rápido por biometria nas próximas aberturas. */
  rememberMe = true;

  /** Pulso visual após biometria incorreta */
  biometricFeedbackError = false;

  /** Tela "Olá, <nome>" (usuário lembrado) vs. formulário de login. */
  showWelcome = false;
  rememberedName: string | null = null;
  rememberedDocMasked: string | null = null;

  /** Evita disparo concorrente do login por biometria. */
  quickLoginInFlight = false;

  private readonly isNative = Capacitor.isNativePlatform();
  /** Garante que a biometria só dispara automaticamente uma vez por abertura. */
  private autoPrompted = false;

  ionViewWillEnter(): void {
    void this.initRememberedMode();
  }

  /** Primeiro nome para a saudação. */
  get welcomeFirstName(): string {
    const n = (this.rememberedName ?? '').trim();
    if (!n) {
      return '';
    }
    return n.split(/\s+/)[0];
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Decide entre tela de boas-vindas (acesso por biometria) e formulário.
   * Só há boas-vindas no app nativo, com perfil lembrado E credenciais no cofre.
   */
  private async initRememberedMode(): Promise<void> {
    this.showWelcome = false;
    if (!this.isNative) {
      return;
    }

    const profile = this.remembered.get();
    if (!profile) {
      return;
    }

    const hasCreds = await this.biometricAuth.hasSavedLoginCredentials();
    if (!hasCreds) {
      // Perfil sem credenciais (ex.: biometria reconfigurada invalidou o cofre).
      this.remembered.clear();
      return;
    }

    this.rememberedName = profile.name;
    this.rememberedDocMasked = profile.documentMasked || null;
    this.showWelcome = true;

    if (!this.autoPrompted) {
      this.autoPrompted = true;
      void this.loginWithBiometric();
    }
  }

  /**
   * Reabertura do app: valida por biometria, recupera credenciais do cofre e refaz o login.
   */
  async loginWithBiometric(): Promise<void> {
    if (this.quickLoginInFlight) {
      return;
    }
    this.quickLoginInFlight = true;
    try {
      const outcome = await this.biometricAuth.getLoginCredentialsWithBiometric();
      switch (outcome.kind) {
        case 'success':
          await this.runBackendLoginAndContinue(
            outcome.credentials.username,
            outcome.credentials.password,
            { fromBiometric: true },
          );
          return;

        case 'no_credentials':
          this.remembered.clear();
          this.enterFormMode('');
          await this.presentToast('Faça login para reativar o acesso por biometria.', 'medium', 4200);
          return;

        case 'not_native':
        case 'not_available':
          this.enterFormMode('');
          this.presentBiometricOutcomeFeedback(outcome);
          return;

        default:
          // user_cancelled / authentication_failed / lockout / other_error:
          // permanece na tela de boas-vindas (pode tentar de novo ou trocar de conta).
          this.presentBiometricOutcomeFeedback(outcome);
          return;
      }
    } finally {
      this.quickLoginInFlight = false;
    }
  }

  /** Login manual (documento + senha). */
  async onAccess(): Promise<void> {
    if (!this.loginUser.trim() || !this.loginPassword) {
      await this.presentToast('Informe o documento e a senha.', 'warning', 3200);
      return;
    }
    await this.runBackendLoginAndContinue(this.loginUser, this.loginPassword, { fromBiometric: false });
  }

  /** Volta ao formulário e esquece o usuário lembrado. */
  useAnotherAccount(): void {
    this.enterFormMode('');
    void this.biometricAuth.clearLoginCredentials();
    this.remembered.clear();
  }

  /**
   * Núcleo compartilhado: autentica no backend e segue para o bootstrap.
   * - `fromBiometric`: credenciais já vieram do cofre (identidade confirmada) → vai direto.
   * - manual: aplica a regra `/biometric-rule` e, se necessário, exige biometria.
   */
  private async runBackendLoginAndContinue(
    rawUser: string,
    rawPassword: string,
    { fromBiometric }: { fromBiometric: boolean },
  ): Promise<void> {
    const normalizedUser = rawUser.replace(/\D/g, '');

    let result: Awaited<ReturnType<AuthLoginService['login']>>;
    try {
      result = await this.authLogin.login(normalizedUser, rawPassword);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível fazer login.';
      await this.presentToast(msg, 'danger', 3800);
      if (fromBiometric) {
        // Credenciais guardadas não servem mais (senha alterada, etc.): limpa e volta ao formulário.
        await this.biometricAuth.clearLoginCredentials();
        this.remembered.clear();
        this.enterFormMode(normalizedUser);
        await this.presentToast(
          'Entre com sua senha para reativar o acesso por biometria.',
          'medium',
          4200,
        );
      }
      return;
    }

    const { session, user } = result;
    this.authSession.save(session.access_token, user, session.expires_in);

    if (fromBiometric) {
      // Identidade já confirmada via cofre seguro; atualiza o nome exibido e segue.
      this.remembered.save({
        name: this.displayName(user),
        documentMasked: this.maskDocument(normalizedUser),
      });
      await this.navController.navigateRoot('/session-bootstrap');
      return;
    }

    // ----- Fluxo manual -----
    const skipBiometric = await this.biometricRule.shouldSkipBiometric(session.access_token);
    const wantRemember = this.rememberMe && this.isNative;

    if (wantRemember) {
      // Enrolar o cofre já exige biometria no Android (e é ação deliberada no iOS).
      const enrolled = await this.enrollRemember(normalizedUser, rawPassword, user);
      if (enrolled) {
        // iOS não pede biometria ao gravar: garante o gate quando a regra exige.
        if (!skipBiometric && this.isIos()) {
          const outcome = await this.biometricAuth.authenticateForLogin();
          if (outcome.kind !== 'success') {
            this.presentBiometricOutcomeFeedback(outcome);
            return;
          }
        }
        await this.navController.navigateRoot('/session-bootstrap');
        return;
      }
      // Falhou/cancelou o enrolamento → segue sem lembrar.
      this.remembered.clear();
    }

    if (!skipBiometric) {
      const outcome = await this.biometricAuth.authenticateForLogin();
      if (outcome.kind !== 'success') {
        this.presentBiometricOutcomeFeedback(outcome);
        return;
      }
    }

    // Sem "Me Lembrar": remove qualquer credencial antiga para não reativar conta anterior.
    if (this.isNative && !this.rememberMe) {
      await this.biometricAuth.clearLoginCredentials();
      this.remembered.clear();
    }

    await this.navController.navigateRoot('/session-bootstrap');
  }

  /** Grava credenciais no cofre e o perfil de exibição. Retorna `true` se gravou. */
  private async enrollRemember(user: string, password: string, authUser: AuthUser): Promise<boolean> {
    const stored = await this.biometricAuth.saveLoginCredentials(user, password);
    if (stored) {
      this.remembered.save({
        name: this.displayName(authUser),
        documentMasked: this.maskDocument(user),
      });
    }
    return stored;
  }

  private enterFormMode(prefillDoc: string): void {
    this.showWelcome = false;
    this.loginUser = prefillDoc || '';
    this.loginPassword = '';
  }

  private displayName(user: AuthUser): string {
    const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return full || user.email || 'Usuário';
  }

  /** Mascara o documento só para exibição (ex.: `•••.•••.•••-99`). */
  private maskDocument(digits: string): string {
    const d = (digits || '').replace(/\D/g, '');
    if (!d) {
      return '';
    }
    const last2 = d.slice(-2);
    return d.length >= 11 ? `•••.•••.•••-${last2}` : `••••${last2}`;
  }

  private isIos(): boolean {
    return Capacitor.getPlatform() === 'ios';
  }

  private async presentToast(
    message: string,
    color: 'success' | 'warning' | 'danger' | 'medium',
    duration = 3500,
    cssClass?: string,
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color,
      ...(cssClass ? { cssClass } : {}),
    });
    await toast.present();
  }

  /** Toast/haptics conforme o erro biométrico (compartilhado entre manual e login rápido). */
  private presentBiometricOutcomeFeedback(outcome: BiometricErrorOutcome): void {
    switch (outcome.kind) {
      case 'not_native':
        void this.presentToast(
          'O login com Face ID ou digital está disponível apenas no app instalado no celular (iOS ou Android).',
          'medium',
          4000,
        );
        return;

      case 'not_available':
        void this.presentToast(
          'Biometria não disponível. Ative Face ID, Touch ID ou impressão digital nas configurações do celular.',
          'warning',
          4500,
        );
        return;

      case 'user_cancelled':
        return;

      case 'authentication_failed':
        void this.playErrorFeedback();
        void this.presentToast(
          'Não reconhecemos sua digital ou rosto. Tente de novo ou use outra digital cadastrada.',
          'danger',
          3800,
          'login-biometric-toast',
        );
        return;

      case 'lockout':
        void this.playErrorFeedback();
        void this.presentToast(
          outcome.temporary
            ? 'Muitas tentativas. Aguarde alguns segundos e tente de novo.'
            : 'Biometria bloqueada por segurança. Desbloqueie o celular ou use a senha nas Configurações e tente novamente.',
          'warning',
          5000,
          'login-biometric-toast',
        );
        return;

      case 'other_error':
        void this.playErrorFeedback();
        void this.presentToast(
          outcome.message?.trim() || 'Não foi possível validar a biometria. Tente novamente.',
          'medium',
          3500,
          'login-biometric-toast',
        );
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
