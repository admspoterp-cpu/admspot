import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { NavController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';
import { ExtratoGeralService } from '../../services/extrato-geral.service';
import {
  buildExtratoGroupsAllDays,
  type DashboardExtratoRow,
  type ExtratoDayGroup,
} from '../../shared/utils/dashboard-extrato.util';
import type { ComprovantePaymentNavState } from '../comprovante-payment/comprovante-payment.page';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

export type ExtratoListaFluxo = 'todos' | 'credito' | 'debito';

export interface ExtratoListaFilter {
  dateStart: string;
  dateEnd: string;
  fluxo: ExtratoListaFluxo;
  nameContains: string;
  documentContains: string;
}

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: false,
})
export class TransactionsPage implements ViewWillEnter {
  @ViewChild('txSearchInput') txSearchInput?: ElementRef<HTMLInputElement>;

  filterSheetOpen = false;
  txSearchOpen = false;
  txSearchQuery = '';

  extratoLoading = false;
  dayGroups: ExtratoDayGroup[] = [];

  readonly emptyFilter: ExtratoListaFilter = {
    dateStart: '',
    dateEnd: '',
    fluxo: 'todos',
    nameContains: '',
    documentContains: '',
  };

  appliedFilter: ExtratoListaFilter = { ...this.emptyFilter };
  draftFilter: ExtratoListaFilter = { ...this.emptyFilter };

  readonly frameIconSrc = `${G}/Frame427319675-562b5251-1e2d-44c4-b078-3f957f441fbf.svg`;

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly extratoGeralService = inject(ExtratoGeralService);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadExtrato();
  }

  private async loadExtrato(): Promise<void> {
    const access = this.authSession.getAccessToken();
    const wallet = this.authSession.getDefaultWallet();
    const walletToken = wallet?.wallet_token_account?.trim();
    if (!access || !walletToken) {
      this.dayGroups = [];
      return;
    }

    this.extratoLoading = true;
    const data = await this.extratoGeralService.fetchExtrato(access, walletToken);
    this.extratoLoading = false;

    if (!data || data.success !== true || !Array.isArray(data.operacoes)) {
      this.dayGroups = [];
      return;
    }

    this.dayGroups = buildExtratoGroupsAllDays(data.operacoes);
  }

  goBack(): void {
    void this.navController.back();
  }

  openTxSearch(): void {
    this.txSearchOpen = true;
    window.setTimeout(() => this.txSearchInput?.nativeElement?.focus(), 0);
  }

  closeTxSearch(): void {
    this.txSearchOpen = false;
    this.txSearchQuery = '';
  }

  get filteredGroups(): ExtratoDayGroup[] {
    const base = this.filterDayGroups(this.dayGroups, this.appliedFilter);
    const q = this.txSearchQuery.trim().toLowerCase();
    if (!this.txSearchOpen || !q) {
      return base;
    }
    return this.filterGroupsBySearchQuery(base, q);
  }

  get emptyListMessage(): string {
    const q = this.txSearchQuery.trim();
    if (this.txSearchOpen && q) {
      return 'Nenhuma transação encontrada.';
    }
    if (this.extratoLoading) {
      return '';
    }
    if (this.dayGroups.length === 0) {
      return 'Nenhuma movimentação encontrada.';
    }
    return 'Nenhuma transação com estes filtros.';
  }

  openFilterSheet(): void {
    this.draftFilter = { ...this.appliedFilter };
    this.filterSheetOpen = true;
  }

  closeFilterSheet(): void {
    this.filterSheetOpen = false;
  }

  clearDraftFilters(): void {
    this.draftFilter = { ...this.emptyFilter };
  }

  applyDraftFilters(): void {
    this.appliedFilter = { ...this.draftFilter };
    this.filterSheetOpen = false;
  }

  setDraftFluxo(f: ExtratoListaFluxo): void {
    this.draftFilter = { ...this.draftFilter, fluxo: f };
  }

  async onRowTap(row: DashboardExtratoRow): Promise<void> {
    const id = row.pixTransferId?.trim();
    if (!id) {
      return;
    }

    const state: ComprovantePaymentNavState = {
      transferKind: 'pix',
      pixTransferId: id,
      amountDisplay: row.amountDisplay,
      beneficiaryName: row.displayName,
      beneficiaryBank: row.beneficiaryBank,
      documentMasked: row.documentMasked ?? '—',
    };

    await this.navController.navigateForward('/comprovante-payment', { state });
  }

  rowUsesFrameIcon(row: DashboardExtratoRow): boolean {
    return row.isCredit && !row.pixTransferId;
  }

  private filterDayGroups(groups: ExtratoDayGroup[], f: ExtratoListaFilter): ExtratoDayGroup[] {
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter((row) => this.rowMatchesFilter(row, f)),
      }))
      .filter((g) => g.rows.length > 0);
  }

  private rowMatchesFilter(row: DashboardExtratoRow, f: ExtratoListaFilter): boolean {
    if (f.dateStart && row.dateIso < f.dateStart) {
      return false;
    }
    if (f.dateEnd && row.dateIso > f.dateEnd) {
      return false;
    }
    if (f.fluxo === 'credito' && !row.isCredit) {
      return false;
    }
    if (f.fluxo === 'debito' && row.isCredit) {
      return false;
    }
    const n = f.nameContains.trim().toLowerCase();
    if (n.length > 0 && !row.displayName.toLowerCase().includes(n)) {
      return false;
    }
    const fd = TransactionsPage.digitsOnly(f.documentContains);
    if (fd.length > 0) {
      const rd = row.documentDigits ?? '';
      if (!rd.includes(fd)) {
        return false;
      }
    }
    return true;
  }

  private filterGroupsBySearchQuery(groups: ExtratoDayGroup[], q: string): ExtratoDayGroup[] {
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter(
          (row) =>
            row.displayName.toLowerCase().includes(q) ||
            row.kindTag.toLowerCase().includes(q) ||
            (row.documentDigits && row.documentDigits.includes(TransactionsPage.digitsOnly(q))),
        ),
      }))
      .filter((g) => g.rows.length > 0);
  }

  private static digitsOnly(s: string): string {
    return String(s ?? '').replace(/\D/g, '');
  }
}
