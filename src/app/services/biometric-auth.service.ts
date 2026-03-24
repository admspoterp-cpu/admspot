import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

export type BiometricLoginResult =
  | 'success'
  /** Navegador / preview — biometria nativa indisponível */
  | 'not_native'
  /** Dispositivo sem biometria cadastrada ou sem hardware */
  | 'not_available'
  /** Usuário cancelou ou falha na leitura */
  | 'cancelled_or_failed';

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
  async authenticateForLogin(): Promise<BiometricLoginResult> {
    if (!Capacitor.isNativePlatform()) {
      return 'not_native';
    }

    const availability = await NativeBiometric.isAvailable({ useFallback: false });

    if (!availability.isAvailable) {
      return 'not_available';
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Confirme a sua identidade para aceder à conta',
        title: 'AdmSpot Finance',
        subtitle: 'Face ID ou impressão digital',
        description: 'Toque no sensor ou olhe para a tela para continuar.',
        negativeButtonText: 'Cancelar',
        useFallback: false,
      });
      return 'success';
    } catch {
      return 'cancelled_or_failed';
    }
  }
}
