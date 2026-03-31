import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { BillPaymentsListService } from '../../services/bill-payments-list.service';
import { AuthSessionService } from '../../services/auth-session.service';
import {
  mapBillPaymentItemToRow,
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

  readonly tabLabels = ['Todos', 'Recebimentos', 'Aguardando', 'Atrasados'] as const;
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
  private readonly toastController = inject(ToastController);

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
      return list.filter((r) => r.status === 'pago');
    }
    if (i === 2) {
      return list.filter((r) => r.status === 'aguardando');
    }
    if (i === 3) {
      return list.filter((r) => r.status === 'atrasado' || r.status === 'falhou');
    }
    return list;
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

  trackByRowId(_index: number, row: PagamentoContaRow): number {
    return row.id;
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

  private async loadList(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
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
    this.summaryNaoEfetivado = '…';

    const data = await this.billPaymentsList.fetchList(access, walletToken);
    this.loading = false;

    if (!data) {
      this.loadError = 'Não foi possível carregar os pagamentos.';
      this.allRows = [];
      this.setSummaryPlaceholdersError();
      return;
    }

    if (data.success !== true) {
      const msg = typeof data.message === 'string' ? data.message.trim() : '';
      this.loadError = msg.length > 0 ? msg : 'Não foi possível carregar os pagamentos.';
      this.allRows = [];
      this.setSummaryPlaceholdersError();
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    this.allRows = items.map(mapBillPaymentItemToRow);

    const s = data.summary;
    if (s) {
      this.summaryPagos = (s.total_pago_brl ?? '—').trim() || '—';
      this.summaryAgendados = (s.total_agendado_brl ?? '—').trim() || '—';
      this.summaryNaoEfetivado = (s.total_nao_efetivado_brl ?? '—').trim() || '—';
    } else {
      this.summaryPagos = '—';
      this.summaryAgendados = '—';
      this.summaryNaoEfetivado = '—';
    }
  }

  private setSummaryPlaceholdersError(): void {
    this.summaryPagos = 'R$—';
    this.summaryAgendados = 'R$—';
    this.summaryNaoEfetivado = 'R$—';
  }

  goBack(): void {
    void this.navController.back();
  }

  selectTab(index: number): void {
    this.selectedTabIndex = index;
  }

  async openRow(row: PagamentoContaRow): Promise<void> {
    const digits = row.digitavel.replace(/\D/g, '');
    const canOpen =
      digits.length === 44 || digits.length === 47 || digits.length === 48;
    if (canOpen) {
      await this.router.navigate(['/boleto-payment-details'], {
        state: {
          linhaDigitavel: digits,
          source: 'manual' as const,
        },
      });
      return;
    }
    const toast = await this.toastController.create({
      message: 'Este pagamento não possui linha digitável para abrir o detalhe.',
      duration: 2600,
      position: 'bottom',
      color: 'medium',
    });
    await toast.present();
  }
}
