import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import packageJson from '../../../package.json';

/**
 * Versão enviada ao endpoint `check-update`.
 * Em build nativo usa `App.getInfo().version` (mesmo valor que `versionName` no Android / marketing version iOS).
 * No browser (dev) usa `package.json` "version".
 */
const WEB_DEV_VERSION_FALLBACK = packageJson.version;

@Injectable({ providedIn: 'root' })
export class AppVersionService {
  /**
   * Valor de `current_version` na API (ex.: "1.0", "1.4").
   */
  async getCurrentVersionForApi(): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      try {
        const info = await App.getInfo();
        const v = info.version?.trim();
        if (v) {
          return v;
        }
      } catch {
        // ignora
      }
    }
    return WEB_DEV_VERSION_FALLBACK;
  }
}
