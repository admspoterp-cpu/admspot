import { Injectable, NgZone, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Platform, ToastController } from '@ionic/angular';
import { filter } from 'rxjs';

import { BiometricAuthService } from './biometric-auth.service';

/**
 * Bloqueia a área autenticada ao retornar do multitarefa e exige biometria para desbloquear.
 */
@Injectable({ providedIn: 'root' })
export class AppResumeLockService {
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly biometric = inject(BiometricAuthService);
  private readonly toastController = inject(ToastController);

  /** Overlay em tela cheia */
  readonly overlayVisible = signal(false);

  /** Texto de erro curto sob o botão */
  readonly inlineError = signal<string | null>(null);

  /** Desabilita o botão durante o prompt nativo */
  readonly unlockBusy = signal(false);

  /** Evita chamadas biométricas sobrepostas */
  private unlockInFlight = false;

  /** True após sair do app estando em rota protegida */
  private pendingResumeLock = false;

  constructor() {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      this.ngZone.run(() => {
        const url = this.router.url.split(/[#?]/)[0];
        if (this.isPublicRoute(url)) {
          this.pendingResumeLock = false;
          this.overlayVisible.set(false);
          this.inlineError.set(null);
        }
      });
    });

    void this.platform.ready().then(() => this.setupAppStateListener());
  }

  /** Chamado pelo botão “Desbloquear” / retry. */
  async requestUnlock(): Promise<void> {
    await this.runUnlockAttempt({ autoTriggered: false });
  }

  private setupAppStateListener(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    void App.addListener('appStateChange', ({ isActive }) => {
      this.ngZone.run(() => {
        const url = this.router.url.split(/[#?]/)[0];

        if (!isActive) {
          // Arma só num "saiu do app" GENUÍNO de rota protegida. Enquanto a folha biométrica do
          // próprio app está na tela (`isNativePromptOnScreen`), o resign é auto-induzido — não arma.
          // Aqui NÃO se usa a carência por tempo: um background real logo após um prompt ainda
          // deve armar a trava. `unlockInFlight`: idem, evita re-armar com a folha do desbloqueio.
          if (
            !this.isPublicRoute(url) &&
            !this.unlockInFlight &&
            !this.biometric.isNativePromptOnScreen()
          ) {
            this.pendingResumeLock = true;
          }
          return;
        }

        // Voltou ao primeiro plano: ignora o `active` causado pela própria folha biométrica do app
        // (login rápido, confirmação de pagamento ou o próprio desbloqueio), incluindo a carência que
        // absorve o evento de dismiss atrasado. É o que evita o loop de 2–3 prompts no iOS.
        if (this.biometric.isBiometricPromptBusy()) {
          return;
        }

        if (this.isPublicRoute(url)) {
          this.pendingResumeLock = false;
          this.overlayVisible.set(false);
          this.inlineError.set(null);
          return;
        }

        if (this.pendingResumeLock) {
          this.overlayVisible.set(true);
          this.inlineError.set(null);
          window.setTimeout(() => {
            void this.runUnlockAttempt({ autoTriggered: true });
          }, 280);
        }
      });
    });
  }

  private isPublicRoute(path: string): boolean {
    if (path === '/' || path === '') {
      return true;
    }
    return (
      path === '/onboarding' ||
      path.startsWith('/onboarding/') ||
      path === '/login' ||
      path.startsWith('/login/') ||
      // Rota de passagem pós-login: roteia em seguida para dashboard/seleção/login. Não deve
      // armar o bloqueio de retomada — é onde a corrida de `appStateChange` costuma cair.
      path === '/session-bootstrap' ||
      path.startsWith('/session-bootstrap/')
    );
  }

  private async runUnlockAttempt(opts: { autoTriggered: boolean }): Promise<void> {
    if (this.unlockInFlight) {
      return;
    }
    this.unlockInFlight = true;
    this.unlockBusy.set(true);
    this.inlineError.set(null);

    try {
      const outcome = await this.biometric.authenticateForResume();

      switch (outcome.kind) {
        case 'success':
          this.pendingResumeLock = false;
          this.overlayVisible.set(false);
          this.inlineError.set(null);
          return;

        case 'not_native':
          this.pendingResumeLock = false;
          this.overlayVisible.set(false);
          return;

        case 'user_cancelled':
          if (opts.autoTriggered) {
            this.inlineError.set(null);
          } else {
            this.inlineError.set('Toque em Desbloquear para tentar de novo.');
          }
          return;

        case 'authentication_failed':
          await this.playErrorHaptic();
          this.inlineError.set('Não reconhecemos sua biometria.');
          await this.showToast('Não reconhecemos sua digital ou rosto. Tente novamente.', 'danger');
          return;

        case 'lockout':
          await this.playErrorHaptic();
          this.inlineError.set(
            outcome.temporary ? 'Aguarde alguns segundos e tente de novo.' : 'Biometria bloqueada. Use as configurações do celular.',
          );
          await this.showToast(
            outcome.temporary
              ? 'Muitas tentativas. Aguarde e tente de novo.'
              : 'Biometria bloqueada por segurança. Desbloqueie nas configurações do aparelho.',
            'warning',
          );
          return;

        case 'not_available':
          this.inlineError.set('Biometria indisponível neste aparelho.');
          await this.showToast('Ative Face ID ou impressão digital nas configurações.', 'warning');
          return;

        case 'other_error':
          await this.playErrorHaptic();
          this.inlineError.set('Não foi possível validar. Tente novamente.');
          await this.showToast(outcome.message?.trim() || 'Falha na autenticação.', 'medium');
          return;

        default:
          return;
      }
    } finally {
      this.unlockInFlight = false;
      this.unlockBusy.set(false);
    }
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3200,
      position: 'bottom',
      color: color as 'danger' | 'warning' | 'medium',
    });
    await toast.present();
  }

  private async playErrorHaptic(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      try {
        await Haptics.vibrate({ duration: 100 });
      } catch {
        // ignora
      }
    }
  }
}
