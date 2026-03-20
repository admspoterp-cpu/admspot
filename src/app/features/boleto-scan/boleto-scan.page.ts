import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

@Component({
  selector: 'app-boleto-scan',
  templateUrl: './boleto-scan.page.html',
  styleUrls: ['./boleto-scan.page.scss'],
  standalone: false,
})
export class BoletoScanPage implements OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  cameraAllowed = false;
  scanState: ScanState = 'idle';
  detectedCode = '';
  statusMessage = 'Aponte o codigo de barras do boleto para a area de leitura.';

  private stream?: MediaStream;
  private scanFrameId?: number;
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

  async requestCameraAccess(): Promise<void> {
    await this.startScanner();
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
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      this.cameraAllowed = true;
      const video = this.videoElement?.nativeElement;
      if (!video) {
        return;
      }

      video.srcObject = this.stream;
      await video.play();
      await this.startDetection(video);
    } catch {
      this.cameraAllowed = false;
      this.scanState = 'error';
      this.statusMessage = 'Permissao da camera negada. Toque para tentar novamente.';
    }
  }

  private async startDetection(video: HTMLVideoElement): Promise<void> {
    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: new (config?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      this.scanState = 'error';
      this.statusMessage = 'Leitura de codigo de barras indisponivel neste dispositivo.';
      return;
    }

    const requestedFormats = await this.getSupportedBarcodeFormats();
    if (requestedFormats.length === 0) {
      this.scanState = 'error';
      this.statusMessage = 'Seu dispositivo nao suporta leitura de boleto nesta versao.';
      return;
    }

    const detector = new BarcodeDetectorCtor({ formats: requestedFormats });
    const scan = async (): Promise<void> => {
      if (this.scanState === 'success') {
        return;
      }

      try {
        const results = await detector.detect(video);
        const candidate = results.find((item) => this.isLikelyBoleto(item.rawValue ?? ''));
        if (candidate?.rawValue) {
          this.onCodeDetected(candidate.rawValue);
          return;
        }
      } catch {
        // Keep reading frame by frame until code is detected.
      }

      this.scanFrameId = requestAnimationFrame(() => {
        void scan();
      });
    };

    void scan();
  }

  private async getSupportedBarcodeFormats(): Promise<string[]> {
    const preferred = ['itf', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'];
    const api = (window as Window & {
      BarcodeDetector?: {
        getSupportedFormats?: () => Promise<string[]>;
      };
    }).BarcodeDetector;

    if (!api?.getSupportedFormats) {
      return preferred;
    }

    try {
      const supported = await api.getSupportedFormats();
      return preferred.filter((format) => supported.includes(format));
    } catch {
      return preferred;
    }
  }

  private isLikelyBoleto(rawValue: string): boolean {
    const digitsOnly = rawValue.replace(/\D/g, '');
    return digitsOnly.length === 44 || digitsOnly.length === 47 || digitsOnly.length === 48;
  }

  private onCodeDetected(rawValue: string): void {
    this.scanState = 'success';
    this.detectedCode = rawValue.replace(/\s+/g, '');
    this.statusMessage = 'Codigo de barras lido com sucesso.';
    this.stopScanner();
  }

  private stopScanner(): void {
    if (this.scanFrameId !== undefined) {
      cancelAnimationFrame(this.scanFrameId);
      this.scanFrameId = undefined;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
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
