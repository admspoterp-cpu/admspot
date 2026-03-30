import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import type { ActionPerformed, PushNotificationSchema, Token } from '@capacitor/push-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { ReplaySubject, filter, firstValueFrom } from 'rxjs';

import { PushFcmTokenService } from './push-fcm-token.service';

/**
 * Registro FCM no Android via @capacitor/push-notifications.
 * Requer `android/app/google-services.json` do projeto Firebase (mesmo package `com.admspot.finance`).
 * iOS: habilitar Push + AppDelegate (fora do escopo desta primeira fase).
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly pushFcmToken = inject(PushFcmTokenService);
  private listenersBound = false;
  /** Resolve a próxima emissão do listener `registration` (para aguardar após `register()`). */
  private pendingRegistrationResolve: ((t: string) => void) | null = null;

  /** Último token FCM (Android) ou null após erro / sem permissão. */
  readonly fcmToken$ = new ReplaySubject<string | null>(1);

  /**
   * Ao iniciar o app: listeners + permissão + `register()`.
   * Só executa em build nativo Android.
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }
    await this.attachListenersOnce();
    await this.requestPermissionsAndRegister();
  }

  /**
   * Fluxo após o utilizador aceitar o alerta (session-bootstrap): pede permissão, regista no FCM e POST na API.
   * `true` se permissão concedida e POST de registo bem-sucedido (ou já estava registado).
   */
  async pushOptInFlow(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return true;
    }
    await this.attachListenersOnce();

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      return false;
    }

    const wait = this.waitForNextRegistrationEvent(25_000);
    await PushNotifications.register();
    let fcm = await wait;
    if (!fcm) {
      try {
        fcm = await firstValueFrom(this.fcmToken$.pipe(filter((t): t is string => !!t?.trim())));
      } catch {
        fcm = null;
      }
    }
    if (!fcm) {
      return false;
    }
    await new Promise<void>((r) => setTimeout(r, 600));
    return this.pushFcmToken.retryAfterAuth();
  }

  private waitForNextRegistrationEvent(ms: number): Promise<string | null> {
    return new Promise((resolve) => {
      const timerId = window.setTimeout(() => {
        this.pendingRegistrationResolve = null;
        resolve(null);
      }, ms);
      this.pendingRegistrationResolve = (t: string) => {
        window.clearTimeout(timerId);
        this.pendingRegistrationResolve = null;
        resolve(t);
      };
    });
  }

  private async attachListenersOnce(): Promise<void> {
    if (this.listenersBound) {
      return;
    }
    this.listenersBound = true;

    await PushNotifications.addListener('registration', (token: Token) => {
      this.fcmToken$.next(token.value);
      console.info('[Push] FCM token:', token.value);
      void this.pushFcmToken.registerFromToken(token.value);
      this.pendingRegistrationResolve?.(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      this.fcmToken$.next(null);
      console.error('[Push] registration error:', err.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Push] received (foreground):', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Push] action performed:', action);
    });

    await this.ensureDefaultChannel();
  }

  private async requestPermissionsAndRegister(): Promise<void> {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[Push] permissão de notificação não concedida:', perm.receive);
      return;
    }
    await PushNotifications.register();
  }

  /** Canal padrão Android 8+; use o mesmo `channelId` no payload FCM quando aplicável. */
  private async ensureDefaultChannel(): Promise<void> {
    try {
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Geral',
        description: 'Notificações do AdmSpot Finance',
        importance: 4,
        visibility: 1,
        sound: undefined,
        vibration: true,
      });
    } catch (e) {
      console.warn('[Push] createChannel:', e);
    }
  }
}
