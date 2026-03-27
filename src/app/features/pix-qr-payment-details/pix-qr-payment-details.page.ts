import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import type { PixQrDecodeResponse } from '../../services/pix-qr-decode.service';
import { formatBrlNumber, normalizeMoneyValue } from '../../utils/brl-format';

export interface PixQrPaymentDetailsNavState {
  qrPayload?: string;
  decodeData?: PixQrDecodeResponse;
}

@Component({
  selector: 'app-pix-qr-payment-details',
  templateUrl: './pix-qr-payment-details.page.html',
  styleUrls: ['./pix-qr-payment-details.page.scss'],
  standalone: false,
})
export class PixQrPaymentDetailsPage implements OnInit {
  /** Conteúdo bruto lido do QR (ex.: copia-e-cola PIX). Exibido em Identificador. */
  qrPayload = '';

  amountCurrency = 'R$';
  amountValue = '1.000,00';
  payeeShort = 'CPFLEnergia';

  institutionLabel = 'Instituição';
  institutionName = 'NU PAGAMENTOS - IP';

  beneficiaryLabel = 'Para / beneficiário';
  beneficiaryName = 'Cpfl Cia Paulista D Forca Luz';

  documentLabel = 'Documento';
  documentValue = '18.236.120/0001-50';

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

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const state = history.state as PixQrPaymentDetailsNavState;
    const raw = (state?.qrPayload ?? '').trim();
    this.qrPayload = raw;

    if (!raw) {
      void this.navController.navigateRoot('/dashboard');
      return;
    }

    const data = state?.decodeData;
    const summary = data?.summary;
    const asaas = data?.asaas;
    if (summary || asaas) {
      const total = normalizeMoneyValue(asaas?.totalValue ?? summary?.valor ?? 0);
      this.amountValue = formatBrlNumber(total);
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

  goBack(): void {
    this.navController.navigateBack('/qr-scan');
  }

  onPay(): void {
    void this.router.navigate(['/boleto-payment-success'], {
      state: {
        amountFormatted: this.amountValue,
        beneficiary: this.payeeShort,
        qrPayload: this.qrPayload,
      },
    });
  }

  private moneyLabel(raw: number): string {
    return `R$ ${formatBrlNumber(normalizeMoneyValue(raw))}`;
  }
}
