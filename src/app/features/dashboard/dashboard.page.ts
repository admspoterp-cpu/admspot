import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  LoadingController,
  NavController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';

import { BalanceService } from '../../services/balance.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { ScanCodesService } from '../../services/scan-codes.service';
import { formatBrlNumber, normalizeMoneyValue } from '../../utils/brl-format';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements ViewWillEnter {
  @ViewChild('galleryFileInput') galleryFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('documentFileInput') documentFileInput?: ElementRef<HTMLInputElement>;

  balanceHidden = false;
  /** Valor formatado pt-BR (sem "R$"); mock substituído pela API `/balance`. */
  balanceAmountFormatted = '—';
  balanceLoading = false;
  /** Texto da linha "Última atualização…". */
  balanceUpdatedText = '';
  activeTab: 'Home' | 'Send' | 'Pagar' | 'Cards' | 'More' = 'Home';
  paymentSheetOpen = false;
  transferSheetOpen = false;
  notificationsSheetOpen = false;
  recargaSheetOpen = false;
  selectedChargeFileName = '';
  recargaPhone = '';
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
  private readonly router = inject(Router);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);
  private readonly authSession = inject(AuthSessionService);
  private readonly balanceService = inject(BalanceService);
  private readonly scanCodesService = inject(ScanCodesService);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadBalanceFromApi();
  }

  private async loadBalanceFromApi(): Promise<void> {
    const access = this.authSession.getAccessToken();
    if (!access) {
      return;
    }

    const wallet = this.authSession.getDefaultWallet();
    const sourceToken = wallet?.asaas_api_token?.trim();
    if (!sourceToken) {
      this.balanceAmountFormatted = '—';
      this.balanceUpdatedText = 'Saldo indisponível: configure a carteira padrão com conta digital.';
      return;
    }

    this.balanceLoading = true;
    this.balanceUpdatedText = 'Atualizando saldo…';

    const data = await this.balanceService.fetchBalance(access, sourceToken);
    this.balanceLoading = false;

    if (!data || data.success !== true) {
      this.balanceAmountFormatted = '—';
      this.balanceUpdatedText = 'Não foi possível carregar o saldo.';
      return;
    }

    const raw =
      data.balance !== undefined && data.balance !== null
        ? data.balance
        : data.asaas?.balance;
    if (raw === undefined || raw === null) {
      this.balanceAmountFormatted = '—';
      this.balanceUpdatedText = 'Saldo não informado pela API.';
      return;
    }

    const amount = normalizeMoneyValue(raw);
    this.balanceAmountFormatted = formatBrlNumber(amount);
    const now = new Date();
    this.balanceUpdatedText = `Atualizado às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  /** Nome gravado no login junto com o token (`first_name` + `last_name`). */
  get greetingLine(): string {
    const user = this.authSession.getUser();
    if (!user) {
      return 'Olá!';
    }
    const first = (user.first_name ?? '').trim();
    const last = (user.last_name ?? '').trim();
    const name = [first, last].filter((p) => p.length > 0).join(' ');
    return name ? `Olá, ${name}!` : 'Olá!';
  }

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

  onRecargaPhoneFocus(): void {
    const digits = this.recargaPhone.replace(/\D/g, '');
    if (digits === '00000000000' || this.recargaPhone.trim() === '(00) 00000-0000') {
      this.recargaPhone = '';
    }
  }

  onRecargaPhoneModelChange(raw: string): void {
    this.recargaPhone = this.formatBrazilMobilePhone(raw);
  }

  /** Máscara celular BR: (00) 00000-0000 (11 dígitos) */
  private formatBrazilMobilePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (!digits.length) {
      return '';
    }
    if (digits.length <= 2) {
      return `(${digits}`;
    }
    const afterDdd = digits.slice(2);
    if (afterDdd.length <= 5) {
      return `(${digits.slice(0, 2)}) ${afterDdd}`;
    }
    return `(${digits.slice(0, 2)}) ${afterDdd.slice(0, 5)}-${afterDdd.slice(5)}`;
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

  goToCartoes(): void {
    this.activeTab = 'Cards';
    this.closeOverlaySheets();
    void this.navController.navigateForward('/cartoes');
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
    const digits = this.recargaPhone.replace(/\D/g, '');
    if (digits.length !== 11) {
      const toast = await this.toastController.create({
        message: 'Informe o celular completo com DDD (11 dígitos)',
        duration: 2200,
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

    // Reset value to allow selecting the same file again.
    input.value = '';

    const access = this.authSession.getAccessToken();
    if (!access) {
      const toast = await this.toastController.create({
        message: 'Sessão expirada. Faça login novamente.',
        duration: 2400,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Enviando arquivo…',
      spinner: 'crescent',
    });
    await loading.present();

    let result;
    try {
      result = await this.scanCodesService.scanCodes(access, file);
    } finally {
      await loading.dismiss();
    }

    if (!result) {
      const toast = await this.toastController.create({
        message: 'Não foi possível enviar o arquivo. Verifique a conexão e tente novamente.',
        duration: 3200,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
      return;
    }

    if (result.success !== true) {
      const toast = await this.toastController.create({
        message: (result.message ?? 'Não foi possível ler o arquivo.').trim() || 'Leitura indisponível.',
        duration: 3200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    await this.router.navigate(['/charge-scan-results'], {
      state: { scanResult: result },
    });
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
