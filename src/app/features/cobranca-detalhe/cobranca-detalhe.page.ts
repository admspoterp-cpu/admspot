import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { NavController, ToastController } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';
import {
  ChargesBoletoStatusService,
  type BoletoLocalDetail,
  type BoletoStatusResponse,
} from '../../services/charges-boleto-status.service';
import { formatBrlNumber } from '../../utils/brl-format';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

const CHECKOUT_INVOICE_BASE = 'https://www.gestor.admspot.com.br/checkout/invoice';

@Component({
  selector: 'app-cobranca-detalhe',
  templateUrl: './cobranca-detalhe.page.html',
  styleUrls: ['./cobranca-detalhe.page.scss'],
  standalone: false,
})
export class CobrancaDetalhePage {
  readonly caretLeftSrc = `${G}/CaretLeft-77d56b40-35d9-43d6-b2cf-1c0fe9f481de.svg`;
  readonly shareIconSrc = `${G}/Export-63fe8722-8176-4139-8421-bdefb4f4a5dd.svg`;

  boletoId = 0;
  loading = true;
  loadError: string | null = null;

  private response: BoletoStatusResponse | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly boletoStatusService = inject(ChargesBoletoStatusService);
  private readonly toastController = inject(ToastController);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    const raw = this.route.snapshot.paramMap.get('boletoId');
    const id = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
      this.loading = false;
      this.loadError = 'Cobrança inválida.';
      return;
    }
    this.boletoId = id;
    void this.load();
  }

  get bl(): BoletoLocalDetail | null {
    return this.response?.boleto_local ?? null;
  }

  get clientName(): string {
    return (this.bl?.client_name ?? '').trim() || '—';
  }

  get invoiceNumberDisplay(): string {
    const a = this.response?.boleto_invoice_number?.trim();
    const b = this.bl?.boleto_invoice_number?.trim();
    return a || b || '—';
  }

  get statusBadgePago(): boolean {
    return (this.bl?.boleto_status ?? '').toUpperCase() === 'PAGO';
  }

  get statusBadgeCancelado(): boolean {
    return (this.bl?.boleto_status ?? '').toUpperCase() === 'CANCELADO';
  }

  get statusBadgeAguardando(): boolean {
    return !this.statusBadgePago && !this.statusBadgeCancelado;
  }

  get statusLabel(): string {
    return (this.bl?.boleto_status ?? '').trim() || '—';
  }

  get clientEmail(): string {
    return (this.bl?.client_email ?? '').trim() || '—';
  }

  get clientDocument(): string {
    const d = this.bl?.document;
    if (typeof d === 'string' && d.trim()) {
      return d.trim();
    }
    return '—';
  }

  get valorDestaque(): string {
    const c = this.bl?.valor;
    if (typeof c !== 'number' || !Number.isFinite(c)) {
      return '—';
    }
    return `R$ ${formatBrlNumber(c / 100)}`;
  }

  get vencimentoDestaque(): string {
    const raw = this.bl?.dueDate;
    if (!raw?.trim()) {
      return '—';
    }
    const d = new Date(String(raw).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) {
      return raw.trim();
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  get showJuros(): boolean {
    const v = this.bl?.interest_value;
    return typeof v === 'number' && Number.isFinite(v) && v !== 0;
  }

  get jurosLabel(): string {
    const v = this.bl?.interest_value;
    return v != null ? `${v}% a.m.` : '—';
  }

  get showMulta(): boolean {
    const v = this.bl?.fine_value;
    return typeof v === 'number' && Number.isFinite(v) && v !== 0;
  }

  get multaLabel(): string {
    const v = this.bl?.fine_value;
    const t = (this.bl?.fine_type ?? '').toLowerCase();
    if (v == null) {
      return '—';
    }
    if (t.includes('fix') || t === 'fixo') {
      return `R$ ${formatBrlNumber(Number(v))}`;
    }
    return `${v}%`;
  }

  get showDesconto(): boolean {
    const v = this.bl?.discount_value;
    return typeof v === 'number' && Number.isFinite(v) && v !== 0;
  }

  get descontoValorLabel(): string {
    const v = this.bl?.discount_value;
    if (v == null) {
      return '—';
    }
    const t = (this.bl?.discount_type ?? '').toLowerCase();
    if (t.includes('porcent') || t.includes('percent')) {
      return `${v}%`;
    }
    return `R$ ${formatBrlNumber(Number(v))}`;
  }

  get descontoPrazoLabel(): string {
    const d = this.bl?.discount_dueDateLimitDays;
    if (d == null || !Number.isFinite(Number(d))) {
      return '—';
    }
    return `${d} dia(s) antes do vencimento`;
  }

  get linhaDigitavel(): string {
    return (this.bl?.boleto_linha_digitavel ?? '').trim();
  }

  get pixPayload(): string {
    return (this.bl?.pix_payload ?? '').trim();
  }

  get pixQrImageUrl(): string {
    const p = this.pixPayload;
    if (!p) {
      return '';
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(p)}`;
  }

  /** Referência usada em /checkout/invoice/{ref} — API pode enviar camelCase ou snake_case em boleto_local ou asaas_payment. */
  get checkoutExternalRef(): string | null {
    const bl = this.bl;
    const ap = this.response?.asaas_payment;
    return (
      this.pickNonEmptyString(
        bl?.externalReference,
        bl != null ? this.recordString(bl, 'external_reference') : undefined,
        ap != null ? this.recordString(ap, 'externalReference') : undefined,
        ap != null ? this.recordString(ap, 'external_reference') : undefined,
      ) ?? null
    );
  }

  get checkoutShareUrl(): string | null {
    const ref = this.checkoutExternalRef;
    if (!ref) {
      return null;
    }
    return `${CHECKOUT_INVOICE_BASE}/${encodeURIComponent(ref)}`;
  }

  get canShareCheckout(): boolean {
    return this.checkoutShareUrl != null;
  }

  private pickNonEmptyString(...candidates: unknown[]): string | undefined {
    for (const c of candidates) {
      if (typeof c === 'string') {
        const t = c.trim();
        if (t.length > 0) {
          return t;
        }
      }
    }
    return undefined;
  }

  private recordString(obj: Record<string, unknown>, key: string): string | undefined {
    return this.pickNonEmptyString(obj[key]);
  }

  goBack(): void {
    void this.navController.back();
  }

  async onShareCheckout(): Promise<void> {
    const url = this.checkoutShareUrl;
    if (!url) {
      const toast = await this.toastController.create({
        message: 'Link de checkout indisponível para esta cobrança.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    const text = `Pagamento: ${url}`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'Cobrança',
          text,
          url,
          dialogTitle: 'Compartilhar cobrança',
        });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Cobrança', text, url });
        return;
      }
      await this.copyToClipboard(url, 'Link copiado.');
    } catch (e: unknown) {
      if (this.isUserCancelledShare(e)) {
        return;
      }
      await this.copyToClipboard(url, 'Link copiado.');
    }
  }

  private isUserCancelledShare(err: unknown): boolean {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : '';
    return msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort');
  }

  async copyLinhaDigitavel(): Promise<void> {
    const t = this.linhaDigitavel;
    if (!t) {
      return;
    }
    await this.copyToClipboard(t, 'Linha digitável copiada.');
  }

  async copyPixPayload(): Promise<void> {
    const t = this.pixPayload;
    if (!t) {
      return;
    }
    await this.copyToClipboard(t, 'Código PIX copiado.');
  }

  private async copyToClipboard(text: string, okMessage: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const toast = await this.toastController.create({
        message: okMessage,
        duration: 2000,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await this.toastController.create({
        message: 'Não foi possível copiar.',
        duration: 2200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
    }
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.loadError = null;
    this.response = null;

    const access = this.authSession.getAccessToken()?.trim();
    const wallet = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!access || !wallet) {
      this.loading = false;
      this.loadError = !access
        ? 'Sessão expirada. Faça login novamente.'
        : 'Carteira não encontrada.';
      return;
    }

    const data = await this.boletoStatusService.fetchStatus(access, wallet, this.boletoId);
    this.loading = false;

    if (!data) {
      this.loadError = 'Não foi possível carregar a cobrança.';
      return;
    }
    if (data.success !== true) {
      const msg = typeof data.message === 'string' ? data.message.trim() : '';
      this.loadError = msg.length > 0 ? msg : 'Não foi possível carregar a cobrança.';
      return;
    }
    this.response = data;
  }
}
