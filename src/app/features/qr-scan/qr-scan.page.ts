import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  selector: 'app-qr-scan',
  templateUrl: './qr-scan.page.html',
  styleUrls: ['./qr-scan.page.scss'],
  standalone: false,
})
export class QrScanPage implements OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  cameraAllowed = false;
  uploadState: UploadState = 'idle';
  detectedCode = '';
  statusMessage = 'Aponte a camera para o QR Code';

  private stream?: MediaStream;
  private scanFrameId?: number;
  private simulationTimeout?: ReturnType<typeof setTimeout>;
  private readonly navController = inject(NavController);

  async ionViewDidEnter(): Promise<void> {
    await this.startScanner();
  }

  ionViewWillLeave(): void {
    this.stopScanner();
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  goBack(): void {
    this.navController.navigateBack('/dashboard');
  }

  async requestCameraAccess(): Promise<void> {
    await this.startScanner();
  }

  async restartScanner(): Promise<void> {
    this.stopScanner();
    this.uploadState = 'idle';
    this.detectedCode = '';
    this.statusMessage = 'Aponte a camera para o QR Code';
    await this.startScanner();
  }

  async startScanner(): Promise<void> {
    this.stopScanner();
    this.uploadState = 'idle';
    this.detectedCode = '';
    this.statusMessage = 'Aponte a camera para o QR Code';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraAllowed = false;
      this.uploadState = 'error';
      this.statusMessage = 'Camera nao suportada neste dispositivo.';
      return;
    }

    try {
      const permissionState = await this.getBrowserCameraPermissionState();
      if (permissionState === 'denied') {
        this.cameraAllowed = false;
        this.uploadState = 'error';
        this.statusMessage = 'Permissao da camera bloqueada. Habilite o acesso nas configuracoes do app.';
        return;
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      this.cameraAllowed = true;
      const video = this.videoElement?.nativeElement;
      if (!video) {
        return;
      }

      video.srcObject = this.stream;
      await video.play();
      this.startDetection(video);
    } catch {
      this.cameraAllowed = false;
      this.uploadState = 'error';
      this.statusMessage = 'Permissao da camera negada. Toque para tentar novamente.';
    }
  }

  private async getBrowserCameraPermissionState(): Promise<PermissionState | 'unknown'> {
    const permissionApi = navigator.permissions;
    if (!permissionApi?.query) {
      return 'unknown';
    }

    try {
      const status = await permissionApi.query({
        name: 'camera' as PermissionName,
      });
      return status.state;
    } catch {
      return 'unknown';
    }
  }

  private startDetection(video: HTMLVideoElement): void {
    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: new (config?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    if (BarcodeDetectorCtor) {
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const scan = async (): Promise<void> => {
        if (this.uploadState === 'uploading' || this.uploadState === 'success') {
          return;
        }

        try {
          const found = await detector.detect(video);
          if (found.length > 0 && found[0].rawValue) {
            await this.onCodeDetected(found[0].rawValue);
            return;
          }
        } catch {
          // Keep trying frame by frame.
        }

        this.scanFrameId = requestAnimationFrame(() => {
          void scan();
        });
      };

      void scan();
      return;
    }

    // Fallback for environments without BarcodeDetector.
    this.statusMessage = 'Leitura automatica indisponivel. Simulando deteccao...';
    this.simulationTimeout = setTimeout(() => {
      void this.onCodeDetected('QR_SIMULADO_001');
    }, 2500);
  }

  private async onCodeDetected(rawValue: string): Promise<void> {
    if (this.uploadState === 'uploading' || this.uploadState === 'success') {
      return;
    }

    this.uploadState = 'uploading';
    this.detectedCode = rawValue;
    this.statusMessage = 'QR detectado. Capturando foto e enviando...';

    const imageBlob = await this.captureFrameBlob();
    if (!imageBlob) {
      this.uploadState = 'error';
      this.statusMessage = 'Falha ao capturar imagem da camera.';
      return;
    }

    this.stopScanner();
    await this.simulateUpload(imageBlob, rawValue);
    this.uploadState = 'success';
    this.statusMessage = 'Leitura concluida e imagem enviada (simulacao).';
  }

  private async captureFrameBlob(): Promise<Blob | null> {
    const video = this.videoElement?.nativeElement;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }

  private async simulateUpload(imageBlob: Blob, qrCode: string): Promise<void> {
    const fakePayload = {
      qrCode,
      imageBytes: imageBlob.size,
      mimeType: imageBlob.type || 'image/jpeg',
      endpoint: '/api/payments/qr/upload',
    };

    await new Promise((resolve) => setTimeout(resolve, 1200));
    console.log('Simulated upload payload:', fakePayload);
  }

  private stopScanner(): void {
    if (this.scanFrameId !== undefined) {
      cancelAnimationFrame(this.scanFrameId);
      this.scanFrameId = undefined;
    }

    if (this.simulationTimeout) {
      clearTimeout(this.simulationTimeout);
      this.simulationTimeout = undefined;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
    }
  }
}
