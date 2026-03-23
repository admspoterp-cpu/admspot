import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { ActionSheetController, NavController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage {
  @ViewChild('galleryFileInput') galleryFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('documentFileInput') documentFileInput?: ElementRef<HTMLInputElement>;

  balanceHidden = false;
  activeTab: 'Home' | 'Send' | 'Pagar' | 'Cards' | 'More' = 'Home';
  paymentSheetOpen = false;
  transferSheetOpen = false;
  selectedChargeFileName = '';

  /** Mock favoritos — alinhar com API depois */
  readonly transferFavorites: { initials: string; name: string; bank: string }[] = [
    { initials: 'LP', name: 'Luiz Fernando Henrique', bank: 'NU PAGAMENTOS - IP' },
    { initials: 'AL', name: 'Ana Luiza Pinto', bank: 'NU PAGAMENTOS - IP' },
  ];
  private readonly navController = inject(NavController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly toastController = inject(ToastController);

  toggleBalance(): void {
    this.balanceHidden = !this.balanceHidden;
  }

  setActiveTab(tab: 'Home' | 'Send' | 'Pagar' | 'Cards' | 'More'): void {
    this.activeTab = tab;
    if (tab !== 'Pagar') {
      this.paymentSheetOpen = false;
    }
    this.transferSheetOpen = false;
  }

  openPaymentSheet(): void {
    this.activeTab = 'Pagar';
    this.transferSheetOpen = false;
    this.paymentSheetOpen = true;
  }

  closePaymentSheet(): void {
    this.paymentSheetOpen = false;
  }

  openTransferSheet(): void {
    this.paymentSheetOpen = false;
    this.transferSheetOpen = true;
  }

  closeTransferSheet(): void {
    this.transferSheetOpen = false;
  }

  closeOverlaySheets(): void {
    this.closePaymentSheet();
    this.closeTransferSheet();
  }

  goToQrScanner(): void {
    this.closeOverlaySheets();
    this.navController.navigateForward('/qr-scan');
  }

  goToBoletoScanner(): void {
    this.closeOverlaySheets();
    this.navController.navigateForward('/boleto-scan');
  }

  onTransferPixTap(): void {
    this.closeTransferSheet();
    void this.navController.navigateForward('/transfer-pix');
  }

  onTransferTedTap(): void {
    this.closeTransferSheet();
    void this.navController.navigateForward('/transfer-ted');
  }

  async onTransferFavoriteTap(contact: { name: string }): Promise<void> {
    await this.showTransferComingSoon(contact.name);
  }

  private async showTransferComingSoon(label: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `${label}: fluxo em breve`,
      duration: 1600,
      position: 'bottom',
    });
    await toast.present();
  }

  async openChargeFilePickerOptions(): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header: 'Enviar cobranca',
      buttons: [
        {
          text: 'Galeria',
          icon: 'images-outline',
          handler: () => {
            this.openFilePicker(this.galleryFileInput);
          },
        },
        {
          text: 'Documento',
          icon: 'document-text-outline',
          handler: () => {
            this.openFilePicker(this.documentFileInput);
          },
        },
        {
          text: 'Cancelar',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async onChargeFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.selectedChargeFileName = file.name;
    const toast = await this.toastController.create({
      message: `Arquivo selecionado: ${file.name}`,
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();

    // Reset value to allow selecting the same file again.
    input.value = '';
  }

  private openFilePicker(inputRef?: ElementRef<HTMLInputElement>): void {
    const input = inputRef?.nativeElement;
    if (!input) {
      return;
    }

    // Allow selecting the same file consecutively.
    input.value = '';

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // Fallback below for WebViews without showPicker support.
    }

    input.click();
  }
}
