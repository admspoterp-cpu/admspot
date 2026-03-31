import { Component, inject } from '@angular/core';
import { NavController, ViewWillEnter } from '@ionic/angular';

import { ClientsListService, type CentralClient } from '../../services/clients-list.service';
import { AuthSessionService } from '../../services/auth-session.service';
import {
  mapCentralClientToRow,
  rowMatchesClienteSearch,
  rowMatchesCreatedDateRange,
} from './clientes.mapper';
import type { ClienteRow } from './clientes.types';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.page.html',
  styleUrls: ['./clientes.page.scss'],
  standalone: false,
})
export class ClientesPage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-551d7cb4-ea42-4617-adb3-2d33f5ed3da9.svg`;
  /** Indica que o toque abre a tela do cliente (mesmo asset das outras listas). */
  readonly caretRightSrc = `${G}/CaretRight-052a6ba7-3269-4e9c-a1bf-4ceaae80695a.svg`;
  readonly funnelSrc = `${G}/FunnelSimple-cb385a2b-a8be-40a8-83e0-c3cde1cd107c.svg`;

  readonly tabLabels = ['Pessoa física', 'Pessoa jurídica'] as const;
  selectedTabIndex = 0;

  searchQuery = '';

  appliedDateStart: string | null = null;
  appliedDateEnd: string | null = null;
  /** UF ou vazio = todos. */
  appliedStateFilter = '';

  filterModalOpen = false;
  draftDateStart = '';
  draftDateEnd = '';
  draftStateFilter = '';

  readonly brazilStateUfs = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ] as const;

  loading = false;
  loadError: string | null = null;
  private allRows: ClienteRow[] = [];
  /** Mapa id → cliente (API) para abrir detalhe com estado. */
  private readonly clientsById = new Map<number, CentralClient>();

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly clientsList = inject(ClientsListService);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadClients();
  }

  get hasActiveFilters(): boolean {
    return (
      this.appliedDateStart != null ||
      this.appliedDateEnd != null ||
      this.appliedStateFilter.trim().length > 0
    );
  }

  get hasActiveSearch(): boolean {
    return this.searchQuery.trim().length > 0;
  }

  get dateFilteredRows(): ClienteRow[] {
    return this.allRows.filter((r) =>
      rowMatchesCreatedDateRange(r.createdAtMs, this.appliedDateStart, this.appliedDateEnd),
    );
  }

  get stateFilteredRows(): ClienteRow[] {
    const uf = this.appliedStateFilter.trim().toUpperCase();
    if (!uf) {
      return this.dateFilteredRows;
    }
    return this.dateFilteredRows.filter((r) => r.stateNorm === uf);
  }

  get searchFilteredRows(): ClienteRow[] {
    return this.stateFilteredRows.filter((r) => rowMatchesClienteSearch(r, this.searchQuery));
  }

  get filteredRows(): ClienteRow[] {
    const list = this.searchFilteredRows;
    if (this.selectedTabIndex === 0) {
      return list.filter((r) => r.isPessoaFisica);
    }
    return list.filter((r) => !r.isPessoaFisica);
  }

  get clientesCountLabel(): string {
    if (this.loading) {
      return '…';
    }
    if (this.loadError) {
      return '— clientes';
    }
    const n = this.filteredRows.length;
    return `${n} cliente${n === 1 ? '' : 's'}`;
  }

  trackByRowId(_index: number, row: ClienteRow): number {
    return row.id;
  }

  openFilterModal(): void {
    this.draftDateStart = this.appliedDateStart ?? '';
    this.draftDateEnd = this.appliedDateEnd ?? '';
    this.draftStateFilter = this.appliedStateFilter;
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
    this.appliedStateFilter = this.draftStateFilter?.trim() ?? '';
    this.filterModalOpen = false;
  }

  clearFilters(): void {
    this.appliedDateStart = null;
    this.appliedDateEnd = null;
    this.appliedStateFilter = '';
    this.draftDateStart = '';
    this.draftDateEnd = '';
    this.draftStateFilter = '';
    this.filterModalOpen = false;
  }

  private async loadClients(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!access || !walletToken) {
      this.loadError = 'Carteira não encontrada. Defina uma carteira padrão.';
      this.allRows = [];
      this.clientsById.clear();
      return;
    }

    this.loading = true;
    this.loadError = null;

    const data = await this.clientsList.fetchList(access, walletToken);
    this.loading = false;

    if (!data) {
      this.loadError = 'Não foi possível carregar os clientes.';
      this.allRows = [];
      this.clientsById.clear();
      return;
    }

    if (data.success !== true) {
      const msg = typeof data.message === 'string' ? data.message.trim() : '';
      this.loadError = msg.length > 0 ? msg : 'Não foi possível carregar os clientes.';
      this.allRows = [];
      this.clientsById.clear();
      return;
    }

    const items = Array.isArray(data.clients) ? data.clients : [];
    this.clientsById.clear();
    for (const c of items) {
      this.clientsById.set(c.id, c);
    }
    this.allRows = items.map(mapCentralClientToRow);
  }

  goBack(): void {
    void this.navController.back();
  }

  goToNovoCliente(): void {
    void this.navController.navigateForward('/novo-cliente');
  }

  openCliente(row: ClienteRow): void {
    const c = this.clientsById.get(row.id);
    if (!c) {
      void this.navController.navigateForward(['/cliente', row.id]);
      return;
    }
    void this.navController.navigateForward(['/cliente', row.id], { state: { client: c } });
  }

  onClienteRowKeydown(ev: KeyboardEvent, row: ClienteRow): void {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.openCliente(row);
    }
  }

  selectTab(index: number): void {
    this.selectedTabIndex = index;
  }
}
