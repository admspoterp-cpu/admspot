import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';

import {
  BoletoBarcodeService,
  type BoletoBankSlipInfo,
  type BoletoBarcodeResponse,
} from '../../services/boleto-barcode.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { formatBrlNumber, normalizeMoneyValue } from '../../utils/brl-format';

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

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly authSession = inject(AuthSessionService);
  private readonly boletoBarcode = inject(BoletoBarcodeService);

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
    this.barcodeDisplay = this.formatBarcodeForDisplay(raw);
    void this.loadBoletoDetails(raw, this.detailsSource);
  }

  goBack(): void {
    void this.navController.navigateBack(
      this.detailsSource === 'manual' ? '/boleto-manual' : '/boleto-scan',
    );
  }

  onPay(): void {
    void this.router.navigate(['/boleto-payment-success'], {
      state: {
        amountFormatted: this.amountValue,
        beneficiary: this.payeeShort || this.beneficiaryName,
        barcode: this.barcodeDigits,
      },
    });
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
    const normalizedBarcode = (data.barcode ?? data.barcode_input ?? this.barcodeDigits).replace(
      /\D/g,
      '',
    );
    if (normalizedBarcode) {
      this.barcodeDigits = normalizedBarcode;
      this.barcodeDisplay = this.formatBarcodeForDisplay(normalizedBarcode);
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
    this.identificationDisplay = idField
      ? idField.length === 47
        ? this.formatLinhaDigitavel(idField)
        : this.formatBarcodeForDisplay(idField)
      : '';

    const due = parseDueDateToIso(slip.dueDate);
    this.dueDateIso = due ?? '';

    /** Agendamento sempre na data atual (regra de produto). */
    this.paymentDateIso = this.todayIsoLocal();
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

  /**
   * Exibe o código em blocos legíveis (similar ao mockup com quebras de linha).
   */
  private formatBarcodeForDisplay(digits: string): string {
    if (!digits) {
      return '';
    }

    if (digits.length === 47) {
      return this.formatLinhaDigitavel(digits);
    }

    const lines: string[] = [];
    const chunk = 11;
    for (let i = 0; i < digits.length; i += chunk) {
      lines.push(digits.slice(i, i + chunk));
    }
    return lines.join('\n');
  }

  /**
   * Formato visual próximo à linha digitável (47 dígitos).
   */
  private formatLinhaDigitavel(d: string): string {
    if (d.length !== 47) {
      return d;
    }
    const a = `${d.slice(0, 5)}.${d.slice(5, 10)}`;
    const b = `${d.slice(10, 15)}.${d.slice(15, 21)}`;
    const c = `${d.slice(21, 26)}.${d.slice(26, 32)}`;
    const dv = d.slice(32, 33);
    const f = d.slice(33);
    return `${a} ${b}\n${c} ${dv} ${f}`;
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
