import { Component, OnInit, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';

/** Estado enviado por `transfer-pix` via `navigateForward(..., { state })` */
export interface PayTransferPixNavState {
  pixKey?: string;
  keyType?: string;
}

@Component({
  selector: 'app-pay-transfer-pix',
  templateUrl: './pay-transfer-pix.page.html',
  styleUrls: ['./pay-transfer-pix.page.scss'],
  standalone: false,
})
export class PayTransferPixPage implements OnInit {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  /** Da etapa anterior (chave informada) */
  pixKey = '';
  keyType = '';

  readonly accountName = 'Admspot Ltda';
  readonly amountReais = 'R$';
  readonly balanceValue = '20.000,00';

  /** Destinatário — mock; substituir por resolução de chave na API */
  readonly beneficiaryName = 'Fernando Pedro de Souza';
  readonly beneficiaryBank = 'NU PAGAMENTO - IP';
  readonly documentMasked = '***.898.898-**';

  transferAmount = '5.000,00';
  observation = 'Segue o valor do aluguel';

  readonly feeCurrency = 'R$';
  readonly feeValue = '0,40';

  ngOnInit(): void {
    const s = history.state as PayTransferPixNavState & Record<string, unknown>;
    if (typeof s?.pixKey === 'string') {
      this.pixKey = s.pixKey;
    }
    if (typeof s?.keyType === 'string') {
      this.keyType = s.keyType;
    }
  }

  goBack(): void {
    this.navController.back();
  }

  async onPay(): Promise<void> {
    const amount = this.transferAmount.trim();
    if (!amount) {
      const toast = await this.toastController.create({
        message: 'Informe o valor da transferência',
        duration: 2000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const state: ComprovantePaymentNavState = {
      amountDisplay: amount,
      beneficiaryName: this.beneficiaryName,
      beneficiaryBank: this.beneficiaryBank,
      documentMasked: this.documentMasked,
      pixKey: this.pixKey,
    };

    await this.navController.navigateForward('/comprovante-payment', { state });
  }
}
