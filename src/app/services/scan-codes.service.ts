import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { getGestorApiUrl } from './api-base-url';

const SCAN_CODES_PATH = '/api/central/v1/reader/scan-codes';
const PHPSESSID = 'ba832f1772c56eb7fb76a591cf310f5f';

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
