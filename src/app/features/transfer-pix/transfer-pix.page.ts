import { Component, inject } from '@angular/core';
import { ActionSheetController, NavController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-transfer-pix',
  templateUrl: './transfer-pix.page.html',
  styleUrls: ['./transfer-pix.page.scss'],
  standalone: false,
})
export class TransferPixPage {
  private readonly navController = inject(NavController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly toastController = inject(ToastController);

  readonly accountName = 'Admspot Ltda';
  readonly amountReais = 'R$';
  readonly amountValue = '20.000,00';

  pixKey = '';
  keyType: string = 'CPF';

  private readonly keyTypes = ['CPF', 'E-mail', 'Telefone', 'Chave aleatória'] as const;

  goBack(): void {
    this.navController.back();
  }

  async pickKeyType(): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: 'Tipo de chave',
      buttons: [
        ...this.keyTypes.map((t) => ({
          text: t,
          handler: () => {
            this.keyType = t;
          },
        })),
        {
          text: 'Cancelar',
          role: 'cancel',
        },
      ],
    });
    await sheet.present();
  }

  async onContinue(): Promise<void> {
    const key = this.pixKey.trim();
    if (!key) {
      const toast = await this.toastController.create({
        message: 'Informe a chave PIX',
        duration: 2000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    await this.navController.navigateForward('/pay-transfer-pix', {
      state: { pixKey: key, keyType: this.keyType },
    });
  }
}
