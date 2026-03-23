import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';

export interface PixQrPaymentDetailsNavState {
  qrPayload?: string;
}

@Component({
  selector: 'app-pix-qr-payment-details',
  templateUrl: './pix-qr-payment-details.page.html',
  styleUrls: ['./pix-qr-payment-details.page.scss'],
  standalone: false,
})
export class PixQrPaymentDetailsPage implements OnInit {
  /** Conteúdo bruto lido do QR (ex.: copia-e-cola PIX). Exibido em Identificador. */
  qrPayload = '';

  amountCurrency = 'R$';
  amountValue = '1.000,00';
  payeeShort = 'CPFLEnergia';

  institutionLabel = 'Instituição';
  institutionName = 'NU PAGAMENTOS - IP';

  beneficiaryLabel = 'Para / beneficiário';
  beneficiaryName = 'Cpfl Cia Paulista D Forca Luz';

  documentLabel = 'Documento';
  documentValue = '18.236.120/0001-50';

  messageLabel = 'Mensagem';
  messageValue = 'mensagem observação';

  identifierLabel = 'Identificador';

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const state = history.state as PixQrPaymentDetailsNavState;
    const raw = (state?.qrPayload ?? '').trim();
    this.qrPayload = raw;

    if (!raw) {
      void this.navController.navigateRoot('/dashboard');
    }
  }

  goBack(): void {
    this.navController.navigateBack('/qr-scan');
  }

  onPay(): void {
    void this.router.navigate(['/boleto-payment-success'], {
      state: {
        amountFormatted: this.amountValue,
        beneficiary: this.payeeShort,
        qrPayload: this.qrPayload,
      },
    });
  }
}
