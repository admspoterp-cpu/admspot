import { Component, OnInit, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';

export interface TedTransferInfoNavState {
  agency?: string;
  accountWithDigit?: string;
  accountType?: string;
  bankName?: string;
  recipientName?: string;
  recipientDocument?: string;
}

@Component({
  selector: 'app-transfer-ted-info',
  templateUrl: './transfer-ted-info.page.html',
  styleUrls: ['../pay-transfer-pix/pay-transfer-pix.page.scss', './transfer-ted-info.page.scss'],
  standalone: false,
})
export class TransferTedInfoPage implements OnInit {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  readonly accountName = 'Admspot Ltda';
  readonly amountReais = 'R$';
  readonly balanceValue = '20.000,00';

  /** Exibido como subtítulo no card (mock: NU PAGAMENTO - IP) */
  bankSubtitle = 'NU PAGAMENTO - IP';
  recipientName = 'Fernando Pedro de Souza';
  /** Do formulário TED — usado no comprovante / PDF */
  recipientDocument = '';

  transferAmount = '5.000,00';
  observation = 'Segue o valor do aluguel';

  readonly feeCurrency = 'R$';
  readonly feeValue = '2,50';

  ngOnInit(): void {
    const s = history.state as TedTransferInfoNavState & Record<string, unknown>;
    if (typeof s?.bankName === 'string' && s.bankName.trim()) {
      this.bankSubtitle = this.formatBankSubtitle(s.bankName.trim());
    }
    if (typeof s?.recipientName === 'string' && s.recipientName.trim()) {
      this.recipientName = s.recipientName.trim();
    }
    if (typeof s?.recipientDocument === 'string' && s.recipientDocument.trim()) {
      this.recipientDocument = s.recipientDocument.trim();
    }
  }

  goBack(): void {
    this.navController.back();
  }

  /** Volta para a etapa de dados da TED (main transfer_TED). */
  onMudar(): void {
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
      beneficiaryName: this.recipientName,
      beneficiaryBank: this.bankSubtitle,
      documentMasked: this.maskDocumentForReceipt(this.recipientDocument),
      transferKind: 'ted',
    };

    await this.navController.navigateForward('/comprovante-payment', { state });
  }

  /** Máscara simples para o comprovante (mesmo padrão visual do PIX) */
  private maskDocumentForReceipt(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 11) {
      return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    }
    if (digits.length >= 4) {
      return `***.${digits.slice(-4)}`;
    }
    return '***.***.***-**';
  }

  /** Aproxima o texto do mock quando o banco é NU */
  private formatBankSubtitle(bank: string): string {
    if (bank.toUpperCase().includes('NU PAGAMENTOS')) {
      return 'NU PAGAMENTO - IP';
    }
    return bank;
  }
}
