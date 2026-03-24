import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuthError, NativeBiometric } from '@capgo/capacitor-native-biometric';

/** Resultado detalhado do fluxo de biometria no login */
export type BiometricLoginOutcome =
  | { kind: 'success' }
  | { kind: 'not_native' }
  | { kind: 'not_available' }
  /** Usuário tocou em Cancelar ou fechou o fluxo */
  | { kind: 'user_cancelled' }
  /** Digital / Face ID não reconhecidos */
  | { kind: 'authentication_failed' }
  /** Muitas tentativas — bloqueio temporário ou permanente */
  | { kind: 'lockout'; temporary: boolean }
  /** Outros erros (sistema, app, etc.) */
  | { kind: 'other_error'; message?: string };

type VerifyCopy = {
  reason: string;
  title: string;
  subtitle: string;
  description: string;
  negativeButtonText: string;
};

/**
 * Login apenas após biometria forte (Face ID / Touch ID no iOS, digital / face no Android).
 * PIN/padrão do sistema não é aceito como substituto (`useFallback: false`).
 */
@Injectable({ providedIn: 'root' })
export class BiometricAuthService {
  /** `true` quando o app corre em shell nativo (não no browser). */
  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Solicita biometria ao usuário. Só retorna `success` após confirmação nativa.
   */
  async authenticateForLogin(): Promise<BiometricLoginOutcome> {
    return this.runBiometricVerify({
      reason: 'Confirme a sua identidade para aceder à conta',
      title: 'AdmSpot Finance',
      subtitle: 'Face ID ou impressão digital',
      description: 'Toque no sensor ou olhe para a tela para continuar.',
      negativeButtonText: 'Cancelar',
    });
  }

  /**
   * Após voltar do multitarefa — mesmo fluxo biométrico, textos orientados ao desbloqueio.
   */
  async authenticateForResume(): Promise<BiometricLoginOutcome> {
    return this.runBiometricVerify({
      reason: 'Desbloqueie o aplicativo para continuar',
      title: 'AdmSpot Finance',
      subtitle: 'Conta protegida',
      description: 'Use Face ID ou sua impressão digital para retomar o acesso.',
      negativeButtonText: 'Cancelar',
    });
  }

  private async runBiometricVerify(copy: VerifyCopy): Promise<BiometricLoginOutcome> {
    if (!Capacitor.isNativePlatform()) {
      return { kind: 'not_native' };
    }

    const availability = await NativeBiometric.isAvailable({ useFallback: false });

    if (!availability.isAvailable) {
      return { kind: 'not_available' };
    }

    try {
      await NativeBiometric.verifyIdentity({
        ...copy,
        useFallback: false,
      });
      return { kind: 'success' };
    } catch (err: unknown) {
      return this.mapVerifyError(err);
    }
  }

  private mapVerifyError(err: unknown): BiometricLoginOutcome {
    const code = this.readPluginErrorCode(err);
    const message = this.readErrorMessage(err);

    if (code === BiometricAuthError.USER_CANCEL) {
      return { kind: 'user_cancelled' };
    }

    if (code === BiometricAuthError.APP_CANCEL || code === BiometricAuthError.SYSTEM_CANCEL) {
      return { kind: 'user_cancelled' };
    }

    if (code === BiometricAuthError.USER_FALLBACK) {
      return { kind: 'user_cancelled' };
    }

    if (code === BiometricAuthError.AUTHENTICATION_FAILED) {
      return { kind: 'authentication_failed' };
    }

    if (code === BiometricAuthError.USER_LOCKOUT) {
      return { kind: 'lockout', temporary: false };
    }

    if (code === BiometricAuthError.USER_TEMPORARY_LOCKOUT) {
      return { kind: 'lockout', temporary: true };
    }

    if (this.messageLooksLikeUserCancel(message)) {
      return { kind: 'user_cancelled' };
    }

    if (this.messageLooksLikeAuthFailed(message)) {
      return { kind: 'authentication_failed' };
    }

    return { kind: 'other_error', message };
  }

  private readPluginErrorCode(err: unknown): number | null {
    if (!err || typeof err !== 'object') {
      return null;
    }
    const o = err as Record<string, unknown>;
    const raw = o['code'];
    if (raw === undefined || raw === null) {
      return null;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  private readErrorMessage(err: unknown): string {
    if (err instanceof Error && typeof err.message === 'string') {
      return err.message;
    }
    if (err && typeof err === 'object' && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      return typeof m === 'string' ? m : '';
    }
    return '';
  }

  private messageLooksLikeUserCancel(message: string): boolean {
    const m = message.toLowerCase();
    return (
      m.includes('cancel') ||
      m.includes('cancelou') ||
      m.includes('user canceled') ||
      m.includes('user cancelled')
    );
  }

  private messageLooksLikeAuthFailed(message: string): boolean {
    const m = message.toLowerCase();
    return m.includes('authentication failed') || m.includes('biometric authentication failed');
  }
}
