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
  notificationsSheetOpen = false;
  recargaSheetOpen = false;
  selectedChargeFileName = '';
  recargaPhone = '(00) 00000-0000';
  selectedRecargaAmount = 50;
  selectedRecargaOperator = 'VIVO';

  readonly recargaOperators: ReadonlyArray<{ name: string; image: string }> = [
    { name: 'VIVO', image: 'assets/recarga-operadoras/VIVO.webp' },
    { name: 'TIM', image: 'assets/recarga-operadoras/TIM.webp' },
    { name: 'CLARO', image: 'assets/recarga-operadoras/CLARO.webp' },
    { name: 'OI', image: 'assets/recarga-operadoras/OI.webp' },
  ];
  readonly recargaAmountOptions: ReadonlyArray<number> = [20, 30, 50, 100];

  readonly recargaOperatorSelectInterfaceOptions = { header: 'Operadora', subHeader: 'Selecione a operadora' };

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
    this.notificationsSheetOpen = false;
    this.recargaSheetOpen = false;
  }

  openPaymentSheet(): void {
    this.activeTab = 'Pagar';
    this.transferSheetOpen = false;
    this.notificationsSheetOpen = false;
    this.recargaSheetOpen = false;
    this.paymentSheetOpen = true;
  }

  closePaymentSheet(): void {
    this.paymentSheetOpen = false;
  }

  openTransferSheet(): void {
    this.paymentSheetOpen = false;
    this.notificationsSheetOpen = false;
    this.recargaSheetOpen = false;
    this.transferSheetOpen = true;
  }

  closeTransferSheet(): void {
    this.transferSheetOpen = false;
  }

  openNotificationsSheet(): void {
    this.paymentSheetOpen = false;
    this.transferSheetOpen = false;
    this.recargaSheetOpen = false;
    this.notificationsSheetOpen = true;
  }

  closeNotificationsSheet(): void {
    this.notificationsSheetOpen = false;
  }

  openRecargaSheet(): void {
    this.paymentSheetOpen = false;
    this.transferSheetOpen = false;
    this.notificationsSheetOpen = false;
    this.recargaSheetOpen = true;
  }

  closeRecargaSheet(): void {
    this.recargaSheetOpen = false;
  }

  get selectedRecargaOperatorImage(): string {
    return (
      this.recargaOperators.find((operator) => operator.name === this.selectedRecargaOperator)?.image ??
      this.recargaOperators[0].image
    );
  }

  get selectedRecargaAmountLabel(): string {
    return this.selectedRecargaAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  selectRecargaAmount(amount: number): void {
    this.selectedRecargaAmount = amount;
  }

  closeOverlaySheets(): void {
    this.closePaymentSheet();
    this.closeTransferSheet();
    this.closeNotificationsSheet();
    this.closeRecargaSheet();
  }

  goToQrScanner(): void {
    this.closeOverlaySheets();
    this.navController.navigateForward('/qr-scan');
  }

  goToDepositar(): void {
    this.closeOverlaySheets();
    void this.navController.navigateForward('/depositar');
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



  async onRecargaSubmit(): Promise<void> {
    if (!this.recargaPhone.trim()) {
      const toast = await this.toastController.create({
        message: 'Informe o número com DDD',
        duration: 1800,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const selectedOperator =
      this.recargaOperators.find((operator) => operator.name === this.selectedRecargaOperator) ?? this.recargaOperators[0];

    this.closeRecargaSheet();

    await this.navController.navigateForward('/recarga-success', {
      state: {
        operatorName: selectedOperator.name,
        operatorImage: selectedOperator.image,
        phone: this.recargaPhone.trim(),
        amount: this.selectedRecargaAmount,
      },
    });
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
