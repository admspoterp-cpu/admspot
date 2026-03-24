import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation, OrientationType } from '@capawesome/capacitor-screen-orientation';

/**
 * Retrato em todo o app; paisagem só quando explicitamente pedido (ex.: leitor de código de barras).
 */
@Injectable({ providedIn: 'root' })
export class AppScreenOrientationService {
  /** Modo normal do app: retrato fixo (botão home em baixo). */
  async lockPortrait(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ type: OrientationType.PORTRAIT_PRIMARY });
      } catch {
        try {
          await ScreenOrientation.lock({ type: OrientationType.PORTRAIT });
        } catch {
          // ignora
        }
      }
      return;
    }
    await this.lockWeb('portrait');
  }

  /** Leitor de código de barras do boleto: mais campo visual em paisagem. */
  async lockLandscape(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ type: OrientationType.LANDSCAPE });
      } catch {
        try {
          await ScreenOrientation.lock({ type: OrientationType.LANDSCAPE_PRIMARY });
        } catch {
          // ignora
        }
      }
      return;
    }
    await this.lockWeb('landscape');
  }

  private async lockWeb(mode: 'portrait' | 'landscape'): Promise<void> {
    const o = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'portrait' | 'landscape') => Promise<void>;
    };
    if (!o?.lock) {
      return;
    }
    try {
      await o.lock(mode);
    } catch {
      // WebView / browser pode não permitir
    }
  }
}
