import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, NavController, ToastController } from '@ionic/angular';

import { AppScreenOrientationService } from '../../services/app-screen-orientation.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { ScanCodesService, type ScanCodesData } from '../../services/scan-codes.service';
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
  /** Definido após GET `/scan-code-mode` (fallback: SCAN_ONLY). */
  scanMode: 'SCAN_ONLY' | 'SCAN_BY_ZIMAGE' | 'SCAN_BY_ZIMAGE_QUICK' = 'SCAN_ONLY';

  private scriptLoadPromise?: Promise<void>;
  private quagga?: QuaggaGlobal;
  /** Só para `SCAN_BY_ZIMAGE_QUICK`: evita múltiplos envios. */
  private quickCaptureTriggered = false;
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

    /** Primeiro dígito decodificado → captura + API imediata (sem esperar 44 estável). */
    if (this.scanMode === 'SCAN_BY_ZIMAGE_QUICK' && !this.quickCaptureTriggered && digitsOnly.length >= 1) {
      this.quickCaptureTriggered = true;
      this.suppressDetections = true;
      if (this.settleTimer != null) {
        clearTimeout(this.settleTimer);
        this.settleTimer = null;
      }
      const backup = this.quickBackupFromDigits(digitsOnly);
      void this.onCodeDetectedZImage(backup, { quick: true });
      return;
    }

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
  private readonly authSession = inject(AuthSessionService);
  private readonly scanCodesService = inject(ScanCodesService);
  private readonly loadingController = inject(LoadingController);
  private readonly toastController = inject(ToastController);

  async ionViewDidEnter(): Promise<void> {
    await this.screenOrientation.lockLandscape();

    const access = this.authSession.getAccessToken();
    if (!access) {
      await this.presentToast('Sessão inválida. Faça login novamente.', 'warning');
      await this.navController.navigateRoot('/dashboard');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Carregando leitor…',
      spinner: 'crescent',
    });
    await loading.present();
    const modeRes = await this.scanCodesService.getScanCodeMode(access);
    await loading.dismiss();

    if (modeRes?.success === true) {
      if (modeRes.scan_options === 'SCAN_BY_ZIMAGE_QUICK') {
        this.scanMode = 'SCAN_BY_ZIMAGE_QUICK';
      } else if (modeRes.scan_options === 'SCAN_BY_ZIMAGE') {
        this.scanMode = 'SCAN_BY_ZIMAGE';
      } else {
        this.scanMode = 'SCAN_ONLY';
      }
    } else {
      this.scanMode = 'SCAN_ONLY';
    }

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
    this.quickCaptureTriggered = false;
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

      const useHighResCamera =
        this.scanMode === 'SCAN_BY_ZIMAGE' || this.scanMode === 'SCAN_BY_ZIMAGE_QUICK';
      const videoConstraints: MediaTrackConstraints = useHighResCamera
        ? {
            facingMode: 'environment',
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          }
        : {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };

      this.quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: this.scannerViewport.nativeElement,
            constraints: videoConstraints,
            area: {
              top: '31%',
              right: '10%',
              left: '10%',
              bottom: '31%',
            },
          },
          decoder: {
            // Reduz symbologies para diminuir ruído e falso-positivo.
            readers: ['i2of5_reader', '2of5_reader', 'code_128_reader'],
          },
          locator: {
            patchSize: 'medium',
            halfSample: true,
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

  /** Fallback local no modo rápido, só quando já há 44/47/48 dígitos na leitura parcial. */
  private quickBackupFromDigits(digitsOnly: string): string {
    const c = this.extractCandidateDigits(digitsOnly);
    if (!c) {
      return '';
    }
    return normalizarCodigoBarrasParaApi(c);
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
    // Não reinicia a janela o tempo todo para evitar loop infinito sem decisão.
    if (this.settleTimer != null) {
      return;
    }
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      void this.finalizeBestDetection();
    }, 260);
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
    const isStable44 = apiCode.length === 44 && this.stableReads >= 2;
    const isTimed44 = apiCode.length === 44 && elapsed >= 1000;
    if (!isStable44 && !isTimed44) {
      if (elapsed >= 900) {
        this.statusMessage = 'Aproxime mais o boleto para capturar todos os dígitos.';
      }
      this.scheduleFinalizeDetection();
      return;
    }

    this.suppressDetections = true;
    if (this.scanMode === 'SCAN_BY_ZIMAGE') {
      await this.onCodeDetectedZImage(apiCode);
      return;
    }
    await this.onCodeDetected(apiCode);
  }

  /**
   * Captura frame JPEG, envia a `/reader/scan-codes` e prioriza `data.barcodes`.
   * `quick`: disparado no primeiro dígito (SCAN_BY_ZIMAGE_QUICK), sem esperar código estável.
   */
  private async onCodeDetectedZImage(
    backupNormalizedCode: string,
    options?: { quick?: boolean },
  ): Promise<void> {
    const quick = options?.quick === true;
    this.scanState = 'success';
    this.statusMessage = quick ? 'Enviando imagem…' : 'Capturando imagem nitida…';
    const file = await this.captureVideoFrameAsJpegFile();
    this.stopScanner();
    await this.screenOrientation.lockPortrait();

    const access = this.authSession.getAccessToken();
    let barcode = backupNormalizedCode;

    if (file && access) {
      const loading = await this.loadingController.create({
        message: quick ? 'Processando…' : 'Processando imagem no servidor…',
        spinner: 'crescent',
      });
      await loading.present();
      const result = await this.scanCodesService.scanCodes(access, file);
      await loading.dismiss();

      if (result?.success === true && result.data) {
        const fromApi = this.firstBarcodeFromScanData(result.data);
        if (fromApi) {
          barcode = normalizarCodigoBarrasParaApi(fromApi);
        } else {
          await this.presentToast(
            'Leitura do servidor sem código de barras; usando leitura da câmera.',
            'warning',
          );
        }
      } else {
        await this.presentToast(
          (result?.message ?? 'Não foi possível processar a imagem. Usando leitura da câmera.').trim(),
          'warning',
        );
      }
    } else if (!file) {
      await this.presentToast('Não foi possível capturar a foto; usando leitura da câmera.', 'warning');
    }

    const barcodeDigits = barcode.replace(/\D/g, '');
    if (!barcodeDigits) {
      await this.presentToast('Não foi possível identificar o boleto. Tente novamente.', 'warning');
      await this.screenOrientation.lockLandscape();
      await this.restartScanner();
      return;
    }

    this.detectedCode = barcode;
    this.statusMessage = 'Codigo de barras lido com sucesso.';
    await this.router.navigate(['/boleto-payment-details'], {
      state: { barcode, source: 'scan' },
    });
  }

  private firstBarcodeFromScanData(data: ScanCodesData): string {
    const list = data.barcodes;
    if (!Array.isArray(list) || list.length === 0) {
      return '';
    }
    const raw = list.find((b) => (b ?? '').trim().length > 0);
    return (raw ?? '').trim();
  }

  private async captureVideoFrameAsJpegFile(): Promise<File | null> {
    const video = this.scannerViewport?.nativeElement?.querySelector('video') as HTMLVideoElement | null;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(new File([blob], 'boleto-barcode.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    });
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
   * Tenta foco contínuo e zoom moderado sem forçar desfoque.
   * Só aplica quando o device/browser suporta os controles.
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
          // Zoom leve para não perder foco na lente wide.
          const zoom = Math.min(z.max, Math.max(z.min, z.min + (z.max - z.min) * 0.22));
          advanced['zoom'] = zoom;
        }
      }
      if (Object.keys(advanced).length > 0) {
        await track.applyConstraints({ advanced: [advanced] });
      }
    } catch {
      // Sem suporte — continua com parâmetros padrão.
    }
  }

  private async presentToast(message: string, color: 'warning' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2800,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

}
