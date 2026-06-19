import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AccessControl, BiometricAuthError, NativeBiometric } from '@capgo/capacitor-native-biometric';

/** Identificador do item no Keychain (iOS) / Keystore (Android) com as credenciais de login. */
const LOGIN_CREDENTIALS_SERVER = 'com.admspot.finance.login';

/** Erros possíveis do fluxo biométrico (sem o caso de sucesso). */
export type BiometricErrorOutcome =
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

/** Resultado detalhado do fluxo de biometria no login */
export type BiometricLoginOutcome = { kind: 'success' } | BiometricErrorOutcome;

/** Credenciais recuperadas do cofre seguro. */
export type StoredLoginCredentials = { username: string; password: string };

/** Resultado da recuperação de credenciais protegidas por biometria. */
export type BiometricCredentialsOutcome =
  | { kind: 'success'; credentials: StoredLoginCredentials }
  /** Não há credenciais guardadas (ainda não fez "lembrar", ou foram invalidadas). */
  | { kind: 'no_credentials' }
  | BiometricErrorOutcome;

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

  /**
   * `true` se já existem credenciais guardadas no cofre seguro para o login rápido.
   * Sempre `false` fora do app nativo.
   */
  async hasSavedLoginCredentials(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    try {
      const result = await NativeBiometric.isCredentialsSaved({ server: LOGIN_CREDENTIALS_SERVER });
      return result.isSaved === true;
    } catch {
      return false;
    }
  }

  /**
   * Guarda documento+senha no Keychain/Keystore protegidos por biometria
   * (`AccessControl.BIOMETRY_ANY`). No Android, gravar exige confirmação biométrica;
   * no iOS é gravação silenciosa. Retorna `true` se gravou.
   */
  async saveLoginCredentials(username: string, password: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    try {
      const availability = await NativeBiometric.isAvailable({ useFallback: false });
      if (!availability.isAvailable) {
        return false;
      }
      await NativeBiometric.setCredentials({
        username,
        password,
        server: LOGIN_CREDENTIALS_SERVER,
        accessControl: AccessControl.BIOMETRY_ANY,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Remove as credenciais guardadas (logout / "entrar com outra conta"). */
  async clearLoginCredentials(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await NativeBiometric.deleteCredentials({ server: LOGIN_CREDENTIALS_SERVER });
    } catch {
      // Sem credenciais para remover — ignora.
    }
  }

  /**
   * Recupera as credenciais guardadas exigindo biometria (a própria leitura mostra
   * Face ID / digital — iOS no acesso ao Keychain, Android via BiometricPrompt).
   * É o fluxo de "reabrir o app e entrar só com biometria".
   */
  async getLoginCredentialsWithBiometric(): Promise<BiometricCredentialsOutcome> {
    if (!Capacitor.isNativePlatform()) {
      return { kind: 'not_native' };
    }

    try {
      const availability = await NativeBiometric.isAvailable({ useFallback: false });
      if (!availability.isAvailable) {
        return { kind: 'not_available' };
      }
    } catch {
      return { kind: 'not_available' };
    }

    let saved = false;
    try {
      const result = await NativeBiometric.isCredentialsSaved({ server: LOGIN_CREDENTIALS_SERVER });
      saved = result.isSaved === true;
    } catch {
      saved = false;
    }
    if (!saved) {
      return { kind: 'no_credentials' };
    }

    try {
      const creds = await NativeBiometric.getSecureCredentials({
        server: LOGIN_CREDENTIALS_SERVER,
        reason: 'Confirme a sua identidade para entrar na conta',
        title: 'AdmSpot Finance',
        subtitle: 'Face ID ou impressão digital',
        description: 'Use a biometria para acessar sua conta.',
        negativeButtonText: 'Cancelar',
      });
      if (!creds?.username || !creds?.password) {
        return { kind: 'no_credentials' };
      }
      return { kind: 'success', credentials: { username: creds.username, password: creds.password } };
    } catch (err: unknown) {
      return this.mapVerifyError(err);
    }
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

  private mapVerifyError(err: unknown): BiometricErrorOutcome {
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
