import { Component, inject } from '@angular/core';
import { AlertController, NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { BRL_ZERO_DISPLAY, brlStringToCents } from '../../shared/utils/brl-currency.util';
import { AuthSessionService } from '../../services/auth-session.service';
import { NovaCobrancaClientePrefillService } from '../../services/nova-cobranca-cliente-prefill.service';
import {
  ChargesCreateService,
  extractBoletoIdFromCreateResponse,
  type ChargesCreateBody,
} from '../../services/charges-create.service';
import { ClientsListService, type CentralClient } from '../../services/clients-list.service';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

/** Valor mínimo exclusivo: cobrança exige valor superior a R$ 5,00 (centavos > 500). */
const MIN_VALOR_COBRANCA_CENTS = 500;

export type PercentOuFixo = '%' | 'FIXO';

@Component({
  selector: 'app-nova-cobranca',
  templateUrl: './nova-cobranca.page.html',
  styleUrls: ['./nova-cobranca.page.scss'],
  standalone: false,
})
export class NovaCobrancaPage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-77d56b40-35d9-43d6-b2cf-1c0fe9f481de.svg`;
  readonly caretRightClienteSrc = `${G}/CaretRight-052a6ba7-3269-4e9c-a1bf-4ceaae80695a.svg`;
  readonly toggleThumbOffSrc = `${G}/Frame427319592-b1090064-afb9-4539-80ff-86ef1ad31d05.svg`;
  readonly toggleThumbOnSrc = `${G}/Frame427319592-fe9f7831-fef8-43c3-bb6e-e8d3b7c66420.svg`;

  /** Cliente escolhido para a cobrança; `cus_id` é o enviado na geração. */
  selectedClient: CentralClient | null = null;

  clientSheetOpen = false;
  clientsLoading = false;
  clientsList: CentralClient[] = [];
  clientSearchQuery = '';

  /**
   * Máscara BRL (centavos) — mesmo padrão de `appBrlCurrency` em Transferência PIX / QR valor aberto.
   */
  valorCobranca = BRL_ZERO_DISPLAY;

  /** Data local (YYYY-MM-DD) para `ion-datetime`. */
  vencimentoIso = NovaCobrancaPage.isoDateDaysFromToday(7);

  vencimentoModalOpen = false;

  tipoCobranca: 'PIX_QRCODE' | 'BARCODE' | 'HIBRIDO' = 'PIX_QRCODE';

  readonly tipoCobrancaOptions = [
    { value: 'PIX_QRCODE' as const, label: 'PIX QrCode' },
    { value: 'BARCODE' as const, label: 'BARCODE' },
    { value: 'HIBRIDO' as const, label: 'HIBRIDO' },
  ] as const;

  readonly tipoCobrancaSelectInterfaceOptions = { header: 'Tipo de Cobrança' };

  readonly percentOuFixoOptions: { value: PercentOuFixo; label: string }[] = [
    { value: '%', label: '%' },
    { value: 'FIXO', label: 'FIXO' },
  ];

  readonly jurosTipoSelectInterfaceOptions = { header: 'Tipo (% ou Fixo)' };
  readonly descontoTipoSelectInterfaceOptions = { header: 'Tipo (% ou Fixo)' };

  /** Iniciam desligados; campos filhos só aparecem e ficam ativos quando ligados. */
  jurosMultaEnabled = false;
  descontoAntecipacaoEnabled = false;

  /** Quando tipo Juros é `%`: apenas dígitos (inteiro). Quando é `FIXO`: máscara BRL em `jurosValorFixo`. */
  jurosValorInt = '2';
  jurosValorFixo = BRL_ZERO_DISPLAY;
  jurosTipo: PercentOuFixo = '%';
  multaValor = '4';

  /** Quando tipo Desconto é `%`: inteiro. Quando `FIXO`: BRL em `descontoValorFixo`. */
  descontoValorInt = '2';
  descontoValorFixo = BRL_ZERO_DISPLAY;
  descontoTipo: PercentOuFixo = '%';
  /** Dias antes do vencimento em que o desconto vale (inteiro ≥ 1). */
  descontoDias = '4';

  /** Opcional; independente dos switches de juros e desconto. */
  descricao = '';

  gerarCobrancaBusy = false;

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly clientsListService = inject(ClientsListService);
  private readonly chargesCreateService = inject(ChargesCreateService);
  private readonly cobrancaClientePrefill = inject(NovaCobrancaClientePrefillService);

  get clientName(): string {
    return this.selectedClient ? NovaCobrancaPage.fullName(this.selectedClient) : 'Selecione o cliente';
  }

  get clientInitials(): string {
    if (!this.selectedClient) {
      return '—';
    }
    return NovaCobrancaPage.initialsFromClient(this.selectedClient);
  }

  get clientAvatarBg(): string {
    if (!this.selectedClient) {
      return '#c8c8cc';
    }
    const key = this.selectedClient.cus_id?.trim() || String(this.selectedClient.id);
    return NovaCobrancaPage.avatarColorForKey(key);
  }

  /** `cus_id` para payload de cobrança (pode ser null na API). */
  get selectedClientCusId(): string | null {
    return this.selectedClient?.cus_id?.trim() || null;
  }

  get clientsFilteredSorted(): CentralClient[] {
    return NovaCobrancaPage.filterAndSortClients(this.clientsList, this.clientSearchQuery);
  }

  get vencimentoDisplay(): string {
    return NovaCobrancaPage.formatIsoDateBr(this.vencimentoIso);
  }

  get minVencimentoIso(): string {
    return NovaCobrancaPage.isoDateFromLocalToday();
  }

  /** Dias corridos entre hoje e o vencimento (0 = hoje, negativo = vencimento passou). */
  get diasAteVencimento(): number {
    const due = NovaCobrancaPage.parseLocalDateFromIso(this.vencimentoIso);
    return NovaCobrancaPage.calendarDaysFromTodayTo(due);
  }

  get vencimentoFeedback(): string | null {
    if (this.diasAteVencimento < 0) {
      return 'Data de vencimento já passou. Escolha uma data futura.';
    }
    return null;
  }

  get diasAntecipacaoError(): string | null {
    if (!this.descontoAntecipacaoEnabled) {
      return null;
    }
    const raw = String(this.descontoDias ?? '').trim();
    if (raw === '') {
      return 'Informe quantos dias antes do vencimento.';
    }
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) {
      return 'Use apenas números inteiros.';
    }
    if (n < 1) {
      return 'Informe pelo menos 1 dia antes do vencimento.';
    }
    const ate = this.diasAteVencimento;
    if (ate < 0) {
      return 'Ajuste a data de vencimento antes de definir os dias.';
    }
    if (n > ate) {
      return `Os dias de pagamento antecipado ultrapassam o prazo até a data de vencimento. Entre hoje e o vencimento há ${ate} dia(s); informe no máximo ${ate} dia(s) ou altere a data.`;
    }
    return null;
  }

  /** Aviso quando o prazo de antecipação é curto (sem erro de validação). */
  get diasAntecipacaoWarning(): string | null {
    if (!this.descontoAntecipacaoEnabled || this.diasAntecipacaoError) {
      return null;
    }
    const n = Number.parseInt(String(this.descontoDias ?? '').trim(), 10);
    if (Number.isNaN(n) || n < 1) {
      return null;
    }
    if (n <= 2) {
      return 'Prazo de antecipação curto em relação ao vencimento.';
    }
    return null;
  }

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    const pre = this.cobrancaClientePrefill.consumePendingClient();
    if (pre) {
      this.selectedClient = pre;
    }
  }

  goBack(): void {
    void this.navController.back();
  }

  /** Somente dígitos para campos de inteiro (Juros/Desconto em %). */
  sanitizePositiveIntDigits(raw: string | null | undefined): string {
    return String(raw ?? '').replace(/\D/g, '');
  }

  toggleJurosMulta(): void {
    this.jurosMultaEnabled = !this.jurosMultaEnabled;
  }

  toggleDesconto(): void {
    this.descontoAntecipacaoEnabled = !this.descontoAntecipacaoEnabled;
  }

  openVencimentoModal(): void {
    this.vencimentoModalOpen = true;
  }

  closeVencimentoModal(): void {
    this.vencimentoModalOpen = false;
  }

  private static isoDateDaysFromToday(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return NovaCobrancaPage.isoDateFromLocalDate(d);
  }

  private static isoDateFromLocalToday(): string {
    return NovaCobrancaPage.isoDateFromLocalDate(new Date());
  }

  private static isoDateFromLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private static parseLocalDateFromIso(iso: string): Date {
    const part = iso.split('T')[0] ?? '';
    const [y, m, d] = part.split('-').map((x) => Number.parseInt(x, 10));
    if (!y || !m || !d) {
      return new Date();
    }
    return new Date(y, m - 1, d);
  }

  private static calendarDaysFromTodayTo(due: Date): number {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const end = new Date(due);
    end.setHours(0, 0, 0, 0);
    return Math.round((end.getTime() - t.getTime()) / 86400000);
  }

  private static formatIsoDateBr(iso: string): string {
    const part = iso.split('T')[0] ?? '';
    const [y, m, d] = part.split('-');
    if (!y || !m || !d) {
      return '';
    }
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  private static readonly AVATAR_COLORS = [
    '#588cc0',
    '#235697',
    '#5ccaa9',
    '#6b5b95',
    '#c77953',
    '#4a6fa5',
    '#3d7a5f',
  ];

  private static fullName(c: CentralClient): string {
    return `${(c.name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim() || '—';
  }

  private static initialsFromClient(c: CentralClient): string {
    const n = (c.name ?? '').trim();
    const ln = (c.last_name ?? '').trim();
    const first = n.split(/\s+/)[0]?.charAt(0) ?? '';
    const second = ln.split(/\s+/)[0]?.charAt(0) ?? n.split(/\s+/)[1]?.charAt(0) ?? '';
    const s = (first + second).toUpperCase();
    return s || '?';
  }

  private static avatarColorForKey(key: string): string {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    return NovaCobrancaPage.AVATAR_COLORS[h % NovaCobrancaPage.AVATAR_COLORS.length];
  }

  private static normText(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  private static digitsOnly(s: string): string {
    return s.replace(/\D/g, '');
  }

  private static clientMatchScore(c: CentralClient, qRaw: string): number {
    const t = qRaw.trim();
    if (!t) {
      return 0;
    }
    const q = NovaCobrancaPage.normText(t);
    const qDigits = NovaCobrancaPage.digitsOnly(t);
    let score = 0;
    const name = NovaCobrancaPage.normText(c.name ?? '');
    const last = NovaCobrancaPage.normText(c.last_name ?? '');
    const email = NovaCobrancaPage.normText(c.email ?? '');
    const wa = NovaCobrancaPage.normText(c.whatsapp ?? '');
    const docDigits = NovaCobrancaPage.digitsOnly(c.document ?? '');
    const full = NovaCobrancaPage.normText(NovaCobrancaPage.fullName(c));

    if (q) {
      if (full.startsWith(q)) {
        score += 80;
      } else if (full.includes(q)) {
        score += 40;
      }
      if (name.startsWith(q)) {
        score += 50;
      } else if (name.includes(q)) {
        score += 25;
      }
      if (last.startsWith(q)) {
        score += 45;
      } else if (last.includes(q)) {
        score += 22;
      }
      if (email && email.includes(q)) {
        score += 35;
      }
      if (wa && wa.includes(q)) {
        score += 35;
      }
    }
    if (qDigits.length >= 1 && docDigits) {
      if (docDigits === qDigits) {
        score += 100;
      } else if (docDigits.includes(qDigits)) {
        score += 55;
      }
    }
    return score;
  }

  private static filterAndSortClients(list: CentralClient[], query: string): CentralClient[] {
    const q = query.trim();
    if (!q) {
      return [...list].sort((a, b) =>
        NovaCobrancaPage.fullName(a).localeCompare(NovaCobrancaPage.fullName(b), 'pt-BR'),
      );
    }
    const scored = list
      .map((c) => ({ c, s: NovaCobrancaPage.clientMatchScore(c, q) }))
      .filter((x) => x.s > 0)
      .sort(
        (a, b) =>
          b.s - a.s ||
          NovaCobrancaPage.fullName(a.c).localeCompare(NovaCobrancaPage.fullName(b.c), 'pt-BR'),
      );
    return scored.map((x) => x.c);
  }

  fullNameClient(c: CentralClient): string {
    return NovaCobrancaPage.fullName(c);
  }

  initialsForList(c: CentralClient): string {
    return NovaCobrancaPage.initialsFromClient(c);
  }

  avatarForList(c: CentralClient): string {
    return NovaCobrancaPage.avatarColorForKey(c.cus_id?.trim() || String(c.id));
  }

  clientSecondaryLine(c: CentralClient): string {
    const parts = [c.document, c.email, c.whatsapp].filter((x) => (x ?? '').trim().length > 0);
    return parts.join(' · ') || '—';
  }

  async onSelecionarCliente(): Promise<void> {
    this.clientSearchQuery = '';
    this.clientSheetOpen = true;
    await this.loadClientsForSheet();
  }

  closeClientSheet(): void {
    this.clientSheetOpen = false;
  }

  private async loadClientsForSheet(): Promise<void> {
    const access = this.authSession.getAccessToken()?.trim();
    const wallet = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!access || !wallet) {
      const toast = await this.toastController.create({
        message: !access
          ? 'Sessão expirada. Faça login novamente.'
          : 'Carteira não encontrada. Verifique sua conta.',
        duration: 2800,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      this.clientSheetOpen = false;
      return;
    }
    this.clientsLoading = true;
    const data = await this.clientsListService.fetchList(access, wallet);
    this.clientsLoading = false;
    if (!data?.success || !Array.isArray(data.clients)) {
      this.clientsList = [];
      const toast = await this.toastController.create({
        message: data?.message?.trim() || 'Não foi possível carregar os clientes.',
        duration: 3000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    this.clientsList = data.clients;
  }

  selectClient(c: CentralClient): void {
    this.selectedClient = c;
    this.clientSheetOpen = false;
    this.clientSearchQuery = '';
  }

  private static mapBillingMode(t: 'PIX_QRCODE' | 'BARCODE' | 'HIBRIDO'): string {
    switch (t) {
      case 'PIX_QRCODE':
        return 'PIX';
      case 'BARCODE':
        return 'BOLETO';
      case 'HIBRIDO':
        return 'BOTH';
      default:
        return 'PIX';
    }
  }

  /**
   * Monta o corpo de `POST /api/central/v1/charges/create` conforme o formulário.
   * `source_token` = API key da subconta (`asaas_api_token` da carteira).
   */
  private buildChargesCreateBody(): ChargesCreateBody | null {
    const sourceToken = this.authSession.getDefaultWallet()?.asaas_api_token?.trim();
    const cusId = this.selectedClientCusId;
    if (!sourceToken || !cusId) {
      return null;
    }

    const dueRaw = (this.vencimentoIso.split('T')[0] ?? this.vencimentoIso).trim();

    const body: ChargesCreateBody = {
      source_token: sourceToken,
      asaas_customer_id: cusId,
      value: this.valorCobranca.trim(),
      due_date: dueRaw,
      billing_mode: NovaCobrancaPage.mapBillingMode(this.tipoCobranca),
    };

    const desc = this.descricao.trim();
    if (desc) {
      body.description = desc;
    }

    if (this.descontoAntecipacaoEnabled) {
      const dVal =
        this.descontoTipo === '%'
          ? Number.parseInt(String(this.descontoValorInt).trim(), 10)
          : brlStringToCents(this.descontoValorFixo) / 100;
      const dDays = Number.parseInt(String(this.descontoDias).trim(), 10);
      if (!Number.isFinite(dVal) || !Number.isFinite(dDays)) {
        return null;
      }
      body.discount = {
        value: dVal,
        days_before_due: dDays,
        type: this.descontoTipo === '%' ? 'PERCENTAGE' : 'FIXED',
      };
    }

    if (this.jurosMultaEnabled) {
      const interestValue =
        this.jurosTipo === '%'
          ? Number.parseFloat(String(this.jurosValorInt).trim()) || 0
          : brlStringToCents(this.jurosValorFixo) / 100;
      const fineVal = Number.parseInt(String(this.multaValor).trim(), 10) || 0;
      body.interest = { value: interestValue };
      body.fine = { value: fineVal, type: 'PERCENTAGE' };
    }

    return body;
  }

  async onGerarCobranca(): Promise<void> {
    if (this.gerarCobrancaBusy) {
      return;
    }
    const cents = brlStringToCents(this.valorCobranca);
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
    if (cents <= MIN_VALOR_COBRANCA_CENTS) {
      const alert = await this.alertController.create({
        message: 'Para gerar uma cobrança o valor precisa ser superior a R$5,00',
        buttons: [{ text: 'OK', role: 'confirm' }],
      });
      await alert.present();
      return;
    }
    if (!this.selectedClient) {
      const toast = await this.toastController.create({
        message: 'Selecione um cliente.',
        duration: 2400,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    const cusId = this.selectedClientCusId;
    if (!cusId) {
      const toast = await this.toastController.create({
        message: 'Este cliente não possui cus_id cadastrado. Escolha outro cliente ou atualize o cadastro.',
        duration: 3600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    if (this.vencimentoFeedback) {
      const toast = await this.toastController.create({
        message: this.vencimentoFeedback,
        duration: 2800,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }
    const diasErr = this.diasAntecipacaoError;
    if (diasErr) {
      const toast = await this.toastController.create({
        message: diasErr,
        duration: 4200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const access = this.authSession.getAccessToken()?.trim();
    if (!access) {
      const toast = await this.toastController.create({
        message: 'Sessão expirada. Faça login novamente.',
        duration: 2600,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const body = this.buildChargesCreateBody();
    if (!body) {
      const toast = await this.toastController.create({
        message:
          'Token da carteira (API) indisponível ou dados incompletos. Verifique a conta e tente novamente.',
        duration: 3200,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.gerarCobrancaBusy = true;
    try {
      const result = await this.chargesCreateService.create(access, body);
      if (!result) {
        const toast = await this.toastController.create({
          message: 'Não foi possível criar a cobrança. Verifique sua conexão.',
          duration: 3000,
          position: 'bottom',
          color: 'danger',
        });
        await toast.present();
        return;
      }
      if (result.success !== true) {
        const toast = await this.toastController.create({
          message: String(result.message ?? '').trim() || 'Não foi possível criar a cobrança.',
          duration: 3600,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }
      const boletoId = extractBoletoIdFromCreateResponse(result);
      if (boletoId != null) {
        void this.navController.navigateForward(['/cobranca', boletoId]);
        return;
      }
      const toast = await this.toastController.create({
        message: 'Cobrança criada com sucesso.',
        duration: 2200,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
      void this.navController.navigateForward('/cobrancas');
    } finally {
      this.gerarCobrancaBusy = false;
    }
  }
}
