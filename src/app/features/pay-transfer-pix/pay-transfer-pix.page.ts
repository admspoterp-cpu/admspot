import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

import { BRL_ZERO_DISPLAY, brlStringToCents } from '../../shared/utils/brl-currency.util';
import { AuthSessionService } from '../../services/auth-session.service';
import { BalanceService } from '../../services/balance.service';
import { BiometricAuthService } from '../../services/biometric-auth.service';
import { BiometricRuleService } from '../../services/biometric-rule.service';
import type { DictValidationData } from '../../services/dict.service';
import { formatBrlNumber, normalizeMoneyValue } from '../../utils/brl-format';
import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';

/** Estado enviado por `transfer-pix` via `navigateForward(..., { state })` */
export interface PayTransferPixNavState {
  pixKey?: string;
  keyType?: string;
  dictValidationData?: DictValidationData;
}

@Component({
  selector: 'app-pay-transfer-pix',
  templateUrl: './pay-transfer-pix.page.html',
  styleUrls: ['./pay-transfer-pix.page.scss'],
  standalone: false,
})
export class PayTransferPixPage implements OnInit {
  @ViewChild('transferPwdInput') transferPwdInput?: ElementRef<HTMLInputElement>;

  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly authSession = inject(AuthSessionService);
  private readonly balanceService = inject(BalanceService);
  private readonly biometricRule = inject(BiometricRuleService);
  private readonly biometricAuth = inject(BiometricAuthService);

  /** Da etapa anterior (chave informada) */
  pixKey = '';
  keyType = '';

  accountName = 'Conta digital';
  readonly amountReais = 'R$';
  balanceValue = '—';
  balanceLoading = false;
  private availableBalanceCents = 0;

  beneficiaryName = 'Destinatário';
  beneficiaryBank = 'Instituição';
  documentMasked = '---';
  bankShortName = 'BK';

  transferAmount = BRL_ZERO_DISPLAY;
  observation = 'Segue o valor do aluguel';

  readonly feeCurrency = 'R$';
  feeValue = '0,00';
  freeTransfers = 0;

  /** Sheet: senha de transferência (4 dígitos) quando biometria está desativada na API. */
  transferPasswordSheetOpen = false;
  transferPassword = '';
  private transferPasswordResolve: ((ok: boolean) => void) | null = null;
  private transferPasswordSheetHandled = false;

  /** Índices 0–3 para os indicadores da senha. */
  readonly transferPwdDots = [0, 1, 2, 3];

  ngOnInit(): void {
    const s = history.state as PayTransferPixNavState & Record<string, unknown>;
    if (typeof s?.pixKey === 'string') {
      this.pixKey = s.pixKey;
    }
    if (typeof s?.keyType === 'string') {
      this.keyType = s.keyType;
    }
    this.accountName = this.authSession.getDefaultWallet()?.wallet?.trim() || this.accountName;
    const data = s?.dictValidationData as DictValidationData | undefined;
    if (data) {
      this.beneficiaryName = data.receiver_name?.trim() || this.beneficiaryName;
      this.documentMasked = data.doc?.trim() || this.documentMasked;
      this.beneficiaryBank = data.ispb_name?.trim() || this.beneficiaryBank;
      this.bankShortName = this.extractBankShortName(this.beneficiaryBank);
      this.freeTransfers = Number.isFinite(Number(data.free_transfers)) ? Number(data.free_transfers) : 0;
      this.feeValue = this.normalizeFeeDisplay(data.transfer_fee);
    }
    void this.loadBalance();
  }

  goBack(): void {
    this.navController.back();
  }

  async onPay(): Promise<void> {
    const cents = brlStringToCents(this.transferAmount);
    if (cents <= 0) {
      const toast = await this.toastController.create({
        message: 'Informe um valor maior que zero',
        duration: 2000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    if (this.availableBalanceCents <= 0) {
      const toast = await this.toastController.create({
        message: 'Saldo indisponível para realizar pagamento',
        duration: 2200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    if (cents > this.availableBalanceCents) {
      const toast = await this.toastController.create({
        message: 'Valor maior que o saldo disponível',
        duration: 2200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    const allowed = await this.confirmTransferSecurity();
    if (!allowed) {
      return;
    }

    const amount = this.transferAmount.trim();

    const state: ComprovantePaymentNavState = {
      amountDisplay: amount,
      beneficiaryName: this.beneficiaryName,
      beneficiaryBank: this.beneficiaryBank,
      documentMasked: this.documentMasked,
      pixKey: this.pixKey,
    };

    await this.navController.navigateForward('/comprovante-payment', { state });
  }

  get transferInfoText(): string {
    return `Você possui ${this.freeTransfers} transferências gratuitas por mês, após esse limite será descontado R$ ${this.feeValue} por transferência`;
  }

  get payButtonDisabled(): boolean {
    if (this.balanceLoading) return true;
    const valueCents = brlStringToCents(this.transferAmount);
    if (this.availableBalanceCents <= 0) return true;
    if (valueCents <= 0) return true;
    return valueCents > this.availableBalanceCents;
  }

  private async loadBalance(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    if (!access || !sourceToken) {
      this.balanceValue = '—';
      this.availableBalanceCents = 0;
      return;
    }
    this.balanceLoading = true;
    const data = await this.balanceService.fetchBalance(access, sourceToken);
    this.balanceLoading = false;
    if (!data || data.success !== true) {
      this.balanceValue = '—';
      this.availableBalanceCents = 0;
      return;
    }
    const raw = data.balance ?? data.asaas?.balance;
    if (raw === undefined || raw === null) {
      this.balanceValue = '—';
      this.availableBalanceCents = 0;
      return;
    }
    const normalized = normalizeMoneyValue(raw);
    this.balanceValue = formatBrlNumber(normalized);
    this.availableBalanceCents = Math.round(normalized * 100);
  }

  private extractBankShortName(name: string): string {
    const upper = (name || '').trim().toUpperCase();
    if (!upper) return 'BK';
    const words = upper.split(/\s+/).filter((w) => w.length > 1);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.slice(0, 2);
    }
    return upper.slice(0, 2);
  }

  private normalizeFeeDisplay(rawFee: string | undefined): string {
    const parsed = Number.parseFloat((rawFee ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      return '0,00';
    }
    return formatBrlNumber(parsed);
  }

  private async confirmTransferSecurity(): Promise<boolean> {
    const access = this.authSession.getAccessToken();
    if (!access) {
      return false;
    }

    // Regra da API: NO -> senha de transferência; YES -> biometria.
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
    if (this.transferPasswordSheetHandled) {
      return;
    }
    this.transferPasswordSheetHandled = true;
    this.transferPasswordResolve?.(false);
    this.transferPasswordResolve = null;
  }

  onTransferPasswordModalPresent(): void {
    this.transferPassword = '';
    setTimeout(() => this.transferPwdInput?.nativeElement?.focus(), 100);
  }

  onTransferPasswordInput(raw: string): void {
    const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 4);
    this.transferPassword = digits;
    if (digits.length === 4) {
      void this.finishTransferPasswordSheet(true);
    }
  }

  closeTransferPasswordSheet(): void {
    void this.finishTransferPasswordSheet(false);
  }

  confirmTransferPasswordTap(): void {
    const digits = this.transferPassword.replace(/\D/g, '');
    if (digits.length !== 4) {
      void this.toastController
        .create({
          message: 'Informe a senha de transferência com 4 dígitos.',
          duration: 2200,
          position: 'bottom',
          color: 'warning',
        })
        .then((t) => t.present());
      return;
    }
    void this.finishTransferPasswordSheet(true);
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
    this.transferPasswordSheetOpen = false;
    this.transferPasswordResolve?.(success);
    this.transferPasswordResolve = null;
  }
}
