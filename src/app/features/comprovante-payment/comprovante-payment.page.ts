import { Component, OnInit, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

import { PixReceiptShareService } from '../../services/pix-receipt-share.service';

/** Estado enviado por `pay-transfer-pix` ou `transfer-ted-info` ao concluir pagamento */
export interface ComprovantePaymentNavState {
  amountDisplay?: string;
  beneficiaryName?: string;
  beneficiaryBank?: string;
  documentMasked?: string;
  pixKey?: string;
  /** Afeta título na tela e texto do PDF em Compartilhar */
  transferKind?: 'pix' | 'ted';
}

@Component({
  selector: 'app-comprovante-payment',
  templateUrl: './comprovante-payment.page.html',
  styleUrls: ['./comprovante-payment.page.scss'],
  standalone: false,
})
export class ComprovantePaymentPage implements OnInit {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly pixReceiptShareService = inject(PixReceiptShareService);

  amountDisplay = '5.000,00';
  beneficiaryName = 'Ana Laura de Oliveira';
  beneficiaryBank = 'NU PAGAMENTOS - IP';
  documentMasked = '***.950.521.**';
  transactionType = 'Conta de Pagamentos';
  transactionId = 'E8478484558778566987874459877446998';
  identifier = 'NGS000000667911237829202';
  statusText = 'Transferência realizada';

  receiptSubtitle = '';

  /** Origem do fluxo — define rótulos “PIX” vs “TED” */
  transferKind: 'pix' | 'ted' = 'pix';

  ngOnInit(): void {
    this.receiptSubtitle = this.buildReceiptDateTime();

    const s = history.state as ComprovantePaymentNavState & Record<string, unknown>;
    if (s?.transferKind === 'ted' || s?.transferKind === 'pix') {
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
  }

  goBack(): void {
    void this.navController.navigateRoot('/dashboard');
  }

  get successHeroTitle(): string {
    return this.transferKind === 'ted' ? 'Transferência TED Realizada' : 'Transferência Pix Realizada';
  }

  async onShare(): Promise<void> {
    try {
      await this.pixReceiptShareService.shareAsPdf(this.getReceiptPayload(), this.shareOptionsForKind());
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
      await this.pixReceiptShareService.shareAsPdf(this.getReceiptPayload(), {
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
    return {
      shareTitle: this.transferKind === 'ted' ? 'Comprovante TED' : 'Comprovante PIX',
    };
  }

  private getReceiptPayload() {
    return {
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
  }

  async onRepeatTransaction(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Repetir transação em breve',
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }

  async onReportTransaction(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Reportar transação em breve',
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }

  private buildReceiptDateTime(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) {
      h = 12;
    }
    return `Em ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${h}:${pad(d.getMinutes())}${ampm}`;
  }
}
