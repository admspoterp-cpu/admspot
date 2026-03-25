import { Component, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

const ASSET =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

@Component({
  selector: 'app-cartao-novo',
  templateUrl: './cartao-novo.page.html',
  styleUrls: ['./cartao-novo.page.scss'],
  standalone: false,
})
export class CartaoNovoPage {
  readonly assetBase = ASSET;

  form = {
    holderLabel: '',
    expiry: '',
    cvv: '',
    panDisplay: '',
  };

  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  goBack(): void {
    this.navController.back();
  }

  async salvar(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Cartão criado com sucesso',
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
    this.navController.back();
  }
}
