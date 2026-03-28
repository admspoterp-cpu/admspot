import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonModal,
  NavController,
  ToastController,
} from '@ionic/angular';

import {
  BoletoBarcodeService,
  type BoletoBankSlipInfo,
  type BoletoBarcodeResponse,
} from '../../services/boleto-barcode.service';
import { BoletoPayService } from '../../services/boleto-pay.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { BiometricAuthService } from '../../services/biometric-auth.service';
import { BiometricRuleService } from '../../services/biometric-rule.service';
import { TransferPassVerifyService } from '../../services/transfer-pass-verify.service';
import {
  formatBrazilDateTimeForApi,
  getBoletoPayScheduleNotice,
} from '../../shared/utils/boleto-pay-schedule-notice.util';
import { formatBoletoIdentificationDisplay } from '../../shared/utils/boleto-linha-digitavel-display.util';
import { formatBrlNumber, normalizeMoneyValue } from '../../utils/brl-format';
import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';

/** Navigation state key for barcode passed from boleto scanner ou digitação. */
export interface BoletoPaymentDetailsNavState {
  barcode?: string;
  linhaDigitavel?: string;
  source?: 'scan' | 'manual';
}

@Component({
  selector: 'app-boleto-payment-details',
  templateUrl: './boleto-payment-details.page.html',
  styleUrls: ['./boleto-payment-details.page.scss'],
  standalone: false,
})
export class BoletoPaymentDetailsPage implements OnInit {
  /** Digits-only barcode (entrada ou retorno da API). */
  barcodeDigits = '';

  /** Formatted for display under "Código de barras". */
  barcodeDisplay = '';

  paymentScheduleLabel = 'Pagamento/Agendamento';
  dueDateLabel = 'Vencimento';

  /** Data de agendamento: hoje (ou mínima da API se for posterior). */
  paymentDateIso = '';

  /** Vencimento do boleto (API); pode ficar vazio se `dueDate` for null. */
  dueDateIso = '';

  amountCurrency = 'R$';
  amountValue = '0,00';

  /** Nome curto / destaque (regra company + beneficiary). */
  payeeShort = '';

  beneficiaryLabel = 'Para / beneficiário';
  beneficiaryName = '';

  /** Linha digitável (47) ou campo retornado pela API. */
  identificationFieldRaw = '';
  identificationDisplay = '';

  isOverdue = false;
  beneficiaryCpfCnpj = '';

  detailLoading = true;
  private detailsSource: 'scan' | 'manual' = 'scan';

  /** Data/hora de pagamento quando boleto vencido (ISO para `ion-datetime`). */
  scheduleDatetimeIso = '';

  /** Mínimo para agendamento (ISO), a partir de `minimumScheduleDate` da API. */
  scheduleMinIso = '';

  payExecuting = false;

  transferPasswordSheetOpen = false;
  transferPassword = '';
  private transferPasswordResolve: ((ok: boolean) => void) | null = null;
  private transferPasswordSheetHandled = false;
  transferPasswordVerifying = false;
  pwdSheetShake = false;
  readonly transferPwdDots = [0, 1, 2, 3];

  @ViewChild('transferPwdInput') transferPwdInput?: ElementRef<HTMLInputElement>;
  @ViewChild('transferPwdModal') transferPwdModal?: IonModal;

  private minimumScheduleDateRaw: string | null = null;
  private lastSlipSnapshot: BoletoBankSlipInfo | null = null;

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly authSession = inject(AuthSessionService);
  private readonly boletoBarcode = inject(BoletoBarcodeService);
  private readonly boletoPay = inject(BoletoPayService);
  private readonly biometricRule = inject(BiometricRuleService);
  private readonly biometricAuth = inject(BiometricAuthService);
  private readonly transferPassVerify = inject(TransferPassVerifyService);

  ngOnInit(): void {
    const state = history.state as BoletoPaymentDetailsNavState;
    const barcodeRaw = (state?.barcode ?? '').replace(/\D/g, '');
    const linhaRaw = (state?.linhaDigitavel ?? '').replace(/\D/g, '');
    this.detailsSource = state?.source === 'manual' ? 'manual' : 'scan';
    const raw = this.detailsSource === 'manual' ? linhaRaw : barcodeRaw;

    if (!raw) {
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    this.barcodeDigits = raw;
    this.barcodeDisplay = formatBoletoIdentificationDisplay(raw);
    void this.loadBoletoDetails(raw, this.detailsSource);
  }

  goBack(): void {
    void this.navController.navigateBack(
      this.detailsSource === 'manual' ? '/boleto-manual' : '/boleto-scan',
    );
  }

  get payButtonDisabled(): boolean {
    return this.payExecuting || this.detailLoading;
  }

  async onPay(): Promise<void> {
    const linha = this.identificationFieldRaw.replace(/\D/g, '');
    if (linha.length < 44 || linha.length > 48) {
      const toast = await this.toastController.create({
        message: 'Linha digitável indisponível para pagamento. Consulte o boleto novamente.',
        duration: 3200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const notice = getBoletoPayScheduleNotice();
    if (notice) {
      const alert = await this.alertController.create({
        header: 'Agendamento de pagamento',
        message: notice,
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Continuar', role: 'confirm' },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'confirm') {
        return;
      }
    }

    const allowed = await this.confirmTransferSecurity();
    if (!allowed) {
      return;
    }

    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    if (!access || !sourceToken) {
      const toast = await this.toastController.create({
        message: !access
          ? 'Sessão expirada. Faça login novamente.'
          : 'Token da carteira indisponível. Verifique sua conta.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    let scheduleApi: string | undefined;
    if (this.isOverdue && this.scheduleDatetimeIso) {
      const d = new Date(this.scheduleDatetimeIso);
      if (!Number.isNaN(d.getTime())) {
        scheduleApi = formatBrazilDateTimeForApi(d);
      }
    }

    this.payExecuting = true;
    try {
      const result = await this.boletoPay.pay(access, sourceToken, linha, scheduleApi);

      if (!result) {
        const toast = await this.toastController.create({
          message: 'Não foi possível processar o pagamento. Verifique sua conexão.',
          duration: 2800,
          position: 'bottom',
          color: 'danger',
        });
        await toast.present();
        return;
      }

      if (result.success !== true) {
        const toast = await this.toastController.create({
          message: result.message?.trim() || 'Não foi possível concluir o pagamento do boleto.',
          duration: 3400,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      const state: ComprovantePaymentNavState = {
        transferKind: 'boleto',
        amountDisplay: this.amountValue.trim(),
        beneficiaryName: this.payeeShort || this.beneficiaryName,
        beneficiaryBank: this.formatBankLabel(),
        documentMasked: this.beneficiaryCpfCnpj || '—',
        boletoBillPaymentId: result.bill_payment_id ?? result.asaas_payout?.id,
        boletoStatus: result.status ?? result.asaas_payout?.status,
        boletoScheduleDate: result.schedule_date ?? result.asaas_payout?.scheduleDate ?? null,
        boletoMessage: result.message?.trim(),
        boletoLinhaResumo: formatBoletoIdentificationDisplay(linha),
        boletoLinhaDigitavelDigits: linha,
        boletoExternalReference: result.external_reference ?? undefined,
      };

      await this.router.navigate(['/comprovante-payment'], { state });
    } finally {
      this.payExecuting = false;
    }
  }

  private formatBankLabel(): string {
    const slip = this.lastSlipSnapshot;
    const code = slip?.bank != null ? String(slip.bank) : '';
    if (code) {
      return `Boleto — banco ${code}`;
    }
    return 'Boleto bancário';
  }

  get paymentDateDisplay(): string {
    return this.formatDateBrFromIso(this.paymentDateIso);
  }

  get dueDateDisplay(): string {
    if (!this.dueDateIso?.trim()) {
      return '—';
    }
    return this.formatDateBrFromIso(this.dueDateIso);
  }

  private async loadBoletoDetails(input: string, source: 'scan' | 'manual'): Promise<void> {
    this.detailLoading = true;
    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();

    if (!access || !sourceToken) {
      this.detailLoading = false;
      const toast = await this.toastController.create({
        message: 'Sessão ou carteira inválida. Faça login novamente.',
        duration: 2800,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    const data =
      source === 'manual'
        ? await this.boletoBarcode.fetchByLinhaDigitavel(access, sourceToken, input)
        : await this.boletoBarcode.fetchByBarcode(access, sourceToken, input);
    this.detailLoading = false;

    if (!data) {
      await this.presentErrorToast('Não foi possível consultar o boleto. Verifique sua conexão.');
      void this.navController.navigateBack(source === 'manual' ? '/boleto-manual' : '/boleto-scan');
      return;
    }

    if (data.success !== true) {
      await this.presentErrorToast(
        data.message?.trim() || 'Não foi possível consultar o boleto.',
      );
      void this.navController.navigateBack(source === 'manual' ? '/boleto-manual' : '/boleto-scan');
      return;
    }

    const slip = this.pickBankSlip(data);
    if (!slip) {
      await this.presentErrorToast('Resposta do boleto incompleta.');
      void this.navController.navigateBack(source === 'manual' ? '/boleto-manual' : '/boleto-scan');
      return;
    }

    this.applyApiResponse(data, slip);
  }

  private pickBankSlip(data: BoletoBarcodeResponse): BoletoBankSlipInfo | null {
    const a = data.bank_slip;
    const b = data.asaas?.bankSlipInfo;
    if (a && typeof a === 'object') {
      return a;
    }
    if (b && typeof b === 'object') {
      return b;
    }
    return null;
  }

  private applyApiResponse(data: BoletoBarcodeResponse, slip: BoletoBankSlipInfo): void {
    this.lastSlipSnapshot = slip;
    const minSched = (data.asaas?.minimumScheduleDate ?? '').trim();
    this.minimumScheduleDateRaw = minSched || null;

    const normalizedBarcode = (data.barcode ?? data.barcode_input ?? this.barcodeDigits).replace(
      /\D/g,
      '',
    );
    if (normalizedBarcode) {
      this.barcodeDigits = normalizedBarcode;
      this.barcodeDisplay = formatBoletoIdentificationDisplay(normalizedBarcode);
    }

    const label = resolveBoletoBeneficiaryLabel(slip.companyName, slip.beneficiaryName);
    this.beneficiaryName = label;
    this.payeeShort = label;

    const value = normalizeMoneyValue(slip.value);
    this.amountValue = formatBrlNumber(value);

    this.isOverdue = slip.isOverdue === true;

    const cpfCnpj = (slip.beneficiaryCpfCnpj ?? '').trim();
    this.beneficiaryCpfCnpj = cpfCnpj;

    const idField = (slip.identificationField ?? '').replace(/\D/g, '');
    this.identificationFieldRaw = idField;
    this.identificationDisplay = idField ? formatBoletoIdentificationDisplay(idField) : '';

    const due = parseDueDateToIso(slip.dueDate);
    this.dueDateIso = due ?? '';

    /** Agendamento exibido: hoje (ou mínima da API). */
    this.paymentDateIso = this.todayIsoLocal();

    if (this.isOverdue) {
      const base = new Date();
      base.setDate(base.getDate() + 1);
      base.setHours(9, 0, 0, 0);
      this.scheduleDatetimeIso = base.toISOString();
      if (minSched && /^\d{4}-\d{2}-\d{2}$/.test(minSched)) {
        this.scheduleMinIso = `${minSched}T00:00:00.000Z`;
        const minD = new Date(`${minSched}T12:00:00`);
        if (!Number.isNaN(minD.getTime())) {
          minD.setHours(9, 0, 0, 0);
          this.scheduleDatetimeIso = minD.toISOString();
        }
      }
    } else {
      this.scheduleDatetimeIso = '';
      this.scheduleMinIso = '';
    }
  }

  private todayIsoLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async presentErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3200,
      position: 'bottom',
      color: 'warning',
    });
    await toast.present();
  }

  private formatDateBrFromIso(iso: string): string {
    if (!iso) {
      return '';
    }
    const part = iso.split('T')[0] ?? iso;
    const [y, m, d] = part.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) {
      return part;
    }
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private async confirmTransferSecurity(): Promise<boolean> {
    const access = this.authSession.getAccessToken();
    if (!access) {
      return false;
    }

    const skipBiometric = await this.biometricRule.shouldSkipBiometric(access);
    if (skipBiometric) {
      return this.requestTransferPasswordSheet();
    }

    const outcome = await this.biometricAuth.authenticateForLogin();
    if (outcome.kind === 'success') {
      return true;
    }

    const messageByKind: Record<string, string> = {
      not_native: 'Biometria disponível apenas no app instalado (iOS/Android).',
      not_available: 'Biometria não disponível neste dispositivo.',
      user_cancelled: 'Confirmação biométrica cancelada.',
      authentication_failed: 'Biometria não reconhecida. Tente novamente.',
      lockout: 'Biometria bloqueada temporariamente. Tente novamente em instantes.',
      other_error: outcome.kind === 'other_error' ? outcome.message?.trim() || '' : '',
    };
    const toast = await this.toastController.create({
      message: messageByKind[outcome.kind] || 'Não foi possível validar a biometria.',
      duration: 2600,
      position: 'bottom',
      color: 'warning',
    });
    await toast.present();
    return false;
  }

  onTransferPasswordSheetDismiss(): void {
    this.transferPasswordSheetOpen = false;
    this.transferPasswordVerifying = false;
    if (this.transferPasswordSheetHandled) {
      return;
    }
    this.transferPasswordSheetHandled = true;
    this.transferPasswordResolve?.(false);
    this.transferPasswordResolve = null;
  }

  onTransferPasswordModalPresent(): void {
    this.transferPassword = '';
    this.transferPasswordVerifying = false;
    this.pwdSheetShake = false;
    setTimeout(() => this.transferPwdInput?.nativeElement?.focus(), 100);
  }

  onTransferPasswordInput(raw: string): void {
    const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 4);
    this.transferPassword = digits;
    if (digits.length === 4 && !this.transferPasswordVerifying) {
      void this.verifyTransferPassword();
    }
  }

  closeTransferPasswordSheet(): void {
    void this.finishTransferPasswordSheet(false);
  }

  async confirmTransferPasswordTap(): Promise<void> {
    const digits = this.transferPassword.replace(/\D/g, '');
    if (digits.length !== 4) {
      const toast = await this.toastController.create({
        message: 'Informe a senha de transferência com 4 dígitos.',
        duration: 2200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    await this.verifyTransferPassword();
  }

  private triggerPwdSheetShake(): void {
    this.pwdSheetShake = true;
    setTimeout(() => {
      this.pwdSheetShake = false;
    }, 480);
  }

  private async verifyTransferPassword(): Promise<void> {
    if (this.transferPasswordVerifying || this.transferPasswordSheetHandled) {
      return;
    }
    const digits = this.transferPassword.replace(/\D/g, '');
    if (digits.length !== 4) {
      return;
    }

    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const walletToken =
      wallet?.wallet_token_account?.trim() || wallet?.asaas_api_token?.trim() || '';
    if (!access || !walletToken) {
      const toast = await this.toastController.create({
        message: !access
          ? 'Sessão expirada. Faça login novamente.'
          : 'Carteira não encontrada. Verifique sua conta.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.transferPasswordVerifying = true;
    try {
      const res = await this.transferPassVerify.verify(access, walletToken, digits);
      if (this.transferPasswordSheetHandled) {
        return;
      }

      if (!res) {
        const toast = await this.toastController.create({
          message: 'Não foi possível validar a senha. Verifique sua conexão e tente novamente.',
          duration: 2800,
          position: 'bottom',
          color: 'danger',
        });
        await toast.present();
        return;
      }

      if (res.match === true) {
        await this.finishTransferPasswordSheet(true);
        return;
      }

      if (res.match === false) {
        this.triggerPwdSheetShake();
        this.transferPassword = '';
        setTimeout(() => this.transferPwdInput?.nativeElement?.focus(), 150);
        const toast = await this.toastController.create({
          message: 'Código incorreto, tente novamente.',
          duration: 2800,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      const msg =
        res.message?.trim() || 'Não foi possível validar a senha de transferência.';
      const toast = await this.toastController.create({
        message: msg,
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
    } finally {
      this.transferPasswordVerifying = false;
    }
  }

  private async requestTransferPasswordSheet(): Promise<boolean> {
    this.transferPassword = '';
    this.transferPasswordSheetHandled = false;
    return new Promise<boolean>((resolve) => {
      this.transferPasswordResolve = resolve;
      this.transferPasswordSheetOpen = true;
    });
  }

  private async finishTransferPasswordSheet(success: boolean): Promise<void> {
    if (this.transferPasswordSheetHandled) {
      return;
    }
    this.transferPasswordSheetHandled = true;

    if (success) {
      if (this.transferPwdModal) {
        await this.transferPwdModal.dismiss();
      } else {
        this.transferPasswordSheetOpen = false;
      }
      this.transferPasswordResolve?.(true);
      this.transferPasswordResolve = null;
      return;
    }

    this.transferPasswordSheetOpen = false;
    this.transferPasswordResolve?.(false);
    this.transferPasswordResolve = null;
  }
}

/** Se ambos preenchidos, exibe só o beneficiário; senão o que existir. */
export function resolveBoletoBeneficiaryLabel(
  companyName?: string | null,
  beneficiaryName?: string | null,
): string {
  const c = (companyName ?? '').trim();
  const b = (beneficiaryName ?? '').trim();
  if (c && b) {
    return b;
  }
  return c || b;
}

function parseDueDateToIso(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const s = String(raw).trim();
  if (!s) {
    return null;
  }
  const datePart = s.split('T')[0] ?? s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
