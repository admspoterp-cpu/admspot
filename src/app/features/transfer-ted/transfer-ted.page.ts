import { Component, inject } from '@angular/core';
import { ActionSheetController, NavController, ToastController } from '@ionic/angular';

import type { TedTransferInfoNavState } from '../transfer-ted-info/transfer-ted-info.page';

@Component({
  selector: 'app-transfer-ted',
  templateUrl: './transfer-ted.page.html',
  styleUrls: ['./transfer-ted.page.scss'],
  standalone: false,
})
export class TransferTedPage {
  private readonly navController = inject(NavController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly toastController = inject(ToastController);

  readonly accountName = 'Admspot Ltda';
  readonly amountReais = 'R$';
  readonly amountValue = '20.000,00';

  agency = '2122444522';
  accountWithDigit = '01';
  accountType = 'Conta de pagamento';
  bankName = 'NU PAGAMENTOS - IP';
  recipientName = 'Fernando Pedro de Souza';
  recipientDocument = '325.5457.258 - 40';

  private readonly accountTypes = ['Conta de pagamento', 'Conta corrente', 'Conta poupança'] as const;
  private readonly banks = [
    'NU PAGAMENTOS - IP',
    'Banco do Brasil',
    'Itaú Unibanco',
    'Bradesco',
    'Santander',
  ] as const;

  goBack(): void {
    this.navController.back();
  }

  async pickAccountType(): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: 'Tipo de conta',
      buttons: [
        ...this.accountTypes.map((t) => ({
          text: t,
          handler: () => {
            this.accountType = t;
          },
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async pickBank(): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: 'Banco',
      buttons: [
        ...this.banks.map((b) => ({
          text: b,
          handler: () => {
            this.bankName = b;
          },
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async onContinue(): Promise<void> {
    if (!this.agency.trim() || !this.accountWithDigit.trim()) {
      const toast = await this.toastController.create({
        message: 'Preencha agência e conta',
        duration: 2000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    const state: TedTransferInfoNavState = {
      agency: this.agency.trim(),
      accountWithDigit: this.accountWithDigit.trim(),
      accountType: this.accountType,
      bankName: this.bankName,
      recipientName: this.recipientName.trim(),
      recipientDocument: this.recipientDocument.trim(),
    };

    await this.navController.navigateForward('/transfer-ted-info', { state });
  }
}
