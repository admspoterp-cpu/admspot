import { Component, inject } from '@angular/core';
import { NavController, ViewWillEnter } from '@ionic/angular';

import { ChargesBoletosListService } from '../../services/charges-boletos-list.service';
import { AuthSessionService } from '../../services/auth-session.service';
import {
  computeSummaryFromRows,
  mapBoletoItemToRow,
  rowMatchesDueDateRange,
  rowMatchesSearch,
} from './cobrancas-boletos.mapper';
import type { CobrancaRow } from './cobrancas.types';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

@Component({
  selector: 'app-cobrancas',
  templateUrl: './cobrancas.page.html',
  styleUrls: ['./cobrancas.page.scss'],
  standalone: false,
})
export class CobrancasPage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-551d7cb4-ea42-4617-adb3-2d33f5ed3da9.svg`;
  readonly searchSrc = `${G}/MagnifyingGlass-6a2b5499-5003-430d-9e86-b40dff340e5e.svg`;
  readonly funnelSrc = `${G}/FunnelSimple-cb385a2b-a8be-40a8-83e0-c3cde1cd107c.svg`;
  readonly headerGraphicSrc = `${G}/Frame427319480-dd6627fa-295d-417d-930c-142db25a9316.svg`;

  readonly tabLabels = ['Todos', 'Recebimentos', 'Aguardando', 'Atrasados'] as const;
  selectedTabIndex = 0;

  /** Filtro de datas aplicado (vencimento), `YYYY-MM-DD` ou null. */
  appliedDateStart: string | null = null;
  appliedDateEnd: string | null = null;

  filterModalOpen = false;
  draftDateStart = '';
  draftDateEnd = '';

  /** Barra de pesquisa expandida ao tocar na lupa. */
  searchExpanded = false;
  searchQuery = '';

  loading = false;
  loadError: string | null = null;
  private allRows: CobrancaRow[] = [];

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly chargesBoletosList = inject(ChargesBoletosListService);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadBoletos();
  }

  /** Indicador no ícone do funil: só intervalo de vencimento (abas tratam situação). */
  get hasActiveFilters(): boolean {
    return this.appliedDateStart != null || this.appliedDateEnd != null;
  }

  /** Linhas após filtro de intervalo de vencimento. */
  get dateFilteredRows(): CobrancaRow[] {
    const start = this.appliedDateStart;
    const end = this.appliedDateEnd;
    if (!start && !end) {
      return this.allRows;
    }
    return this.allRows.filter((r) => rowMatchesDueDateRange(r, start, end));
  }

  /** Após data: filtra por nome, e-mail, fatura e nosso número. */
  get searchFilteredRows(): CobrancaRow[] {
    const list = this.dateFilteredRows;
    const q = this.searchQuery;
    if (!q?.trim()) {
      return list;
    }
    return list.filter((r) => rowMatchesSearch(r, q));
  }

  /** Lista + aba de situação (Recebimentos = pagos, etc.). */
  get filteredRows(): CobrancaRow[] {
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
      return list.filter((r) => r.status === 'atrasado');
    }
    return list;
  }

  get summaryRecebimento(): string {
    if (this.loading) {
      return '…';
    }
    if (this.loadError) {
      return 'R$—';
    }
    return computeSummaryFromRows(this.filteredRows).recebimento;
  }

  get summaryAguardando(): string {
    if (this.loading) {
      return '…';
    }
    if (this.loadError) {
      return 'R$—';
    }
    return computeSummaryFromRows(this.filteredRows).aguardando;
  }

  get summaryAtrasados(): string {
    if (this.loading) {
      return '…';
    }
    if (this.loadError) {
      return 'R$—';
    }
    return computeSummaryFromRows(this.filteredRows).atrasados;
  }

  /** Contador alinhado à aba ativa (mesma lógica de `filteredRows`). */
  get tabCobrancasCountLabel(): string {
    if (this.loading) {
      return '…';
    }
    if (this.loadError) {
      return '— cobranças';
    }
    const n = this.filteredRows.length;
    return `${n} cobrança${n === 1 ? '' : 's'}`;
  }

  trackByRowId(_index: number, row: CobrancaRow): number {
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

  private async loadBoletos(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!access || !walletToken) {
      this.loadError = 'Carteira não encontrada. Defina uma carteira padrão.';
      this.allRows = [];
      return;
    }

    this.loading = true;
    this.loadError = null;

    const data = await this.chargesBoletosList.fetchList(access, walletToken);
    this.loading = false;

    if (!data) {
      this.loadError = 'Não foi possível carregar as cobranças.';
      this.allRows = [];
      return;
    }

    if (data.success !== true) {
      const msg = typeof data.message === 'string' ? data.message.trim() : '';
      this.loadError = msg.length > 0 ? msg : 'Não foi possível carregar as cobranças.';
      this.allRows = [];
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    this.allRows = items.map(mapBoletoItemToRow);
  }

  goBack(): void {
    void this.navController.back();
  }

  goToNovaCobranca(): void {
    void this.navController.navigateForward('/nova-cobranca');
  }

  openCobrancaDetalhe(row: CobrancaRow): void {
    void this.navController.navigateForward(['/cobranca', row.id]);
  }

  selectTab(index: number): void {
    this.selectedTabIndex = index;
  }
}
