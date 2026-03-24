import { Component, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-depositar',
  templateUrl: './depositar.page.html',
  styleUrls: ['./depositar.page.scss'],
  standalone: false,
})
export class DepositarPage {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  /** Mock — substituir por API */
  readonly pixKey1 = '289HD8GH2-0NS72HDW0-08DB7GAQ';
  readonly pixKey2 = 'PDOMD028D-W028DHA72-DMXJABD';

  goBack(): void {
    this.navController.back();
  }

  async copyKey(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      const toast = await this.toastController.create({
        message: 'Chave PIX copiada',
        duration: 1800,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await this.toastController.create({
        message: 'Não foi possível copiar. Tente selecionar manualmente.',
        duration: 2500,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
    }
  }

  async onCreateNewKey(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Criar nova chave PIX em breve',
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }
}
