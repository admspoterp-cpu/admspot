import { Component, OnInit, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

export interface BoletoPaymentSuccessNavState {
  amountFormatted?: string;
  beneficiary?: string;
  barcode?: string;
  qrPayload?: string;
}

@Component({
  selector: 'app-boleto-payment-success',
  templateUrl: './boleto-payment-success.page.html',
  styleUrls: ['./boleto-payment-success.page.scss'],
  standalone: false,
})
export class BoletoPaymentSuccessPage implements OnInit {
  /** Valor exibido após "R$" (ex.: 1.000,00). */
  amountFormatted = '10.000,00';
  beneficiary = 'CPFLEnergia';

  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  ngOnInit(): void {
    const state = history.state as BoletoPaymentSuccessNavState;
    if (state?.amountFormatted) {
      this.amountFormatted = state.amountFormatted;
    }
    if (state?.beneficiary) {
      this.beneficiary = state.beneficiary;
    }
  }

  goBack(): void {
    void this.navController.navigateRoot('/dashboard');
  }

  async shareReceipt(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Compartilhar recibo em breve.',
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }

  async downloadReceipt(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Download do recibo em breve.',
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }
}
