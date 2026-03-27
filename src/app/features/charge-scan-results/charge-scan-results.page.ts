import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';

import type { ScanCodesResponse } from '../../services/scan-codes.service';
import { normalizarCodigoBarrasParaApi } from '../../shared/utils/boleto-barcode.util';

export type ChargeScanResultsNavState = {
  scanResult?: ScanCodesResponse;
};

type ScanOptionKind = 'boleto' | 'pix';

type ScanOption = {
  id: string;
  kind: ScanOptionKind;
  /** Valor bruto (linha, código ou payload Pix). */
  value: string;
  label: string;
};

@Component({
  selector: 'app-charge-scan-results',
  templateUrl: './charge-scan-results.page.html',
  styleUrls: ['./charge-scan-results.page.scss'],
  standalone: false,
})
export class ChargeScanResultsPage implements OnInit {
  apiMessage = '';
  options: ScanOption[] = [];
  selectedId = '';

  private readonly router = inject(Router);
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  ngOnInit(): void {
    const state = history.state as ChargeScanResultsNavState;
    const scanResult = state?.scanResult;
    if (!scanResult || scanResult.success !== true) {
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    this.apiMessage = (scanResult.message ?? '').trim();
    this.options = this.buildOptions(scanResult);
    if (this.options.length === 0) {
      void this.presentToast(
        'Nenhum boleto ou Pix foi identificado neste arquivo. Tente outra imagem ou documento.',
        'warning',
      );
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    this.selectedId = this.options[0]?.id ?? '';
  }

  /** `ion-item` com `button` quebrava o toque no Pix; seleção explícita na linha inteira. */
  onRowSelect(id: string): void {
    this.selectedId = id;
  }

  goBack(): void {
    void this.navController.navigateBack('/dashboard');
  }

  get continueDisabled(): boolean {
    return !this.selectedId || !this.options.some((o) => o.id === this.selectedId);
  }

  async onContinue(): Promise<void> {
    const opt = this.options.find((o) => o.id === this.selectedId);
    if (!opt) {
      return;
    }

    if (opt.kind === 'boleto') {
      const barcode = normalizarCodigoBarrasParaApi(opt.value);
      await this.router.navigate(['/boleto-payment-details'], {
        state: { barcode, source: 'scan' },
      });
      return;
    }

    await this.router.navigate(['/pix-qr-processing'], {
      state: { qrPayload: opt.value.trim() },
    });
  }

  private buildOptions(scanResult: ScanCodesResponse): ScanOption[] {
    const data = scanResult.data;
    if (!data) {
      return [];
    }

    const out: ScanOption[] = [];
    const seenBoleto = new Set<string>();
    const seenPix = new Set<string>();
    let seq = 0;

    const nextId = (): string => {
      seq += 1;
      return `opt-${seq}`;
    };

    const pushBoleto = (raw: string, subtitle: string): void => {
      const v = raw.trim();
      if (!v) {
        return;
      }
      const norm = normalizarCodigoBarrasParaApi(v);
      if (seenBoleto.has(norm)) {
        return;
      }
      seenBoleto.add(norm);
      const digits = v.replace(/\D/g, '');
      const preview =
        digits.length > 18 ? `${digits.slice(0, 8)}…${digits.slice(-6)}` : digits || v.slice(0, 24);
      out.push({
        id: nextId(),
        kind: 'boleto',
        value: v,
        label: `Boleto (${subtitle}): ${preview}`,
      });
    };

    const pushPix = (raw: string): void => {
      const v = raw.trim();
      if (!v) {
        return;
      }
      if (seenPix.has(v)) {
        return;
      }
      seenPix.add(v);
      const preview = v.length > 28 ? `${v.slice(0, 16)}…${v.slice(-8)}` : v;
      out.push({
        id: nextId(),
        kind: 'pix',
        value: v,
        label: `Pix: ${preview}`,
      });
    };

    for (const x of data.boleto ?? []) {
      if (x) {
        pushBoleto(x, 'boleto');
      }
    }
    for (const x of data.barcodes ?? []) {
      if (x) {
        pushBoleto(x, 'código de barras');
      }
    }

    const lines = data.lines_scanned;
    if (Array.isArray(lines)) {
      for (const x of lines) {
        if (x) {
          pushBoleto(String(x), 'linha digitável');
        }
      }
    } else if (typeof lines === 'string' && lines.trim()) {
      pushBoleto(lines, 'linha digitável');
    }

    for (const x of data.pix_payloads ?? []) {
      if (x) {
        pushPix(x);
      }
    }
    for (const x of data.pix ?? []) {
      if (x) {
        pushPix(x);
      }
    }

    return out;
  }

  private async presentToast(message: string, color: 'warning' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3200,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
