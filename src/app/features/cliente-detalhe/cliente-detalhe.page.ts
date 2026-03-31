import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  NavController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';

import { ChargesBoletosListService } from '../../services/charges-boletos-list.service';
import type { CentralClient } from '../../services/clients-list.service';
import { ClientsListService } from '../../services/clients-list.service';
import { ClientsDeleteService } from '../../services/clients-delete.service';
import { ClientsUpdateService } from '../../services/clients-update.service';
import { NovaCobrancaClientePrefillService } from '../../services/nova-cobranca-cliente-prefill.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { ExtratoGeralService } from '../../services/extrato-geral.service';
import {
  buildClienteHistoricoItems,
  type ClienteHistoricoItem,
} from '../../shared/utils/cliente-historico.util';
import {
  digitsOnly,
  formatCepMask,
  formatCpfCnpjMask,
  formatWhatsappBrMask,
  isValidCepDigits,
  isValidDocumentDigits,
} from '../../shared/utils/client-form-mask.util';
import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-cliente-detalhe',
  templateUrl: './cliente-detalhe.page.html',
  styleUrls: ['./cliente-detalhe.page.scss'],
  standalone: false,
})
export class ClienteDetalhePage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-551d7cb4-ea42-4617-adb3-2d33f5ed3da9.svg`;

  selectedTab: 'info' | 'history' = 'info';
  editMode = false;

  client: CentralClient | null = null;
  loadError: string | null = null;
  loadingClient = false;

  name = '';
  documentDisplay = '';
  email = '';
  whatsappDisplay = '';
  cepDisplay = '';
  number = '';

  attemptedSave = false;
  saveBusy = false;
  deleteBusy = false;

  historicoLoading = false;
  historicoLoadError: string | null = null;
  historicoItems: ClienteHistoricoItem[] = [];

  /** Preenchido na navegação a partir da lista; consumido uma vez em `loadClient`. */
  private pendingStateClient: CentralClient | null;
  private readonly navController = inject(NavController);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly clientsListService = inject(ClientsListService);
  private readonly clientsUpdateService = inject(ClientsUpdateService);
  private readonly clientsDeleteService = inject(ClientsDeleteService);
  private readonly extratoGeralService = inject(ExtratoGeralService);
  private readonly chargesBoletosListService = inject(ChargesBoletosListService);
  private readonly novaCobrancaClientePrefill = inject(NovaCobrancaClientePrefillService);

  constructor() {
    const nav = this.router.getCurrentNavigation();
    this.pendingStateClient =
      (nav?.extras?.state as { client?: CentralClient } | undefined)?.client ?? null;
  }

  get pageTitle(): string {
    const c = this.client;
    if (!c) {
      return 'Cliente';
    }
    const name = [c.name, c.last_name].filter((x) => (x ?? '').trim()).join(' ').trim();
    return name.length > 0 ? name : 'Cliente';
  }

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadClient();
    if (this.selectedTab === 'history') {
      void this.loadHistorico();
    }
  }

  goBack(): void {
    void this.navController.back();
  }

  /** Abre Nova Cobrança com este cliente já selecionado (`cus_id` na cobrança). */
  goToCobrar(): void {
    const c = this.client;
    if (!c) {
      return;
    }
    this.novaCobrancaClientePrefill.setPendingClient(c);
    void this.navController.navigateForward('/nova-cobranca');
  }

  onSegmentChange(ev: CustomEvent): void {
    const v = ev.detail?.value;
    if (v === 'info' || v === 'history') {
      this.selectedTab = v;
      if (v === 'history') {
        void this.loadHistorico();
      }
    }
  }

  onEditToggle(ev: CustomEvent): void {
    const checked = Boolean(ev.detail?.checked);
    this.editMode = checked;
    if (!checked) {
      this.attemptedSave = false;
      if (this.client) {
        this.applyClientToForm(this.client);
      }
    }
  }

  onDocumentInput(ev: Event): void {
    if (!this.editMode) {
      return;
    }
    const el = ev.target as HTMLInputElement;
    this.documentDisplay = formatCpfCnpjMask(el.value);
  }

  onCepInput(ev: Event): void {
    if (!this.editMode) {
      return;
    }
    const el = ev.target as HTMLInputElement;
    this.cepDisplay = formatCepMask(el.value);
  }

  onWhatsappInput(ev: Event): void {
    if (!this.editMode) {
      return;
    }
    const el = ev.target as HTMLInputElement;
    this.whatsappDisplay = formatWhatsappBrMask(el.value);
  }

  get nameError(): string | null {
    if (!this.attemptedSave) {
      return null;
    }
    const t = this.name.trim();
    if (!t) {
      return 'Informe o nome completo.';
    }
    if (t.length < 2) {
      return 'Nome muito curto.';
    }
    return null;
  }

  get documentError(): string | null {
    if (!this.attemptedSave) {
      return null;
    }
    const d = digitsOnly(this.documentDisplay);
    if (!isValidDocumentDigits(d)) {
      return 'CPF (11 dígitos) ou CNPJ (14 dígitos).';
    }
    return null;
  }

  get emailError(): string | null {
    if (!this.attemptedSave) {
      return null;
    }
    const t = this.email.trim();
    if (!t) {
      return 'Informe o e-mail.';
    }
    if (!EMAIL_RE.test(t)) {
      return 'E-mail inválido.';
    }
    return null;
  }

  get whatsappError(): string | null {
    if (!this.attemptedSave) {
      return null;
    }
    const d = digitsOnly(this.whatsappDisplay);
    if (d.length < 10 || d.length > 11) {
      return 'DDD + número (10 ou 11 dígitos).';
    }
    return null;
  }

  get cepError(): string | null {
    if (!this.attemptedSave) {
      return null;
    }
    const d = digitsOnly(this.cepDisplay);
    if (!isValidCepDigits(d)) {
      return 'CEP com 8 dígitos.';
    }
    return null;
  }

  get numberError(): string | null {
    if (!this.attemptedSave) {
      return null;
    }
    if (!this.number.trim()) {
      return 'Informe o número.';
    }
    return null;
  }

  private isFormValid(): boolean {
    return (
      !this.nameError &&
      !this.documentError &&
      !this.emailError &&
      !this.whatsappError &&
      !this.cepError &&
      !this.numberError
    );
  }

  async onSave(): Promise<void> {
    this.attemptedSave = true;
    if (!this.isFormValid()) {
      const t = await this.toastController.create({
        message: 'Verifique os campos destacados.',
        duration: 2800,
        color: 'warning',
        position: 'top',
      });
      void t.present();
      return;
    }

    const accessToken = this.authSession.getAccessToken()?.trim();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    const c = this.client;
    if (!accessToken || !walletToken || !c) {
      const t = await this.toastController.create({
        message: 'Sessão ou carteira indisponível.',
        duration: 3200,
        color: 'danger',
        position: 'top',
      });
      void t.present();
      return;
    }

    this.saveBusy = true;
    try {
      const body = {
        wallet_token: walletToken,
        client_id: c.id,
        name: this.name.trim(),
        document: digitsOnly(this.documentDisplay),
        email: this.email.trim(),
        whatsapp: digitsOnly(this.whatsappDisplay),
        zip_code: digitsOnly(this.cepDisplay),
        number: this.number.trim(),
      };

      const res = await this.clientsUpdateService.update(accessToken, body);
      if (!res) {
        const t = await this.toastController.create({
          message: 'Não foi possível atualizar. Tente novamente.',
          duration: 3200,
          color: 'danger',
          position: 'top',
        });
        void t.present();
        return;
      }

      if (res.success === true && res.client) {
        this.client = res.client;
        this.applyClientToForm(res.client);
        this.editMode = false;
        this.attemptedSave = false;
        const msg = res.message?.trim() || 'Cliente atualizado.';
        const toast = await this.toastController.create({
          message: msg,
          duration: 2600,
          color: 'success',
          position: 'top',
        });
        void toast.present();
        return;
      }

      const errMsg = res.message?.trim() || 'Não foi possível atualizar o cliente.';
      const t = await this.toastController.create({
        message: errMsg,
        duration: 3800,
        color: 'danger',
        position: 'top',
      });
      void t.present();
    } finally {
      this.saveBusy = false;
    }
  }

  async confirmDelete(): Promise<void> {
    const c = this.client;
    if (!c) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Excluir cliente',
      message: `Deseja excluir ${this.pageTitle}? Esta ação não pode ser desfeita.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Deletar',
          role: 'destructive',
          handler: () => {
            void this.executeDelete();
          },
        },
      ],
    });
    await alert.present();
  }

  private async executeDelete(): Promise<void> {
    const accessToken = this.authSession.getAccessToken()?.trim();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    const c = this.client;
    if (!accessToken || !walletToken || !c) {
      const t = await this.toastController.create({
        message: 'Sessão ou carteira indisponível.',
        duration: 3200,
        color: 'danger',
        position: 'top',
      });
      void t.present();
      return;
    }

    this.deleteBusy = true;
    try {
      const res = await this.clientsDeleteService.delete(accessToken, {
        wallet_token: walletToken,
        client_id: c.id,
      });
      if (!res) {
        const t = await this.toastController.create({
          message: 'Não foi possível excluir. Tente novamente.',
          duration: 3200,
          color: 'danger',
          position: 'top',
        });
        void t.present();
        return;
      }

      if (res.success === true) {
        const msg = res.message?.trim() || 'Cliente excluído.';
        const toast = await this.toastController.create({
          message: msg,
          duration: 2600,
          color: 'success',
          position: 'top',
        });
        void toast.present();
        void this.navController.back();
        return;
      }

      const errMsg = res.message?.trim() || 'Não foi possível excluir o cliente.';
      const t = await this.toastController.create({
        message: errMsg,
        duration: 3800,
        color: 'danger',
        position: 'top',
      });
      void t.present();
    } finally {
      this.deleteBusy = false;
    }
  }

  async openHistoricoItem(item: ClienteHistoricoItem): Promise<void> {
    if (item.kind === 'cobranca') {
      void this.navController.navigateForward(['/cobranca', item.boletoId]);
      return;
    }

    const row = item.row;
    if (row.extratoBoleto) {
      const p = row.extratoBoleto;
      const linhaDigits = p.digitavel.replace(/\D/g, '');
      const state: ComprovantePaymentNavState = {
        transferKind: 'boleto',
        boletoExtratoSource: true,
        amountDisplay: row.amountDisplay,
        beneficiaryName: row.displayName,
        beneficiaryBank: row.beneficiaryBank,
        documentMasked: row.documentMasked ?? '—',
        boletoLinhaDigitavelDigits: linhaDigits,
        boletoLinhaResumo: p.digitavel,
        boletoExtratoStatus: p.status,
        boletoExtratoPaymentDateBr: p.payment_date_br,
        boletoExtratoPaymentDate: p.paymentDate,
        boletoExtratoBoletoId: p.boleto_id,
        boletoExtratoBillId: p.bill_id,
      };
      await this.navController.navigateForward('/comprovante-payment', { state });
      return;
    }

    const id = row.pixTransferId?.trim();
    if (!id) {
      const t = await this.toastController.create({
        message: 'Detalhe deste lançamento não está disponível no app.',
        duration: 2600,
        position: 'top',
      });
      void t.present();
      return;
    }

    const state: ComprovantePaymentNavState = {
      transferKind: 'pix',
      pixTransferId: id,
      amountDisplay: row.amountDisplay,
      beneficiaryName: row.displayName,
      beneficiaryBank: row.beneficiaryBank,
      documentMasked: '—',
      ...(row.pixExtratoRecebido
        ? {
            pixExtratoIncoming: true,
            extratoPixOStatus: row.extratoPixOStatus,
          }
        : {}),
    };

    await this.navController.navigateForward('/comprovante-payment', { state });
  }

  /** Data/hora para exibição na lista do histórico. */
  historicoDateLabel(item: ClienteHistoricoItem): string {
    const d = new Date(item.atMs);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByHistorico(_index: number, item: ClienteHistoricoItem): string {
    if (item.kind === 'cobranca') {
      return `b-${item.boletoId}`;
    }
    return `e-${item.atMs}-${item.row.kindTag}-${item.row.displayName}`;
  }

  historicoKindLabel(item: ClienteHistoricoItem): string {
    if (item.kind === 'cobranca') {
      return 'Cobrança';
    }
    const tag = item.row.kindTag;
    if (tag === 'boleto') {
      return 'Boleto';
    }
    if (tag === 'pix') {
      return 'PIX';
    }
    return tag;
  }

  private async loadClient(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (!Number.isFinite(id)) {
      this.loadError = 'Cliente inválido.';
      this.client = null;
      return;
    }

    if (this.pendingStateClient && this.pendingStateClient.id === id) {
      this.client = this.pendingStateClient;
      this.pendingStateClient = null;
      this.applyClientToForm(this.client);
      this.loadError = null;
      return;
    }

    const access = this.authSession.getAccessToken()?.trim();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!access || !walletToken) {
      this.loadError = 'Carteira não encontrada.';
      this.client = null;
      return;
    }

    this.loadingClient = true;
    this.loadError = null;
    const data = await this.clientsListService.fetchList(access, walletToken);
    this.loadingClient = false;

    if (!data || data.success !== true || !Array.isArray(data.clients)) {
      this.loadError = 'Não foi possível carregar o cliente.';
      this.client = null;
      return;
    }

    const found = data.clients.find((c) => c.id === id);
    if (!found) {
      this.loadError = 'Cliente não encontrado.';
      this.client = null;
      return;
    }

    this.client = found;
    this.applyClientToForm(found);
  }

  private applyClientToForm(c: CentralClient): void {
    const first = (c.name ?? '').trim();
    const last = (c.last_name ?? '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    this.name = full || first;
    this.documentDisplay = formatCpfCnpjMask(c.document ?? '');
    this.email = (c.email ?? '').trim();
    this.whatsappDisplay = formatWhatsappBrMask((c.whatsapp ?? '').replace(/\D/g, ''));
    this.cepDisplay = formatCepMask((c.zip_code ?? '').replace(/\D/g, ''));
    this.number = (c.number ?? '').trim();
  }

  private async loadHistorico(): Promise<void> {
    this.historicoLoadError = null;
    const c = this.client;
    if (!c) {
      return;
    }

    if (this.historicoLoading) {
      return;
    }

    const accessToken = this.authSession.getAccessToken()?.trim();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!accessToken || !walletToken) {
      this.historicoLoadError = 'Sessão indisponível.';
      return;
    }

    this.historicoLoading = true;
    const [ext, bol] = await Promise.all([
      this.extratoGeralService.fetchExtrato(accessToken, walletToken),
      this.chargesBoletosListService.fetchList(accessToken, walletToken),
    ]);
    this.historicoLoading = false;

    const ops = ext?.success === true && Array.isArray(ext.operacoes) ? ext.operacoes : [];
    const bItems = bol?.success === true && Array.isArray(bol.items) ? bol.items : [];

    const docDigits = digitsOnly(c.document ?? '');
    this.historicoItems = buildClienteHistoricoItems(ops, bItems, c.id, c.cus_id, docDigits);

    const parts: string[] = [];
    if (!ext || ext.success !== true) {
      parts.push('extrato');
    }
    if (!bol || bol.success !== true) {
      parts.push('cobranças');
    }
    this.historicoLoadError =
      parts.length > 0 ? `Não foi possível carregar: ${parts.join(' e ')}.` : null;
  }
}
