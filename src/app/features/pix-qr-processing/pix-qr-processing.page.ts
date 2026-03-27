import { Component, OnInit, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

import { AuthSessionService } from '../../services/auth-session.service';
import { PixQrDecodeService } from '../../services/pix-qr-decode.service';

type PixQrProcessingNavState = {
  qrPayload?: string;
};

@Component({
  selector: 'app-pix-qr-processing',
  templateUrl: './pix-qr-processing.page.html',
  styleUrls: ['./pix-qr-processing.page.scss'],
  standalone: false,
})
export class PixQrProcessingPage implements OnInit {
  statusText = 'Processando QR Code...';

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly authSession = inject(AuthSessionService);
  private readonly pixQrDecode = inject(PixQrDecodeService);

  ngOnInit(): void {
    void this.processPayload();
  }

  private async processPayload(): Promise<void> {
    const state = history.state as PixQrProcessingNavState;
    const payload = (state?.qrPayload ?? '').trim();
    if (!payload) {
      await this.presentToast('QR inválido. Tente novamente.', 'warning');
      await this.navController.navigateBack('/qr-scan');
      return;
    }

    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    if (!access || !sourceToken) {
      await this.presentToast('Sessão ou carteira inválida. Faça login novamente.', 'warning');
      await this.navController.navigateRoot('/dashboard');
      return;
    }

    const data = await this.pixQrDecode.decode(access, sourceToken, payload);
    if (!data) {
      await this.presentToast('Não foi possível processar o QR Code agora.', 'danger');
      await this.navController.navigateBack('/qr-scan');
      return;
    }
    if (data.success !== true) {
      await this.presentToast(data.message?.trim() || 'QR Code inválido ou indisponível.', 'warning');
      await this.navController.navigateBack('/qr-scan');
      return;
    }

    this.statusText = 'Abrindo detalhes do pagamento...';
    await this.router.navigate(['/pix-qr-payment-details'], {
      state: {
        qrPayload: payload,
        decodeData: data,
      },
    });
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
