import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';

/** Navigation state key for barcode passed from boleto scanner. */
export interface BoletoPaymentDetailsNavState {
  barcode?: string;
}

@Component({
  selector: 'app-boleto-payment-details',
  templateUrl: './boleto-payment-details.page.html',
  styleUrls: ['./boleto-payment-details.page.scss'],
  standalone: false,
})
export class BoletoPaymentDetailsPage implements OnInit {
  /** Digits-only barcode from scan (source of truth). */
  barcodeDigits = '';

  /** Formatted for display under "Código de barras" (multi-line like mockup). */
  barcodeDisplay = '';

  /** Mock: até integração com API de consulta de boleto. */
  paymentScheduleLabel = 'Pagamento/Agendamento';
  dueDateLabel = 'Vencimento';

  /** ISO date strings para ion-datetime (yyyy-MM-dd). */
  paymentDateIso = '2023-05-24';
  dueDateIso = '2023-05-24';

  paymentDateModalOpen = false;
  dueDateModalOpen = false;
  amountCurrency = 'R$';
  amountValue = '1.000,00';
  payeeShort = 'CPFLEnergia';
  beneficiaryLabel = 'Para / beneficiário';
  beneficiaryName = 'Cpfl Cia Paulista D Forca Luz';

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const state = history.state as BoletoPaymentDetailsNavState;
    const raw = (state?.barcode ?? '').replace(/\D/g, '');

    this.barcodeDigits = raw;
    this.barcodeDisplay = this.formatBarcodeForDisplay(raw);

    if (!raw) {
      void this.navController.navigateRoot('/dashboard');
    }
  }

  goBack(): void {
    this.navController.navigateBack('/boleto-scan');
  }

  onPay(): void {
    void this.router.navigate(['/boleto-payment-success'], {
      state: {
        amountFormatted: this.amountValue,
        beneficiary: this.payeeShort,
        barcode: this.barcodeDigits,
      },
    });
  }

  get paymentDateDisplay(): string {
    return this.formatDateBrFromIso(this.paymentDateIso);
  }

  get dueDateDisplay(): string {
    return this.formatDateBrFromIso(this.dueDateIso);
  }

  openPaymentDateModal(): void {
    this.paymentDateModalOpen = true;
  }

  openDueDateModal(): void {
    this.dueDateModalOpen = true;
  }

  closePaymentDateModal(): void {
    this.paymentDateModalOpen = false;
  }

  closeDueDateModal(): void {
    this.dueDateModalOpen = false;
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
