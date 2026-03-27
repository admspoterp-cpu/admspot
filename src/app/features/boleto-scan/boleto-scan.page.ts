import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';

import { AppScreenOrientationService } from '../../services/app-screen-orientation.service';
import { normalizarCodigoBarrasParaApi } from '../../shared/utils/boleto-barcode.util';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';
type QuaggaDetectedResult = {
  codeResult?: {
    code?: string;
  };
};
type QuaggaGlobal = {
  init: (config: unknown, callback: (error?: unknown) => void) => void;
  start: () => void;
  stop: () => void;
  onDetected: (callback: (result: QuaggaDetectedResult) => void) => void;
  offDetected: (callback: (result: QuaggaDetectedResult) => void) => void;
};

@Component({
  selector: 'app-boleto-scan',
  templateUrl: './boleto-scan.page.html',
  styleUrls: ['./boleto-scan.page.scss'],
  standalone: false,
})
export class BoletoScanPage implements OnDestroy {
  @ViewChild('scannerViewport') scannerViewport?: ElementRef<HTMLDivElement>;

  cameraAllowed = false;
  scanState: ScanState = 'idle';
  detectedCode = '';
  statusMessage = 'Aponte o codigo de barras do boleto para a area de leitura.';

  private scriptLoadPromise?: Promise<void>;
  private quagga?: QuaggaGlobal;
  /** Evita múltiplos `onDetected` antes do scanner parar. */
  private suppressDetections = false;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private bestCandidateDigits = '';
  private bestCandidateScore = -1;
  private stableReads = 0;
  private lastStableApiCode = '';
  private firstCandidateAtMs = 0;

  private readonly onDetectedHandler = (result: QuaggaDetectedResult): void => {
    if (this.suppressDetections) {
      return;
    }
    const raw = result.codeResult?.code ?? '';
    const digitsOnly = this.normalizeBoletoNumber(raw);
    const candidate = this.extractCandidateDigits(digitsOnly);
    if (!candidate) {
      return;
    }
    const apiCode = normalizarCodigoBarrasParaApi(candidate);
    const score = this.scoreCandidate(candidate, apiCode);
    if (score > this.bestCandidateScore) {
      this.bestCandidateScore = score;
      this.bestCandidateDigits = candidate;
    }
    if (this.firstCandidateAtMs === 0) {
      this.firstCandidateAtMs = Date.now();
    }

    if (apiCode.length === 44) {
      if (apiCode === this.lastStableApiCode) {
        this.stableReads += 1;
      } else {
        this.lastStableApiCode = apiCode;
        this.stableReads = 1;
      }
    }

    this.detectedCode = this.bestCandidateDigits;
    this.statusMessage = `Lendo codigo… ${this.bestCandidateDigits.length} dígitos`;
    this.scheduleFinalizeDetection();
  };
  private readonly navController = inject(NavController);
  private readonly router = inject(Router);
  private readonly screenOrientation = inject(AppScreenOrientationService);

  async ionViewDidEnter(): Promise<void> {
    await this.screenOrientation.lockLandscape();
    await this.startScanner();
  }

  async ionViewWillLeave(): Promise<void> {
    this.stopScanner();
    await this.screenOrientation.lockPortrait();
  }

  async ngOnDestroy(): Promise<void> {
    this.stopScanner();
    await this.screenOrientation.lockPortrait();
  }

  goBack(): void {
    this.navController.navigateBack('/dashboard');
  }

  goToManualEntry(): void {
    this.navController.navigateForward('/boleto-manual');
  }

  async restartScanner(): Promise<void> {
    this.stopScanner();
    this.scanState = 'idle';
    this.detectedCode = '';
    this.statusMessage = 'Aponte o codigo de barras do boleto para a area de leitura.';
    await this.startScanner();
  }

  private async startScanner(): Promise<void> {
    this.stopScanner();
    this.suppressDetections = false;
    this.bestCandidateDigits = '';
    this.bestCandidateScore = -1;
    this.stableReads = 0;
    this.lastStableApiCode = '';
    this.firstCandidateAtMs = 0;
    this.scanState = 'scanning';
    this.detectedCode = '';
    this.statusMessage = 'Aponte o codigo de barras do boleto para a area de leitura.';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraAllowed = false;
      this.scanState = 'error';
      this.statusMessage = 'Camera nao suportada neste dispositivo.';
      return;
    }

    try {
      await this.ensureQuaggaLoaded();
      if (!this.quagga || !this.scannerViewport?.nativeElement) {
        return;
      }

      this.quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: this.scannerViewport.nativeElement,
            constraints: {
              facingMode: 'environment',
              width: { ideal: 2560 },
              height: { ideal: 1440 },
            },
            area: {
              top: '30%',
              right: '12%',
              left: '12%',
              bottom: '30%',
            },
          },
          decoder: {
            readers: ['i2of5_reader', '2of5_reader', 'code_128_reader', 'code_39_reader'],
          },
          locator: {
            patchSize: 'medium',
            halfSample: false,
          },
          locate: true,
          numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2,
        },
        (error?: unknown) => {
          if (error) {
            this.cameraAllowed = false;
            this.scanState = 'error';
            this.statusMessage = 'Nao foi possivel iniciar a leitura do boleto.';
            return;
          }

          this.cameraAllowed = true;
          this.scanState = 'scanning';
          this.statusMessage = 'Aponte o codigo de barras do boleto para a area de leitura.';
          this.quagga?.offDetected(this.onDetectedHandler);
          this.quagga?.onDetected(this.onDetectedHandler);
          this.quagga?.start();
          void this.tryImproveCameraFocus();
        }
      );
    } catch {
      this.cameraAllowed = false;
      this.scanState = 'error';
      this.statusMessage = 'Permissao da camera negada. Toque para tentar novamente.';
    }
  }

  private async ensureQuaggaLoaded(): Promise<void> {
    if (this.quagga) {
      return;
    }

    if (!this.scriptLoadPromise) {
      this.scriptLoadPromise = new Promise<void>((resolve, reject) => {
        const loaded = (window as Window & { Quagga?: QuaggaGlobal }).Quagga;
        if (loaded) {
          this.quagga = loaded;
          resolve();
          return;
        }

        const scriptId = 'quagga2-bundle-script';
        const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () => {
            this.quagga = (window as Window & { Quagga?: QuaggaGlobal }).Quagga;
            if (this.quagga) {
              resolve();
              return;
            }
            reject(new Error('Quagga nao disponivel no window.'));
          });
          existing.addEventListener('error', () => reject(new Error('Falha ao carregar Quagga.')));
          return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'assets/lib/quagga.min.js';
        script.async = true;
        script.onload = () => {
          this.quagga = (window as Window & { Quagga?: QuaggaGlobal }).Quagga;
          if (this.quagga) {
            resolve();
            return;
          }
          reject(new Error('Quagga nao disponivel no window.'));
        };
        script.onerror = () => reject(new Error('Falha ao carregar Quagga.'));
        document.body.appendChild(script);
      });
    }

    await this.scriptLoadPromise;
  }

  private normalizeBoletoNumber(rawValue: string): string {
    return rawValue.replace(/\D/g, '');
  }

  private isLikelyBoleto(digitsOnly: string): boolean {
    return digitsOnly.length === 44 || digitsOnly.length === 47 || digitsOnly.length === 48;
  }

  private extractCandidateDigits(digitsOnly: string): string {
    if (!digitsOnly) {
      return '';
    }
    if (this.isLikelyBoleto(digitsOnly)) {
      return digitsOnly;
    }
    // Quando vem ruído, prioriza maior janela possível (48 > 47 > 44).
    if (digitsOnly.length > 48) {
      for (const n of [48, 47, 44]) {
        for (let i = 0; i + n <= digitsOnly.length; i += 1) {
          const part = digitsOnly.slice(i, i + n);
          if (this.isLikelyBoleto(part)) {
            return part;
          }
        }
      }
    }
    return '';
  }

  private scoreCandidate(candidate: string, apiCode: string): number {
    // Prioriza mais dígitos capturados e, em empate, código API válido (44).
    return candidate.length * 10 + (apiCode.length === 44 ? 5 : 0);
  }

  private scheduleFinalizeDetection(): void {
    if (this.settleTimer != null) {
      return;
    }
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      void this.finalizeBestDetection();
    }, 280);
  }

  private async finalizeBestDetection(): Promise<void> {
    if (this.suppressDetections) {
      return;
    }
    const best = this.bestCandidateDigits;
    if (!best) {
      return;
    }
    const apiCode = normalizarCodigoBarrasParaApi(best);
    const elapsed = this.firstCandidateAtMs > 0 ? Date.now() - this.firstCandidateAtMs : 0;
    const hasStable44 = apiCode.length === 44 && this.stableReads >= 2;
    const hasTimed44 = apiCode.length === 44 && elapsed >= 1200;
    if (!hasStable44 && !hasTimed44) {
      if (elapsed >= 900) {
        this.statusMessage = 'Aproxime mais o boleto para capturar todos os dígitos.';
      }
      this.scheduleFinalizeDetection();
      return;
    }

    this.suppressDetections = true;
    await this.onCodeDetected(apiCode);
  }

  private async onCodeDetected(normalizedCode: string): Promise<void> {
    this.scanState = 'success';
    this.detectedCode = normalizedCode;
    this.statusMessage = 'Codigo de barras lido com sucesso.';
    this.stopScanner();
    await this.screenOrientation.lockPortrait();
    await this.router.navigate(['/boleto-payment-details'], {
      state: { barcode: normalizedCode, source: 'scan' },
    });
  }

  private stopScanner(): void {
    if (this.settleTimer != null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.quagga) {
      this.quagga.offDetected(this.onDetectedHandler);
      try {
        this.quagga.stop();
      } catch {
        // Ignore stop errors when scanner was not fully initialized.
      }
    }
  }

  /**
   * Tenta melhorar foco/zoom no navegador (quando suportado pela câmera).
   * Em muitos devices isso é ignorado, então o fluxo continua normalmente.
   */
  private async tryImproveCameraFocus(): Promise<void> {
    const video = this.scannerViewport?.nativeElement?.querySelector('video');
    const stream = video?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) {
      return;
    }

    try {
      const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
      const advanced: Record<string, unknown> = {};

      if (Array.isArray(caps['focusMode']) && caps['focusMode'].includes('continuous')) {
        advanced['focusMode'] = 'continuous';
      }
      if (typeof caps['zoom'] === 'object' && caps['zoom'] != null) {
        const z = caps['zoom'] as { min?: number; max?: number };
        if (typeof z.min === 'number' && typeof z.max === 'number') {
          advanced['zoom'] = (z.min + z.max) / 2;
        }
      }
      if (Object.keys(advanced).length === 0) {
        return;
      }
      await track.applyConstraints({ advanced: [advanced] });
    } catch {
      // Browser/câmera sem suporte a controles avançados.
    }
  }

}
