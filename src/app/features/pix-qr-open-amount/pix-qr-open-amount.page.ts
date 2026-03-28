import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonModal, NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { BRL_ZERO_DISPLAY, brlStringToCents } from '../../shared/utils/brl-currency.util';
import { isPixQrOpenAmountDecode } from '../../shared/utils/pix-qr-open-amount.util';
import { AuthSessionService } from '../../services/auth-session.service';
import { BalanceService } from '../../services/balance.service';
import { BiometricAuthService } from '../../services/biometric-auth.service';
import { BiometricRuleService } from '../../services/biometric-rule.service';
import type { PixQrDecodeResponse } from '../../services/pix-qr-decode.service';
import { PixQrPayService } from '../../services/pix-qr-pay.service';
import { TransferPassVerifyService } from '../../services/transfer-pass-verify.service';
import { formatBrlNumber, normalizeMoneyValue } from '../../utils/brl-format';
import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';
import type { PixQrPaymentDetailsNavState } from '../pix-qr-payment-details/pix-qr-payment-details.page';

@Component({
  selector: 'app-pix-qr-open-amount',
  templateUrl: './pix-qr-open-amount.page.html',
  styleUrls: ['./pix-qr-open-amount.page.scss'],
  standalone: false,
})
export class PixQrOpenAmountPage implements OnInit, ViewWillEnter {
  @ViewChild('transferPwdInput') transferPwdInput?: ElementRef<HTMLInputElement>;
  @ViewChild('transferPwdModal') transferPwdModal?: IonModal;

  qrPayload = '';

  /** Campo monetário (mesmo padrão de transferência PIX). */
  transferAmount = BRL_ZERO_DISPLAY;

  payeeShort = 'Recebedor';

  institutionLabel = 'Instituição';
  institutionName = '—';

  beneficiaryLabel = 'Para / beneficiário';
  beneficiaryName = '—';

  documentLabel = 'Documento';
  documentValue = '—';

  messageLabel = 'Descrição';
  messageValue = 'Descrição não informada';

  dueDateLabel = 'Vencimento';
  dueDateValue = '—';

  discountLabel = 'Desconto';
  discountValue = 'R$ 0,00';

  interestLabel = 'Juros';
  interestValue = 'R$ 0,00';

  fineLabel = 'Multa';
  fineValue = 'R$ 0,00';

  conciliationLabel = 'Identificador de conciliação';
  conciliationValue = '—';

  identifierLabel = 'Identificador';

  balanceValue = '—';
  balanceLoading = false;
  private availableBalanceCents = 0;

  payExecuting = false;

  transferPasswordSheetOpen = false;
  transferPassword = '';
  private transferPasswordResolve: ((ok: boolean) => void) | null = null;
  private transferPasswordSheetHandled = false;
  transferPasswordVerifying = false;
  pwdSheetShake = false;
  readonly transferPwdDots = [0, 1, 2, 3];

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly authSession = inject(AuthSessionService);
  private readonly balanceService = inject(BalanceService);
  private readonly biometricRule = inject(BiometricRuleService);
  private readonly biometricAuth = inject(BiometricAuthService);
  private readonly transferPassVerify = inject(TransferPassVerifyService);
  private readonly pixQrPay = inject(PixQrPayService);

  ngOnInit(): void {
    const state = history.state as PixQrPaymentDetailsNavState;
    const raw = (state?.qrPayload ?? '').trim();
    this.qrPayload = raw;

    if (!raw) {
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    const data = state?.decodeData;
    if (data && !isPixQrOpenAmountDecode(data)) {
      void this.router.navigate(['/pix-qr-payment-details'], {
        replaceUrl: true,
        state: { qrPayload: raw, decodeData: data },
      });
      return;
    }

    this.applyDecodeData(data ?? undefined);
  }

  private applyDecodeData(data: PixQrDecodeResponse | undefined): void {
    const summary = data?.summary;
    const asaas = data?.asaas;
    if (summary || asaas) {
      this.payeeShort = (
        summary?.nome_recebedor ??
        asaas?.receiver?.name ??
        this.payeeShort
      ).trim();
      this.institutionName = (
        summary?.banco_recebedor ??
        asaas?.receiver?.ispbName ??
        this.institutionName
      ).trim();
      this.beneficiaryName = (
        summary?.nome_recebedor ??
        asaas?.receiver?.name ??
        this.beneficiaryName
      ).trim();
      this.documentValue = (
        summary?.recebedor_doc ??
        asaas?.receiver?.cpfCnpj ??
        this.documentValue
      ).trim();
      this.messageValue = (summary?.descricao ?? asaas?.description ?? this.messageValue).trim();
      this.conciliationValue = (
        summary?.conciliation_identifier ??
        asaas?.conciliationIdentifier ??
        '—'
      ).trim();
      this.dueDateValue = (summary?.vencimento ?? asaas?.dueDate ?? '—').trim() || '—';

      this.discountValue = this.moneyLabel(summary?.discount ?? asaas?.discount ?? 0);
      this.interestValue = this.moneyLabel(summary?.juros ?? asaas?.interest ?? 0);
      this.fineValue = this.moneyLabel(summary?.multa ?? asaas?.fine ?? 0);
    }
  }

  ionViewWillEnter(): void {
    void this.loadBalance();
  }

  goBack(): void {
    this.navController.navigateBack('/qr-scan');
  }

  get payButtonDisabled(): boolean {
    if (this.payExecuting || this.balanceLoading) {
      return true;
    }
    const cents = brlStringToCents(this.transferAmount);
    if (cents <= 0) {
      return true;
    }
    if (this.availableBalanceCents <= 0 || cents > this.availableBalanceCents) {
      return true;
    }
    return false;
  }

  async onPay(): Promise<void> {
    const cents = brlStringToCents(this.transferAmount);
    if (cents <= 0) {
      const toast = await this.toastController.create({
        message: 'Informe um valor maior que zero.',
        duration: 2200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    if (this.availableBalanceCents <= 0 || cents > this.availableBalanceCents) {
      const toast = await this.toastController.create({
        message: 'Saldo insuficiente para este pagamento.',
        duration: 2600,
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

    const payload = this.qrPayload.trim();
    if (!payload) {
      return;
    }

    const paymentValueReais = cents / 100;
    const description = this.buildPayDescription();

    this.payExecuting = true;
    try {
      const result = await this.pixQrPay.pay(
        access,
        sourceToken,
        payload,
        Number(paymentValueReais.toFixed(2)),
        description,
      );

      if (!result) {
        const toast = await this.toastController.create({
          message: 'Não foi possível concluir o pagamento. Verifique sua conexão.',
          duration: 2800,
          position: 'bottom',
          color: 'danger',
        });
        await toast.present();
        return;
      }

      if (result.success !== true) {
        const toast = await this.toastController.create({
          message: result.message?.trim() || 'Não foi possível concluir o pagamento Pix.',
          duration: 3200,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      const txnId = result.asaas?.id?.trim();
      if (!txnId) {
        const toast = await this.toastController.create({
          message: 'Pagamento solicitado, mas identificador da transação não retornado.',
          duration: 3200,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      const amountDisplay = formatBrlNumber(paymentValueReais);
      const state: ComprovantePaymentNavState = {
        amountDisplay: amountDisplay.trim(),
        beneficiaryName: this.payeeShort || this.beneficiaryName,
        beneficiaryBank: this.institutionName,
        documentMasked: this.documentValue,
        transferKind: 'pix_qr',
        pixTransactionId: txnId,
        pixReference: result.reference,
      };

      await this.navController.navigateForward('/comprovante-payment', { state });
    } finally {
      this.payExecuting = false;
    }
  }

  private buildPayDescription(): string {
    const m = this.messageValue.trim();
    if (m && m !== 'Descrição não informada') {
      return m.slice(0, 140);
    }
    return 'Pagamento';
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

  private moneyLabel(raw: number): string {
    return `R$ ${formatBrlNumber(normalizeMoneyValue(raw))}`;
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
