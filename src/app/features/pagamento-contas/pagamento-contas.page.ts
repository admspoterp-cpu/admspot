import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, ViewWillEnter } from '@ionic/angular';

import {
  BillPaymentsListService,
  type BillPaymentListSummary,
} from '../../services/bill-payments-list.service';
import type { ExtratoOperacaoRaw } from '../../services/extrato-geral.service';
import { ExtratoGeralService } from '../../services/extrato-geral.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { mapOperacaoToDashboardRow } from '../../shared/utils/dashboard-extrato.util';
import { formatBrlNumber } from '../../utils/brl-format';
import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';
import {
  isExtratoPagamentoDebit,
  mapBillPaymentItemToRow,
  mapExtratoPagamentoDebitToRow,
  rowMatchesDueDateRange,
  rowMatchesSearch,
} from './pagamento-contas.mapper';
import type { PagamentoContaRow } from './pagamento-contas.types';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

@Component({
  selector: 'app-pagamento-contas',
  templateUrl: './pagamento-contas.page.html',
  styleUrls: ['./pagamento-contas.page.scss'],
  standalone: false,
})
export class PagamentoContasPage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-551d7cb4-ea42-4617-adb3-2d33f5ed3da9.svg`;
  readonly searchSrc = `${G}/MagnifyingGlass-6a2b5499-5003-430d-9e86-b40dff340e5e.svg`;
  readonly funnelSrc = `${G}/FunnelSimple-cb385a2b-a8be-40a8-83e0-c3cde1cd107c.svg`;

  readonly tabLabels = ['Todos', 'Pagos', 'Agendados'] as const;
  selectedTabIndex = 0;

  appliedDateStart: string | null = null;
  appliedDateEnd: string | null = null;

  filterModalOpen = false;
  draftDateStart = '';
  draftDateEnd = '';

  searchExpanded = false;
  searchQuery = '';

  loading = false;
  loadError: string | null = null;
  private allRows: PagamentoContaRow[] = [];

  summaryPagos = '…';
  summaryAgendados = '…';
  summaryNaoEfetivado = '…';

  private readonly navController = inject(NavController);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly billPaymentsList = inject(BillPaymentsListService);
  private readonly extratoGeral = inject(ExtratoGeralService);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadList();
  }

  get hasActiveFilters(): boolean {
    return this.appliedDateStart != null || this.appliedDateEnd != null;
  }

  get dateFilteredRows(): PagamentoContaRow[] {
    const start = this.appliedDateStart;
    const end = this.appliedDateEnd;
    if (!start && !end) {
      return this.allRows;
    }
    return this.allRows.filter((r) => rowMatchesDueDateRange(r, start, end));
  }

  get searchFilteredRows(): PagamentoContaRow[] {
    const list = this.dateFilteredRows;
    const q = this.searchQuery;
    if (!q?.trim()) {
      return list;
    }
    return list.filter((r) => rowMatchesSearch(r, q));
  }

  get filteredRows(): PagamentoContaRow[] {
    const list = this.searchFilteredRows;
    const i = this.selectedTabIndex;
    if (i === 0) {
      return list;
    }
    if (i === 1) {
      return list.filter((r) =>
        r.source === 'bill' ? this.isBillApiPaid(r) : r.status === 'pago',
      );
    }
    if (i === 2) {
      return list.filter((r) =>
        r.source === 'bill' ? this.isBillApiPending(r) : false,
      );
    }
    return list;
  }

  /** Alinha abas ao `status` da API (PAID/PENDING), não ao chip derivado (ex.: vencido ainda é PENDING). */
  private isBillApiPaid(r: PagamentoContaRow): boolean {
    return (r.apiStatus ?? '').trim().toUpperCase() === 'PAID';
  }

  private isBillApiPending(r: PagamentoContaRow): boolean {
    return (r.apiStatus ?? '').trim().toUpperCase() === 'PENDING';
  }

  get tabCountLabel(): string {
    if (this.loading) {
      return '…';
    }
    if (this.loadError) {
      return '— pagamentos';
    }
    const n = this.filteredRows.length;
    return `${n} pagamento${n === 1 ? '' : 's'}`;
  }

  trackByRowKey(_index: number, row: PagamentoContaRow): string {
    return row.rowKey;
  }

  get hasActiveSearch(): boolean {
    return this.searchQuery.trim().length > 0;
  }

  toggleSearchBar(): void {
    this.searchExpanded = !this.searchExpanded;
  }

  openFilterModal(): void {
    this.draftDateStart = this.appliedDateStart ?? '';
    this.draftDateEnd = this.appliedDateEnd ?? '';
    this.filterModalOpen = true;
  }

  closeFilterModal(): void {
    this.filterModalOpen = false;
  }

  onFilterModalDismiss(): void {
    this.filterModalOpen = false;
  }

  applyFilters(): void {
    let d1 = this.draftDateStart?.trim() || null;
    let d2 = this.draftDateEnd?.trim() || null;
    if (d1 && d2 && d1 > d2) {
      const t = d1;
      d1 = d2;
      d2 = t;
    }
    this.appliedDateStart = d1;
    this.appliedDateEnd = d2;
    this.filterModalOpen = false;
  }

  clearFilters(): void {
    this.appliedDateStart = null;
    this.appliedDateEnd = null;
    this.draftDateStart = '';
    this.draftDateEnd = '';
    this.filterModalOpen = false;
  }

  private walletMatchesApi(walletId: number | undefined, apiWalletId: number | undefined): boolean {
    if (apiWalletId == null) {
      return true;
    }
    if (walletId == null) {
      return true;
    }
    return apiWalletId === walletId;
  }

  /** `total_pago` etc. vêm como string numérica (ex.: `"9983.76"`). */
  private parseApiDecimal(raw: string | undefined): number | null {
    if (raw == null) {
      return null;
    }
    const t = String(raw).trim();
    if (t === '') {
      return null;
    }
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Pagos = total pago da API de bill-payments (carteira) + soma dos débitos "Pagamento" do extrato.
   * Agendados = `total_agendado` da API ou soma das linhas bill com `PENDING`.
   */
  private applySummaryHybrid(
    billSummary: BillPaymentListSummary | undefined,
    billRows: PagamentoContaRow[],
    extratoRows: PagamentoContaRow[],
  ): void {
    const pagoApi = this.parseApiDecimal(billSummary?.total_pago);
    const pagoBillFallback = billRows
      .filter((r) => this.isBillApiPaid(r))
      .reduce((s, r) => s + r.valorReais, 0);
    const pagoBill = pagoApi != null ? pagoApi : pagoBillFallback;

    const pagoExtrato = extratoRows.reduce((s, r) => s + r.valorReais, 0);
    const pagoTotal = pagoBill + pagoExtrato;

    const agApi = this.parseApiDecimal(billSummary?.total_agendado);
    const agFallback = billRows
      .filter((r) => this.isBillApiPending(r))
      .reduce((s, r) => s + r.valorReais, 0);
    const agTotal = agApi != null ? agApi : agFallback;

    this.summaryPagos = `R$ ${formatBrlNumber(pagoTotal)}`;
    this.summaryAgendados = `R$ ${formatBrlNumber(agTotal)}`;
  }

  private async loadList(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const walletToken = wallet?.wallet_token_account?.trim();
    const walletId = wallet?.id;

    if (!access || !walletToken) {
      this.loadError = 'Carteira não encontrada. Defina uma carteira padrão.';
      this.allRows = [];
      this.setSummaryPlaceholdersError();
      return;
    }

    this.loading = true;
    this.loadError = null;
    this.summaryPagos = '…';
    this.summaryAgendados = '…';

    const [extratoData, billData] = await Promise.all([
      this.extratoGeral.fetchExtrato(access, walletToken),
      this.billPaymentsList.fetchList(access, walletToken),
    ]);

    this.loading = false;

    const okExtrato =
      extratoData?.success === true &&
      Array.isArray(extratoData.operacoes) &&
      this.walletMatchesApi(walletId, extratoData.wallet_id);
    const okBill =
      billData?.success === true &&
      Array.isArray(billData.items) &&
      this.walletMatchesApi(walletId, billData.wallet_id);

    if (!okExtrato && !okBill) {
      const msg =
        (typeof billData?.message === 'string' ? billData.message.trim() : '') ||
        (typeof extratoData?.message === 'string' ? extratoData.message.trim() : '');
      this.loadError =
        msg.length > 0 ? msg : 'Não foi possível carregar os pagamentos.';
      this.allRows = [];
      this.setSummaryPlaceholdersError();
      return;
    }

    const billItems = okBill && billData?.items ? billData.items : [];
    const filteredBills = billItems.filter((it) => {
      if (it.wallet_id == null || walletId == null) {
        return true;
      }
      return it.wallet_id === walletId;
    });
    const billRows = filteredBills
      .map(mapBillPaymentItemToRow)
      .filter((r) => r.valorReais > 0);

    const operacoes =
      okExtrato && extratoData?.operacoes ? extratoData.operacoes : [];
    const extratoRows: PagamentoContaRow[] = [];
    operacoes.forEach((op, i) => {
      if (!isExtratoPagamentoDebit(op)) {
        return;
      }
      const r = mapExtratoPagamentoDebitToRow(op, i);
      if (r) {
        extratoRows.push(r);
      }
    });
    const extratoRowsPositive = extratoRows.filter((r) => r.valorReais > 0);

    this.allRows = [...billRows, ...extratoRowsPositive].sort((a, b) => b.sortDateMs - a.sortDateMs);
    this.applySummaryHybrid(
      okBill ? billData?.summary : undefined,
      billRows,
      extratoRowsPositive,
    );
    this.loadError = null;
  }

  private setSummaryPlaceholdersError(): void {
    this.summaryPagos = 'R$—';
    this.summaryAgendados = 'R$—';
  }

  goBack(): void {
    void this.navController.back();
  }

  selectTab(index: number): void {
    this.selectedTabIndex = index;
  }

  async openRow(row: PagamentoContaRow): Promise<void> {
    if (row.source === 'bill') {
      await this.openComprovanteBill(row);
      return;
    }
    if (row.extratoOp) {
      await this.openComprovanteExtrato(row.extratoOp);
    }
  }

  private async openComprovanteBill(row: PagamentoContaRow): Promise<void> {
    const amountPlain = row.amount.replace(/^R\$\s*/i, '').trim();
    const state: ComprovantePaymentNavState = {
      transferKind: 'boleto',
      amountDisplay: amountPlain,
      beneficiaryName: row.name,
      beneficiaryBank: row.beneficiaryBank,
      documentMasked: '—',
      boletoBillPaymentId: String(row.id),
      boletoStatus: row.apiStatus ?? '',
      boletoScheduleDate: row.scheduleDateRaw ?? undefined,
      boletoLinhaDigitavelDigits: row.digitavel.replace(/\D/g, ''),
      boletoLinhaResumo: row.digitavel,
    };
    await this.router.navigate(['/comprovante-payment'], { state });
  }

  private async openComprovanteExtrato(op: ExtratoOperacaoRaw): Promise<void> {
    const dashRow = mapOperacaoToDashboardRow(op);
    if (!dashRow) {
      return;
    }

    if (dashRow.extratoBoleto) {
      const p = dashRow.extratoBoleto;
      const linhaDigits = p.digitavel.replace(/\D/g, '');
      const state: ComprovantePaymentNavState = {
        transferKind: 'boleto',
        boletoExtratoSource: true,
        amountDisplay: dashRow.amountDisplay,
        beneficiaryName: dashRow.displayName,
        beneficiaryBank: dashRow.beneficiaryBank,
        documentMasked: dashRow.documentMasked ?? '—',
        boletoLinhaDigitavelDigits: linhaDigits,
        boletoLinhaResumo: p.digitavel,
        boletoExtratoStatus: p.status,
        boletoExtratoPaymentDateBr: p.payment_date_br,
        boletoExtratoPaymentDate: p.paymentDate,
        boletoExtratoBoletoId: p.boleto_id,
        boletoExtratoBillId: p.bill_id,
      };
      await this.router.navigate(['/comprovante-payment'], { state });
      return;
    }

    const pixTid =
      String(op.tipo_registro ?? '').trim() === 'app_real_transfer' &&
      String(op.trasnfer_operationType ?? '').toUpperCase().trim() === 'PIX'
        ? String(op.trasnfer_id ?? '').trim()
        : '';
    if (pixTid) {
      const state: ComprovantePaymentNavState = {
        transferKind: 'pix',
        pixTransferId: pixTid,
        amountDisplay: dashRow.amountDisplay,
        beneficiaryName: dashRow.displayName,
        beneficiaryBank: dashRow.beneficiaryBank,
        documentMasked: dashRow.documentMasked ?? '—',
      };
      await this.router.navigate(['/comprovante-payment'], { state });
      return;
    }

    const linhaDigits = String(op.digitavel ?? '').replace(/\D/g, '');
    const rec = op as Record<string, unknown>;
    const billRaw = rec['bill_id'];
    const billId =
      billRaw !== undefined && billRaw !== null && String(billRaw).trim() !== ''
        ? String(billRaw).trim()
        : null;

    const state: ComprovantePaymentNavState = {
      transferKind: 'boleto',
      boletoExtratoSource: true,
      amountDisplay: dashRow.amountDisplay,
      beneficiaryName: dashRow.displayName,
      beneficiaryBank: dashRow.beneficiaryBank,
      documentMasked: '—',
      boletoLinhaDigitavelDigits: linhaDigits,
      boletoLinhaResumo: String(op.digitavel ?? ''),
      boletoExtratoStatus: String(
        (op.status_label as string | undefined) ?? (op.status as string | undefined) ?? '',
      ),
      boletoExtratoPaymentDateBr: String(
        (op.payment_date_br as string | undefined) ?? (op.data_hora_br as string | undefined) ?? '',
      ),
      boletoExtratoPaymentDate: String((op.paymentDate as string | undefined) ?? ''),
      boletoExtratoBoletoId: String(op.boleto_id ?? ''),
      boletoExtratoBillId: billId,
    };
    await this.router.navigate(['/comprovante-payment'], { state });
  }
}
