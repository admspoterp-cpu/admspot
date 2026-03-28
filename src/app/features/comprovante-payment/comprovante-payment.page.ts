import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { IonModal, NavController, ToastController } from '@ionic/angular';

import { brlStringToCents } from '../../shared/utils/brl-currency.util';
import { AuthSessionService } from '../../services/auth-session.service';
import { BalanceService } from '../../services/balance.service';
import { BiometricAuthService } from '../../services/biometric-auth.service';
import { BiometricRuleService } from '../../services/biometric-rule.service';
import type { DictKeyType } from '../../services/dict.service';
import { PixTransferService } from '../../services/pix-transfer.service';
import { TransferPassVerifyService } from '../../services/transfer-pass-verify.service';
import { normalizeMoneyValue } from '../../utils/brl-format';
import {
  PixTransferInfoService,
  type PixTransferInfoResponse,
} from '../../services/pix-transfer-info.service';
import {
  PixTransactionInfoService,
  type PixTransactionInfoResponse,
} from '../../services/pix-transaction-info.service';
import { PixReceiptShareService, type PixTransferReceiptData } from '../../services/pix-receipt-share.service';
import { WalletAccountService } from '../../services/wallet-account.service';
import { formatBoletoIdentificationDisplay } from '../../shared/utils/boleto-linha-digitavel-display.util';

/** Estado enviado por `pay-transfer-pix` ou `transfer-ted-info` ao concluir pagamento */
export interface ComprovantePaymentNavState {
  amountDisplay?: string;
  beneficiaryName?: string;
  beneficiaryBank?: string;
  documentMasked?: string;
  pixKey?: string;
  /** CPF | CNPJ | EMAIL | PHONE | EVP — necessário para repetir PIX */
  pixKeyType?: string;
  /** Afeta título na tela e texto do PDF em Compartilhar */
  transferKind?: 'pix' | 'ted' | 'pix_qr' | 'boleto';
  /** Comprovante de pagamento de boleto (pós `/boleto/pay`). */
  boletoBillPaymentId?: string;
  boletoStatus?: string;
  boletoScheduleDate?: string | null;
  boletoMessage?: string;
  /** Linha digitável / identificationField formatado por completo (multilinha). */
  boletoLinhaResumo?: string;
  /** Apenas dígitos — preferido para reformatar a linha no comprovante (evita truncamento no estado). */
  boletoLinhaDigitavelDigits?: string;
  boletoExternalReference?: string;
  /** UUID da transferência — dispara consulta a `/pix/transfers/info` até `status === DONE` */
  pixTransferId?: string;
  /** ID da transação Asaas — consulta `/pix/transactions/info` (pagamento Pix QR) */
  pixTransactionId?: string;
  pixReference?: string;
  /** Legado: quando não há `pixTransferId` (fluxos antigos) */
  pixEndToEnd?: string | null;
  pixStatusMessage?: string;
  pixAsaasStatus?: string;
}

@Component({
  selector: 'app-comprovante-payment',
  templateUrl: './comprovante-payment.page.html',
  styleUrls: ['./comprovante-payment.page.scss'],
  standalone: false,
})
export class ComprovantePaymentPage implements OnInit, OnDestroy {
  @ViewChild('transferPwdInput') transferPwdInput?: ElementRef<HTMLInputElement>;
  @ViewChild('transferPwdModal') transferPwdModal?: IonModal;

  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly pixReceiptShareService = inject(PixReceiptShareService);
  private readonly walletAccountService = inject(WalletAccountService);
  private readonly authSession = inject(AuthSessionService);
  private readonly pixTransferInfo = inject(PixTransferInfoService);
  private readonly pixTransactionInfo = inject(PixTransactionInfoService);
  private readonly ngZone = inject(NgZone);
  private readonly balanceService = inject(BalanceService);
  private readonly biometricRule = inject(BiometricRuleService);
  private readonly biometricAuth = inject(BiometricAuthService);
  private readonly transferPassVerify = inject(TransferPassVerifyService);
  private readonly pixTransfer = inject(PixTransferService);

  amountDisplay = '5.000,00';
  beneficiaryName = 'Ana Laura de Oliveira';
  beneficiaryBank = 'NU PAGAMENTOS - IP';
  /** Siglas derivadas do nome da instituição (substitui logo). */
  beneficiaryBankShort = 'NU';
  documentMasked = '***.950.521.**';
  transactionType = 'Conta de Pagamentos';
  transactionId = 'E8478484558778566987874459877446998';
  identifier = 'NGS000000667911237829202';
  statusText = 'Transferência realizada';

  receiptSubtitle = '';

  /** Origem do fluxo — define rótulos “PIX” vs “TED” vs Pix QR vs Boleto */
  transferKind: 'pix' | 'ted' | 'pix_qr' | 'boleto' = 'pix';

  boletoStatusRaw = '';

  /** `bill_payment_id` — exibido em “ID da operação” (boleto). */
  boletoOperationId = '';

  /** Polling: transferência com chave vs transação Pix QR (cobrança QR). */
  private pixInfoPollKind: 'transfer' | 'qr_transaction' | null = null;

  /** Fluxo PIX com `pixTransferId`: polling até `DONE`. */
  pixPollScheduled = false;
  pixInfoPolling = false;
  pixTransferDone = false;
  /** `true` quando a API retorna status terminal de falha (ex.: FAILED). */
  pixTransferFailed = false;

  private pixInfoIntervalId: ReturnType<typeof setInterval> | null = null;
  private pixInfoAttempts = 0;
  private readonly pixInfoMaxAttempts = 120;
  private readonly pixInfoIntervalMs = 2500;
  private pixInfoFetchInFlight = false;
  private pixTransferIdInternal = '';

  /** Dados para “Repetir transação” (PIX). */
  repeatPixKey = '';
  repeatKeyType: DictKeyType | null = null;

  repeatExecuting = false;

  /** Sheet: senha de transferência (4 dígitos) quando biometria está desativada na API. */
  transferPasswordSheetOpen = false;
  transferPassword = '';
  private transferPasswordResolve: ((ok: boolean) => void) | null = null;
  private transferPasswordSheetHandled = false;
  transferPasswordVerifying = false;
  pwdSheetShake = false;
  readonly transferPwdDots = [0, 1, 2, 3];

  /** Sheet: reportar transação. */
  reportSheetOpen = false;
  reportMotivo: '' | 'wrong_amount' | 'wrong_person' = '';
  reportSubmitting = false;

  ngOnInit(): void {
    this.receiptSubtitle = this.buildReceiptDateTime();

    const s = history.state as ComprovantePaymentNavState & Record<string, unknown>;

    if (s?.transferKind === 'boleto') {
      this.transferKind = 'boleto';
      if (typeof s?.amountDisplay === 'string' && s.amountDisplay.trim()) {
        this.amountDisplay = s.amountDisplay.trim();
      }
      if (typeof s?.beneficiaryName === 'string' && s.beneficiaryName.trim()) {
        this.beneficiaryName = s.beneficiaryName.trim();
      }
      if (typeof s?.beneficiaryBank === 'string' && s.beneficiaryBank.trim()) {
        this.beneficiaryBank = s.beneficiaryBank.trim();
      }
      if (typeof s?.documentMasked === 'string' && s.documentMasked.trim()) {
        this.documentMasked = s.documentMasked.trim();
      }
      this.transactionType = 'Boleto';
      const billId = (s?.boletoBillPaymentId as string)?.trim() || '';
      this.boletoOperationId = billId || '—';
      const extRef = (s?.boletoExternalReference as string)?.trim() || '';
      this.transactionId = extRef || '—';
      this.boletoStatusRaw = (s?.boletoStatus as string)?.trim() || '';
      const linhaDigits = String(s?.boletoLinhaDigitavelDigits ?? '')
        .replace(/\D/g, '')
        .trim();
      this.identifier = linhaDigits
        ? formatBoletoIdentificationDisplay(linhaDigits)
        : (s?.boletoLinhaResumo as string)?.trim() || '—';
      const msg = (s?.boletoMessage as string)?.trim();
      const sched = s?.boletoScheduleDate as string | null | undefined;
      if (sched && String(sched).trim()) {
        this.receiptSubtitle = this.formatBoletoScheduleSubtitle(String(sched).trim());
      }
      this.statusText =
        msg ||
        (this.boletoStatusRaw === 'PENDING' ? 'Pagamento agendado' : this.boletoStatusRaw || 'Registrado');
      this.syncBankShort();
      return;
    }

    if (
      s?.transferKind === 'ted' ||
      s?.transferKind === 'pix' ||
      s?.transferKind === 'pix_qr'
    ) {
      this.transferKind = s.transferKind;
    }
    if (typeof s?.amountDisplay === 'string' && s.amountDisplay.trim()) {
      this.amountDisplay = s.amountDisplay.trim();
    }
    if (typeof s?.beneficiaryName === 'string' && s.beneficiaryName.trim()) {
      this.beneficiaryName = s.beneficiaryName.trim();
    }
    if (typeof s?.beneficiaryBank === 'string' && s.beneficiaryBank.trim()) {
      this.beneficiaryBank = s.beneficiaryBank.trim();
    }
    if (typeof s?.documentMasked === 'string' && s.documentMasked.trim()) {
      this.documentMasked = s.documentMasked.trim();
    }
    if (this.transferKind === 'ted') {
      this.transactionType = 'TED';
    }

    if (typeof s?.pixKey === 'string' && s.pixKey.trim()) {
      this.repeatPixKey = s.pixKey.trim();
    }
    if (typeof s?.pixKeyType === 'string' && this.isDictKeyType(s.pixKeyType)) {
      this.repeatKeyType = s.pixKeyType;
    }

    const pixTid = typeof s?.pixTransferId === 'string' ? s.pixTransferId.trim() : '';
    const pixTxnId = typeof s?.pixTransactionId === 'string' ? s.pixTransactionId.trim() : '';

    if (this.transferKind === 'pix_qr' && pixTxnId) {
      this.transactionId = pixTxnId;
      this.transactionType = 'PIX QR Code';
      this.pixPollScheduled = true;
      this.pixInfoPollKind = 'qr_transaction';
      this.identifier = '—';
      this.statusText = 'Em processamento';
      this.pixTransferIdInternal = pixTxnId;
      void this.startPixTransferInfoPolling();
    } else if (pixTid) {
      this.transactionId = pixTid;
      this.transactionType = 'PIX';
    }

    if (this.transferKind === 'pix' && pixTid) {
      this.pixPollScheduled = true;
      this.pixInfoPollKind = 'transfer';
      this.identifier = '—';
      this.statusText = 'Em processamento';
      this.pixTransferIdInternal = pixTid;
      void this.startPixTransferInfoPolling();
    } else if (this.transferKind !== 'pix_qr' || !pixTxnId) {
      this.applyLegacyPixStateFromNav(s);
    }
  }

  ngOnDestroy(): void {
    this.stopPixInfoPolling();
  }

  goBack(): void {
    void this.navController.navigateRoot('/dashboard');
  }

  /** Rótulo do campo: boleto exibe linha digitável completa; PIX/TED o identificador da transação. */
  get identifierFieldLabel(): string {
    return this.transferKind === 'boleto' ? 'Linha digitável (boleto)' : 'Identificador';
  }

  get successHeroTitle(): string {
    if (this.transferKind === 'ted') {
      return 'Transferência TED Realizada';
    }
    if (this.transferKind === 'boleto') {
      const st = this.boletoStatusRaw.toUpperCase();
      if (st === 'PENDING' || st === 'SCHEDULED' || st === 'AWAITING') {
        return 'Pagamento de boleto agendado';
      }
      return 'Pagamento de boleto';
    }
    if (this.transferKind === 'pix_qr') {
      if (this.pixPollScheduled && this.pixTransferFailed) {
        return 'Pagamento Pix não concluído';
      }
      if (this.pixPollScheduled && !this.pixTransferDone) {
        return 'Pagamento Pix em processamento';
      }
      return 'Pagamento Pix realizado';
    }
    if (this.pixPollScheduled && this.pixTransferFailed) {
      return 'Transferência Pix não concluída';
    }
    if (this.pixPollScheduled && !this.pixTransferDone) {
      return 'Transferência Pix em processamento';
    }
    return 'Transferência Pix Realizada';
  }

  get identifierPending(): boolean {
    return (
      this.pixPollScheduled &&
      !this.pixTransferDone &&
      (this.identifier === '—' || !String(this.identifier).trim())
    );
  }

  get statusIconIsCheck(): boolean {
    if (!this.pixPollScheduled) {
      return true;
    }
    return this.pixTransferDone && !this.pixTransferFailed;
  }

  get statusIconIsPending(): boolean {
    return this.pixPollScheduled && this.pixInfoPolling && !this.pixTransferDone;
  }

  get statusIconIsTimeout(): boolean {
    return this.pixPollScheduled && !this.pixInfoPolling && !this.pixTransferDone;
  }

  get statusIconIsError(): boolean {
    return this.pixPollScheduled && this.pixTransferDone && this.pixTransferFailed;
  }

  async onShare(): Promise<void> {
    try {
      const payload = await this.buildReceiptPayloadWithOrigin();
      await this.pixReceiptShareService.shareAsPdf(payload, this.shareOptionsForKind());
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message ? err.message : 'Não foi possível gerar ou compartilhar o PDF.';
      const toast = await this.toastController.create({
        message,
        duration: 2800,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }

  /** Enviar: gera o mesmo PDF e abre o share sheet (ex.: Gmail, E-mail) com título orientado a envio. */
  async onSendByEmail(): Promise<void> {
    try {
      const payload = await this.buildReceiptPayloadWithOrigin();
      await this.pixReceiptShareService.shareAsPdf(payload, {
        dialogTitle: 'Enviar comprovante',
        ...this.shareOptionsForKind(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message ? err.message : 'Não foi possível preparar o envio.';
      const toast = await this.toastController.create({
        message,
        duration: 2800,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }

  private shareOptionsForKind(): { shareTitle: string } {
    if (this.transferKind === 'ted') {
      return { shareTitle: 'Comprovante TED' };
    }
    if (this.transferKind === 'boleto') {
      return { shareTitle: 'Comprovante boleto' };
    }
    if (this.transferKind === 'pix_qr') {
      return { shareTitle: 'Comprovante PIX QR' };
    }
    return { shareTitle: 'Comprovante PIX' };
  }

  private getReceiptPayload(): PixTransferReceiptData {
    const base: PixTransferReceiptData = {
      receiptSubtitle: this.receiptSubtitle,
      amountDisplay: this.amountDisplay,
      beneficiaryName: this.beneficiaryName,
      beneficiaryBank: this.beneficiaryBank,
      documentMasked: this.documentMasked,
      transactionType: this.transactionType,
      transactionId: this.transactionId,
      identifier: this.identifier,
      statusText: this.statusText,
      transferKind: this.transferKind,
    };
    if (this.transferKind === 'boleto') {
      base.boletoOperationId = this.boletoOperationId;
    }
    return base;
  }

  /** PDF: inclui conta de origem (carteira padrão), como na tela Depositar. */
  private async buildReceiptPayloadWithOrigin(): Promise<PixTransferReceiptData> {
    const base = this.getReceiptPayload();
    const origin = await this.loadOriginWalletForPdf();
    return { ...base, ...origin };
  }

  private async loadOriginWalletForPdf(): Promise<
    Pick<PixTransferReceiptData, 'originFullName' | 'originAgency' | 'originAccount'>
  > {
    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const walletToken = wallet?.wallet_token_account?.trim();
    if (!access || !walletToken) {
      return {};
    }
    const data = await this.walletAccountService.fetchWalletAccount(access, walletToken);
    if (!data?.success || !data.digital_account) {
      return {};
    }
    const da = data.digital_account;
    const name = (da.name ?? '').trim();
    const agency = (da.account_number_agency ?? '').trim();
    const acc = (da.account_number_account ?? '').trim();
    const dig = (da.account_number_accountDigit ?? '').trim();
    const account = [acc, dig].filter((p) => p.length > 0).join('-');
    return {
      ...(name ? { originFullName: name } : {}),
      ...(agency ? { originAgency: agency } : {}),
      ...(account ? { originAccount: account } : {}),
    };
  }

  async onRepeatTransaction(): Promise<void> {
    if (this.repeatExecuting) {
      return;
    }
    if (this.transferKind !== 'pix') {
      const toast = await this.toastController.create({
        message: 'Repetir transação está disponível apenas para transferências PIX.',
        duration: 2800,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    if (!this.repeatPixKey.trim()) {
      const toast = await this.toastController.create({
        message: 'Não há dados da chave PIX para repetir. Faça uma nova transferência pela área PIX.',
        duration: 3200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    if (this.repeatKeyType == null) {
      const toast = await this.toastController.create({
        message: 'Não foi possível identificar o tipo da chave PIX. Faça uma nova transferência.',
        duration: 3200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const cents = brlStringToCents(this.amountDisplay);
    if (cents <= 0) {
      const toast = await this.toastController.create({
        message: 'Valor inválido para repetir a transferência.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const balanceOk = await this.ensureRepeatBalanceOk(cents);
    if (!balanceOk) {
      return;
    }

    const allowed = await this.confirmTransferSecurity();
    if (!allowed) {
      return;
    }

    await this.executeRepeatPixTransfer();
  }

  async onReportTransaction(): Promise<void> {
    this.reportMotivo = '';
    this.reportSheetOpen = true;
  }

  closeReportSheet(): void {
    this.reportSheetOpen = false;
  }

  async submitReportTransaction(): Promise<void> {
    if (this.reportSubmitting) {
      return;
    }
    if (!this.reportMotivo) {
      const toast = await this.toastController.create({
        message: 'Selecione o motivo do reporte.',
        duration: 2200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    this.reportSubmitting = true;
    try {
      const toast = await this.toastController.create({
        message: 'Sua solicitação foi registrada e será encaminhada ao banco parceiro.',
        duration: 3200,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
      this.reportSheetOpen = false;
    } finally {
      this.reportSubmitting = false;
    }
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

  private async ensureRepeatBalanceOk(cents: number): Promise<boolean> {
    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    if (!access || !sourceToken) {
      const toast = await this.toastController.create({
        message: 'Sessão ou carteira inválida. Faça login novamente.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return false;
    }
    const data = await this.balanceService.fetchBalance(access, sourceToken);
    if (!data || data.success !== true) {
      const toast = await this.toastController.create({
        message: 'Não foi possível consultar o saldo. Tente novamente.',
        duration: 2800,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
      return false;
    }
    const raw = data.balance ?? data.asaas?.balance;
    if (raw === undefined || raw === null) {
      const toast = await this.toastController.create({
        message: 'Saldo indisponível. Tente novamente.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return false;
    }
    const normalized = normalizeMoneyValue(raw);
    const availableCents = Math.round(normalized * 100);
    if (cents > availableCents) {
      const toast = await this.toastController.create({
        message: 'Saldo insuficiente para repetir esta transferência.',
        duration: 3200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return false;
    }
    return true;
  }

  private async executeRepeatPixTransfer(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    const key = this.repeatPixKey.trim();
    const kt = this.repeatKeyType;
    if (!access || !sourceToken || !key || kt == null) {
      const toast = await this.toastController.create({
        message: 'Não foi possível iniciar a transferência. Verifique sua sessão.',
        duration: 2800,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const cents = brlStringToCents(this.amountDisplay);
    const amountApi = (cents / 100).toFixed(2);

    this.repeatExecuting = true;
    try {
      const result = await this.pixTransfer.executeTransfer(access, sourceToken, amountApi, key, kt);

      if (!result) {
        const toast = await this.toastController.create({
          message: 'Não foi possível concluir a transferência. Verifique sua conexão.',
          duration: 2800,
          position: 'bottom',
          color: 'danger',
        });
        await toast.present();
        return;
      }

      if (result.success !== true) {
        const toast = await this.toastController.create({
          message: result.message?.trim() || 'Não foi possível concluir a transferência PIX.',
          duration: 3200,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      const state: ComprovantePaymentNavState = {
        amountDisplay: this.amountDisplay.trim(),
        beneficiaryName: this.beneficiaryName,
        beneficiaryBank: this.beneficiaryBank,
        documentMasked: this.documentMasked,
        pixKey: key,
        pixKeyType: kt,
        transferKind: 'pix',
        pixTransferId: result.transfer_id ?? result.asaas?.id,
        pixReference: result.reference,
      };

      await this.navController.navigateRoot('/comprovante-payment', { state });
    } finally {
      this.repeatExecuting = false;
    }
  }

  private isDictKeyType(v: string): v is DictKeyType {
    return ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'].includes(v);
  }

  private applyLegacyPixStateFromNav(
    s: ComprovantePaymentNavState & Record<string, unknown>,
  ): void {
    const e2eRaw = s?.pixEndToEnd;
    if (typeof e2eRaw === 'string' && e2eRaw.trim()) {
      this.identifier = e2eRaw.trim();
    } else if (typeof s?.pixReference === 'string' && s.pixReference.trim()) {
      this.identifier = s.pixReference.trim();
    }
    if (typeof s?.pixStatusMessage === 'string' && s.pixStatusMessage.trim()) {
      this.statusText = s.pixStatusMessage.trim();
    } else if (typeof s?.pixAsaasStatus === 'string' && s.pixAsaasStatus.trim()) {
      const st = s.pixAsaasStatus.trim().toUpperCase();
      if (st === 'PENDING') {
        this.statusText = 'PIX enviado — aguardando confirmação';
      } else if (st === 'DONE' || st === 'CONFIRMED') {
        this.statusText = 'Transferência concluída';
      }
    }
  }

  private async startPixTransferInfoPolling(): Promise<void> {
    this.pixInfoPolling = true;
    await this.fetchPixTransferInfoOnce();
    if (this.pixTransferDone) {
      this.pixInfoPolling = false;
      return;
    }
    this.pixInfoIntervalId = setInterval(() => {
      void this.fetchPixTransferInfoOnce();
    }, this.pixInfoIntervalMs);
  }

  private stopPixInfoPolling(): void {
    if (this.pixInfoIntervalId != null) {
      clearInterval(this.pixInfoIntervalId);
      this.pixInfoIntervalId = null;
    }
    this.pixInfoPolling = false;
  }

  private async fetchPixTransferInfoOnce(): Promise<void> {
    if (this.pixTransferDone || !this.pixTransferIdInternal || this.pixInfoFetchInFlight) {
      return;
    }
    this.pixInfoAttempts += 1;
    if (this.pixInfoAttempts > this.pixInfoMaxAttempts) {
      this.stopPixInfoPolling();
      this.ngZone.run(() => {
        this.statusText = 'Em processamento — confira seu extrato em instantes';
      });
      const toast = await this.toastController.create({
        message:
          'Não foi possível confirmar o status final agora. O PIX pode seguir em processamento; verifique seu extrato.',
        duration: 4000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const access = this.authSession.getAccessToken();
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    if (!access || !sourceToken) {
      this.stopPixInfoPolling();
      return;
    }

    this.pixInfoFetchInFlight = true;
    try {
      if (this.pixInfoPollKind === 'qr_transaction') {
        const data = await this.pixTransactionInfo.fetchInfo(
          access,
          sourceToken,
          this.pixTransferIdInternal,
        );
        this.ngZone.run(() => {
          if (!data) {
            return;
          }
          if (data.success !== true) {
            return;
          }
          this.applyPixTransactionInfo(data);
          const st = this.resolveTransactionStatus(data);
          if (st === 'DONE') {
            this.pixTransferDone = true;
            this.statusText = 'Pagamento concluído';
            this.stopPixInfoPolling();
            return;
          }
          if (this.isFailureStatus(st)) {
            const reason =
              (data.summary?.fail_reason ?? data.asaas?.failReason ?? '').trim() ||
              'Pagamento não concluído.';
            this.statusText = reason;
            this.pixTransferFailed = true;
            this.pixTransferDone = true;
            this.stopPixInfoPolling();
            return;
          }
          this.statusText = 'Em processamento';
        });
      } else {
        const data = await this.pixTransferInfo.fetchInfo(
          access,
          sourceToken,
          this.pixTransferIdInternal,
        );
        this.ngZone.run(() => {
          if (!data) {
            return;
          }
          if (data.success !== true) {
            return;
          }
          this.applyPixTransferInfo(data);
          const st = this.resolveTransferStatus(data);
          if (st === 'DONE') {
            this.pixTransferDone = true;
            this.statusText = 'Transferência concluída';
            this.stopPixInfoPolling();
            return;
          }
          if (this.isFailureStatus(st)) {
            const reason =
              (data.summary?.fail_reason ?? data.asaas?.failReason ?? '').trim() ||
              'Transferência não concluída.';
            this.statusText = reason;
            this.pixTransferFailed = true;
            this.pixTransferDone = true;
            this.stopPixInfoPolling();
            return;
          }
          this.statusText = 'Em processamento';
        });
      }
    } finally {
      this.pixInfoFetchInFlight = false;
    }
  }

  private resolveTransferStatus(data: PixTransferInfoResponse): string {
    const a = (data.summary?.status ?? '').trim().toUpperCase();
    const b = (data.asaas?.status ?? '').trim().toUpperCase();
    if (a === 'DONE' || b === 'DONE') {
      return 'DONE';
    }
    if (a) {
      return a;
    }
    return b;
  }

  private resolveTransactionStatus(data: PixTransactionInfoResponse): string {
    const a = (data.summary?.status ?? '').trim().toUpperCase();
    const b = (data.asaas?.status ?? '').trim().toUpperCase();
    if (a === 'DONE' || b === 'DONE') {
      return 'DONE';
    }
    if (a) {
      return a;
    }
    return b;
  }

  private isFailureStatus(st: string): boolean {
    return [
      'FAILED',
      'CANCELLED',
      'CANCELED',
      'REFUSED',
      'ERROR',
      'REFUNDED',
      'REFOUND',
    ].includes(st);
  }

  private applyPixTransactionInfo(data: PixTransactionInfoResponse): void {
    const e2e = data.summary?.end_to_end_identifier ?? data.asaas?.endToEndIdentifier;
    if (typeof e2e === 'string' && e2e.trim()) {
      this.identifier = e2e.trim();
    }
    const effRaw = data.summary?.payment_date ?? data.asaas?.effectiveDate;
    if (typeof effRaw === 'string' && effRaw.trim()) {
      const parsed = this.parseEffectiveDateTime(effRaw.trim());
      if (parsed) {
        this.receiptSubtitle = this.formatReceiptSubtitle(parsed);
      }
    } else {
      const eff2 = data.asaas?.effectiveDate;
      if (typeof eff2 === 'string' && eff2.trim()) {
        const parsed = this.parseEffectiveDateTime(eff2.trim());
        if (parsed) {
          this.receiptSubtitle = this.formatReceiptSubtitle(parsed);
        }
      }
    }
    const ext = data.asaas?.externalAccount;
    if (ext?.name?.trim()) {
      this.beneficiaryName = ext.name.trim();
    }
    if (ext?.ispbName?.trim()) {
      this.beneficiaryBank = ext.ispbName.trim();
    }
    if (ext?.cpfCnpj?.trim()) {
      this.documentMasked = ext.cpfCnpj.trim();
    }
    this.syncBankShort();
  }

  private applyPixTransferInfo(data: PixTransferInfoResponse): void {
    const e2e = data.summary?.end_to_end_identifier ?? data.asaas?.endToEndIdentifier;
    if (typeof e2e === 'string' && e2e.trim()) {
      this.identifier = e2e.trim();
    }
    const effRaw = data.summary?.effective_date ?? data.asaas?.effectiveDate;
    if (typeof effRaw === 'string' && effRaw.trim()) {
      const parsed = this.parseEffectiveDateTime(effRaw.trim());
      if (parsed) {
        this.receiptSubtitle = this.formatReceiptSubtitle(parsed);
      }
    }
    const r = data.summary?.recipient;
    if (r) {
      if (r.owner_name?.trim()) {
        this.beneficiaryName = r.owner_name.trim();
      }
      if (r.bank_name?.trim()) {
        this.beneficiaryBank = r.bank_name.trim();
      }
      if (r.cpf_cnpj?.trim()) {
        this.documentMasked = r.cpf_cnpj.trim();
      }
    }
    this.syncBankShort();
  }

  private syncBankShort(): void {
    this.beneficiaryBankShort = this.extractBankShortName(this.beneficiaryBank);
  }

  /** Duas letras a partir do nome da instituição (ex.: NU PAGAMENTOS → NU). */
  private extractBankShortName(name: string): string {
    const upper = (name || '').trim().toUpperCase();
    if (!upper) {
      return 'BK';
    }
    const words = upper.split(/\s+/).filter((w) => w.length > 1);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.slice(0, 2);
    }
    return upper.slice(0, 2);
  }

  /**
   * API: `summary.effective_date` ou `asaas.effectiveDate` (ex.: `2026-03-27 01:06:33`).
   * Exibe: `Em dd/mm/aaaa, h:mmAM` ou `PM`.
   */
  private parseEffectiveDateTime(raw: string): Date | null {
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        m[6] ? Number(m[6]) : 0,
      );
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private formatReceiptSubtitle(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) {
      h = 12;
    }
    return `Em ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${h}:${pad(d.getMinutes())}${ampm}`;
  }

  private buildReceiptDateTime(): string {
    return this.formatReceiptSubtitle(new Date());
  }

  /** Ex.: `2026-03-30 09:00:00` → texto legível em pt-BR. */
  private formatBoletoScheduleSubtitle(raw: string): string {
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) {
      return raw;
    }
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
    );
    if (Number.isNaN(d.getTime())) {
      return raw;
    }
    return this.formatReceiptSubtitle(d);
  }
}
