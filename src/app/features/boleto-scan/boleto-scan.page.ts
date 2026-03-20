import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

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
  private readonly onDetectedHandler = (result: QuaggaDetectedResult): void => {
    const raw = result.codeResult?.code ?? '';
    const normalized = this.normalizeBoletoNumber(raw);
    if (!this.isLikelyBoleto(normalized)) {
      return;
    }

    this.onCodeDetected(normalized);
  };
  private readonly navController = inject(NavController);

  async ionViewDidEnter(): Promise<void> {
    await this.lockLandscape();
    await this.startScanner();
  }

  async ionViewWillLeave(): Promise<void> {
    this.stopScanner();
    await this.unlockOrientation();
  }

  async ngOnDestroy(): Promise<void> {
    this.stopScanner();
    await this.unlockOrientation();
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
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            area: {
              top: '34%',
              right: '12%',
              left: '12%',
              bottom: '34%',
            },
          },
          decoder: {
            readers: ['i2of5_reader', 'code_128_reader', 'code_39_reader'],
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

  private onCodeDetected(normalizedCode: string): void {
    this.scanState = 'success';
    this.detectedCode = normalizedCode;
    this.statusMessage = 'Codigo de barras lido com sucesso.';
    window.dispatchEvent(
      new CustomEvent('boleto-scanned', {
        detail: {
          barcode: this.detectedCode,
        },
      })
    );
    this.stopScanner();
  }

  private stopScanner(): void {
    if (this.quagga) {
      this.quagga.offDetected(this.onDetectedHandler);
      try {
        this.quagga.stop();
      } catch {
        // Ignore stop errors when scanner was not fully initialized.
      }
    }
  }

  private async lockLandscape(): Promise<void> {
    const screenOrientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape') => Promise<void>;
    };
    if (!screenOrientation?.lock) {
      return;
    }

    try {
      await screenOrientation.lock('landscape');
    } catch {
      // Some WebViews require fullscreen or do not allow lock.
    }
  }

  private async unlockOrientation(): Promise<void> {
    const screenOrientation = screen.orientation as ScreenOrientation & {
      unlock?: () => void;
    };
    try {
      screenOrientation?.unlock?.();
    } catch {
      // Ignore unlock failures.
    }
  }
}
