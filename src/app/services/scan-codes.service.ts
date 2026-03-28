import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const SCAN_CODES_PATH = '/api/central/v1/reader/scan-codes';
const SCAN_CODE_MODE_PATH = '/api/central/v1/scan-code-mode';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

export type ScanCodeModeOption = 'SCAN_ONLY' | 'SCAN_BY_ZIMAGE' | 'SCAN_BY_ZIMAGE_QUICK' | string;

export type ScanCodeModeResponse = {
  success: boolean;
  scan_options?: ScanCodeModeOption;
  message?: string;
};

export type ScanCodesData = {
  barcodes?: string[] | null;
  pix_payloads?: string[] | null;
  boleto?: string[] | null;
  pix?: string[] | null;
  lines_scanned?: string[] | string | null;
};

export type ScanCodesResponse = {
  success: boolean;
  message?: string;
  user_id?: number;
  data?: ScanCodesData | null;
};

@Injectable({ providedIn: 'root' })
export class ScanCodesService {
  /**
   * Define se o leitor de boleto usa só Quagga (`SCAN_ONLY`) ou captura de frame + API (`SCAN_BY_ZIMAGE`).
   */
  async getScanCodeMode(accessToken: string): Promise<ScanCodeModeResponse | null> {
    const url = getGestorApiUrl(SCAN_CODE_MODE_PATH);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (Capacitor.isNativePlatform()) {
      headers['Cookie'] = `PHPSESSID=${PHPSESSID}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers,
      });
    } catch {
      return null;
    }

    const raw = await res.json().catch(() => null);
    return this.normalizeScanModeBody(raw);
  }

  async scanCodes(accessToken: string, file: File): Promise<ScanCodesResponse | null> {
    const url = getGestorApiUrl(SCAN_CODES_PATH);
    const formData = new FormData();
    formData.append('file', file, file.name);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (Capacitor.isNativePlatform()) {
      headers['Cookie'] = `PHPSESSID=${PHPSESSID}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers,
        body: formData,
      });
    } catch {
      return null;
    }

    const raw = await res.json().catch(() => null);
    return this.normalizeBody(raw);
  }

  private normalizeScanModeBody(raw: unknown): ScanCodeModeResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ScanCodeModeResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as ScanCodeModeResponse;
    }
    return null;
  }

  private normalizeBody(raw: unknown): ScanCodesResponse | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as ScanCodesResponse;
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') {
      return raw as ScanCodesResponse;
    }
    return null;
  }
}
