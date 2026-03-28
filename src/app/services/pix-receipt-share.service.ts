import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface PixTransferReceiptData {
  receiptSubtitle: string;
  amountDisplay: string;
  beneficiaryName: string;
  beneficiaryBank: string;
  documentMasked: string;
  transactionType: string;
  transactionId: string;
  identifier: string;
  statusText: string;
  /** Quando TED, títulos do PDF seguem transferência TED */
  transferKind?: 'pix' | 'ted' | 'pix_qr' | 'boleto';
  /** Boleto: `bill_payment_id` — “ID da operação” no PDF */
  boletoOperationId?: string;
  /** Carteira padrão (origem) — mesmo critério da tela Depositar */
  originFullName?: string;
  originAgency?: string;
  originAccount?: string;
}

/** Opções do sheet nativo / título da Web Share API */
export interface PixReceiptShareOptions {
  /** Android: título do modal de compartilhamento */
  dialogTitle?: string;
  /** Título sugerido ao compartilhar (e-mail, drive, etc.) */
  shareTitle?: string;
}

@Injectable({ providedIn: 'root' })
export class PixReceiptShareService {
  /**
   * Gera um PDF com os dados do comprovante e abre o compartilhamento nativo
   * (Capacitor Share no app; Web Share API ou download no navegador).
   */
  async shareAsPdf(data: PixTransferReceiptData, options?: PixReceiptShareOptions): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = this.buildPdf(data, jsPDF);
    const fileName = `comprovante-pix-${Date.now()}.pdf`;

    if (Capacitor.isNativePlatform()) {
      await this.shareNativePdf(doc, fileName, data, options);
      return;
    }

    await this.shareWebPdf(doc, fileName, data, options);
  }

  private buildPdf(data: PixTransferReceiptData, jsPDF: typeof import('jspdf').jsPDF): import('jspdf').jsPDF {
    const isTed = data.transferKind === 'ted';
    const isPixQr = data.transferKind === 'pix_qr';
    const isBoleto = data.transferKind === 'boleto';
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(22, 45, 76);
    doc.text(
      isTed
        ? 'Comprovante de transferência TED'
        : isBoleto
          ? 'Comprovante de pagamento de boleto'
          : isPixQr
            ? 'Comprovante de pagamento PIX QR'
            : 'Comprovante de transferência PIX',
      margin,
      y
    );
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Admspot Finance', margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(27, 77, 140);
    doc.text(
      isTed
        ? 'Transferência TED realizada'
        : isBoleto
          ? 'Pagamento de boleto registrado'
          : isPixQr
            ? 'Pagamento Pix realizado'
            : 'Transferência Pix realizada',
      margin,
      y
    );
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const dateLines = doc.splitTextToSize(data.receiptSubtitle, contentW);
    doc.text(dateLines, margin, y);
    y += dateLines.length * 4.5 + 8;

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const addField = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(label, margin, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(value, contentW);
      doc.text(lines, margin, y);
      y += Math.max(lines.length * 4.8, 5) + 5;
    };

    const hasOrigin =
      Boolean(data.originFullName?.trim()) ||
      Boolean(data.originAgency?.trim()) ||
      Boolean(data.originAccount?.trim());

    if (hasOrigin) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(22, 45, 76);
      doc.text('Conta de origem', margin, y);
      y += 6;
      if (data.originFullName?.trim()) {
        addField('Nome completo', data.originFullName.trim());
      }
      if (data.originAgency?.trim()) {
        addField('Agência', data.originAgency.trim());
      }
      if (data.originAccount?.trim()) {
        addField('Conta', data.originAccount.trim());
      }
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
    }

    addField('Valor', `- R$ ${data.amountDisplay}`);
    addField('Beneficiário', data.beneficiaryName);
    if (!isBoleto) {
      addField('Instituição', data.beneficiaryBank);
    }
    addField('Documento do beneficiário', data.documentMasked);
    addField('Tipo de transação', data.transactionType);
    addField('ID da transação', data.transactionId);
    if (isBoleto && data.boletoOperationId?.trim()) {
      addField('ID da operação', data.boletoOperationId.trim());
    }
    const identifierForPdf = isBoleto
      ? data.identifier.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
      : data.identifier;
    addField(isBoleto ? 'Linha digitável (boleto)' : 'Identificador', identifierForPdf);
    addField('Estatus', data.statusText);

    y += 4;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    const year = new Date().getFullYear();
    const footerText = `Documento gerado pelo aplicativo Admspot Finance. Guarde este comprovante para sua referência. intermediada por © ${year} ADMSPOT TECNOLOGIA EM GESTÃO , sob tecnologias de ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTO S.A..`;
    const footer = doc.splitTextToSize(footerText, contentW);
    doc.text(footer, margin, y);

    return doc;
  }

  private async shareNativePdf(
    doc: import('jspdf').jsPDF,
    fileName: string,
    data: PixTransferReceiptData,
    options?: PixReceiptShareOptions
  ): Promise<void> {
    const dataUri = doc.output('datauristring');
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    const { uri } = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    const can = await Share.canShare();
    if (!can.value) {
      throw new Error('Compartilhamento não disponível neste dispositivo.');
    }

    const summary = `Transferência de R$ ${data.amountDisplay} para ${data.beneficiaryName}`;
    const shareTitle =
      options?.shareTitle ??
      (data.transferKind === 'ted'
        ? 'Comprovante TED'
        : data.transferKind === 'boleto'
          ? 'Comprovante boleto'
          : data.transferKind === 'pix_qr'
            ? 'Comprovante PIX QR'
            : 'Comprovante PIX');
    const dialogTitle = options?.dialogTitle ?? 'Compartilhar comprovante';
    const optionsBase = {
      title: shareTitle,
      text: summary,
      dialogTitle,
    };

    try {
      await Share.share({
        ...optionsBase,
        files: [uri],
      });
    } catch (err: unknown) {
      if (this.isUserCancelledShare(err)) {
        return;
      }
      try {
        await Share.share({
          ...optionsBase,
          url: uri,
        });
      } catch (err2: unknown) {
        if (this.isUserCancelledShare(err2)) {
          return;
        }
        throw err2;
      }
    }
  }

  private async shareWebPdf(
    doc: import('jspdf').jsPDF,
    fileName: string,
    data: PixTransferReceiptData,
    options?: PixReceiptShareOptions
  ): Promise<void> {
    const blob = doc.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const shareTitle =
      options?.shareTitle ??
      (data.transferKind === 'ted'
        ? 'Comprovante TED'
        : data.transferKind === 'boleto'
          ? 'Comprovante boleto'
          : data.transferKind === 'pix_qr'
            ? 'Comprovante PIX QR'
            : 'Comprovante PIX');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const payload: ShareData = {
          title: shareTitle,
          text: `Transferência de R$ ${data.amountDisplay} — ${data.beneficiaryName}`,
          files: [file],
        };
        if (navigator.canShare?.(payload)) {
          await navigator.share(payload);
          return;
        }
      } catch (err: unknown) {
        if (this.isUserCancelledShare(err)) {
          return;
        }
      }
    }

    this.downloadBlob(blob, fileName);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private isUserCancelledShare(err: unknown): boolean {
    if (!err || typeof err !== 'object') {
      return false;
    }
    const name = 'name' in err ? String((err as Error).name) : '';
    const message = 'message' in err ? String((err as Error).message).toLowerCase() : '';
    return (
      name === 'AbortError' ||
      message.includes('cancel') ||
      message.includes('canceled') ||
      message.includes('cancelled') ||
      message.includes('dismiss')
    );
  }
}
