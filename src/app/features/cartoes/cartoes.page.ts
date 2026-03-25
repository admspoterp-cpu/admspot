import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';

import { CARTOES_MOCK, type CartaoDados } from './cartoes-data';

export type { CartaoDados };

const G =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

export interface TransacaoGrupo {
  label: string;
  items: TransacaoItem[];
}

export interface TransacaoItem {
  title: string;
  time: string;
  amountLabel: string;
  positive: boolean;
  tag: string;
  iconType: 'frame' | 'initials';
  initials?: string;
  initialsBg?: string;
  iconSrc?: string;
  /** YYYY-MM-DD para filtro por período */
  dateIso: string;
  kind: 'recarga' | 'transacao';
  currency: 'BRL' | 'USD';
}

export type CartoesFilterTipo = 'todos' | 'recarga' | 'transacao';
export type CartoesFilterMoeda = 'todos' | 'BRL' | 'USD';

export interface CartoesTxFilter {
  dateStart: string;
  dateEnd: string;
  tipo: CartoesFilterTipo;
  moeda: CartoesFilterMoeda;
}

@Component({
  selector: 'app-cartoes',
  templateUrl: './cartoes.page.html',
  styleUrls: ['./cartoes.page.scss'],
  standalone: false,
})
export class CartoesPage implements AfterViewInit {
  @ViewChild('swiperEl') swiperRef?: ElementRef<HTMLElement & { swiper?: { update: () => void } }>;
  @ViewChild('txSearchInput') txSearchInput?: ElementRef<HTMLInputElement>;

  filterSheetOpen = false;

  /** Campo de busca inline na lista de transações */
  txSearchOpen = false;
  txSearchQuery = '';

  readonly emptyTxFilter: CartoesTxFilter = {
    dateStart: '',
    dateEnd: '',
    tipo: 'todos',
    moeda: 'todos',
  };

  appliedTxFilter: CartoesTxFilter = { ...this.emptyTxFilter };
  draftTxFilter: CartoesTxFilter = { ...this.emptyTxFilter };

  private readonly todayIso = CartoesPage.formatDateIsoLocal(new Date());

  readonly cards = CARTOES_MOCK;

  readonly txGroups: TransacaoGrupo[] = [
    {
      label: 'HOJE',
      items: [
        {
          title: 'Dinheiro adicionado',
          time: '3:40 PM',
          amountLabel: 'BRL 5.000,00',
          positive: true,
          tag: 'carga',
          iconType: 'frame',
          iconSrc: `${G}/Frame427319675-562b5251-1e2d-44c4-b078-3f957f441fbf.svg`,
          dateIso: this.todayIso,
          kind: 'recarga',
          currency: 'BRL',
        },
        {
          title: 'Loja Sports',
          time: '9:33 AM',
          amountLabel: 'BRL 2.000,00',
          positive: false,
          tag: 'transação',
          iconType: 'initials',
          initials: 'LS',
          initialsBg: '#00597d',
          dateIso: this.todayIso,
          kind: 'transacao',
          currency: 'BRL',
        },
      ],
    },
    {
      label: 'TERÇA-FEIRA, 23 DE MAIO DE 2023',
      items: [
        {
          title: 'Adeola Balogun',
          time: '7:50 PM',
          amountLabel: 'US 600,00',
          positive: false,
          tag: 'transação',
          iconType: 'initials',
          initials: 'AB',
          initialsBg: '#e21001',
          dateIso: '2023-05-23',
          kind: 'transacao',
          currency: 'USD',
        },
        {
          title: 'Ifeoma Okonkwo',
          time: '6:00 PM',
          amountLabel: 'BRL 2.000,00',
          positive: false,
          tag: 'transação',
          iconType: 'initials',
          initials: 'IO',
          initialsBg: '#162d4c',
          dateIso: '2023-05-23',
          kind: 'transacao',
          currency: 'BRL',
        },
      ],
    },
    {
      label: 'SEGUNDA-FEIRA, 22 DE MAIO DE 2023',
      items: [
        {
          title: 'Pagamento online',
          time: '2:15 PM',
          amountLabel: 'BRL 150,00',
          positive: false,
          tag: 'transação',
          iconType: 'initials',
          initials: 'PO',
          initialsBg: '#114280',
          dateIso: '2023-05-22',
          kind: 'transacao',
          currency: 'BRL',
        },
      ],
    },
  ];

  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngAfterViewInit(): void {
    window.setTimeout(() => this.swiperRef?.nativeElement?.swiper?.update?.(), 0);
  }

  goBack(): void {
    this.navController.back();
  }

  async copyPan(card: CartaoDados): Promise<void> {
    try {
      await navigator.clipboard.writeText(card.panCopy);
      await this.presentToast('Número do cartão copiado');
    } catch {
      await this.presentToast('Não foi possível copiar o número', 'warning');
    }
  }

  async copyCvv(card: CartaoDados): Promise<void> {
    try {
      await navigator.clipboard.writeText(card.cvv);
      await this.presentToast('CVV copiado');
    } catch {
      await this.presentToast('Não foi possível copiar o CVV', 'warning');
    }
  }

  async actionSoon(label: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `${label} em breve`,
      duration: 1600,
      position: 'bottom',
    });
    await toast.present();
  }

  openCardInfo(): void {
    const el = this.swiperRef?.nativeElement;
    const swiper = el && 'swiper' in el ? (el as HTMLElement & { swiper?: { activeIndex?: number } }).swiper : undefined;
    const idx = typeof swiper?.activeIndex === 'number' ? swiper.activeIndex : 1;
    void this.router.navigate(['info', String(idx)], { relativeTo: this.route });
  }

  openNovoCartao(): void {
    void this.router.navigate(['novo'], { relativeTo: this.route });
  }

  openTxSearch(): void {
    this.txSearchOpen = true;
    window.setTimeout(() => this.txSearchInput?.nativeElement?.focus(), 0);
  }

  closeTxSearch(): void {
    this.txSearchOpen = false;
    this.txSearchQuery = '';
  }

  get filteredTxGroups(): TransacaoGrupo[] {
    const base = this.filterTransactionGroups(this.txGroups, this.appliedTxFilter);
    const q = this.txSearchQuery.trim().toLowerCase();
    if (!this.txSearchOpen || !q) {
      return base;
    }
    return this.filterGroupsByTitleQuery(base, q);
  }

  get emptyTxListMessage(): string {
    const q = this.txSearchQuery.trim();
    if (this.txSearchOpen && q) {
      return 'Nenhuma transação encontrada.';
    }
    return 'Nenhuma transação com estes filtros.';
  }

  get hasActiveTxFilters(): boolean {
    const f = this.appliedTxFilter;
    return !!(f.dateStart || f.dateEnd || f.tipo !== 'todos' || f.moeda !== 'todos');
  }

  openFilterSheet(): void {
    this.draftTxFilter = { ...this.appliedTxFilter };
    this.filterSheetOpen = true;
  }

  closeFilterSheet(): void {
    this.filterSheetOpen = false;
  }

  clearDraftFilters(): void {
    this.draftTxFilter = { ...this.emptyTxFilter };
  }

  applyDraftFilters(): void {
    this.appliedTxFilter = { ...this.draftTxFilter };
    this.filterSheetOpen = false;
  }

  setDraftTipo(t: CartoesFilterTipo): void {
    this.draftTxFilter = { ...this.draftTxFilter, tipo: t };
  }

  setDraftMoeda(m: CartoesFilterMoeda): void {
    this.draftTxFilter = { ...this.draftTxFilter, moeda: m };
  }

  private filterTransactionGroups(groups: TransacaoGrupo[], f: CartoesTxFilter): TransacaoGrupo[] {
    return groups
      .map((g) => ({
        label: g.label,
        items: g.items.filter((item) => {
          if (f.tipo !== 'todos' && item.kind !== f.tipo) {
            return false;
          }
          if (f.moeda !== 'todos' && item.currency !== f.moeda) {
            return false;
          }
          if (f.dateStart && item.dateIso < f.dateStart) {
            return false;
          }
          if (f.dateEnd && item.dateIso > f.dateEnd) {
            return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }

  private filterGroupsByTitleQuery(groups: TransacaoGrupo[], q: string): TransacaoGrupo[] {
    return groups
      .map((g) => ({
        label: g.label,
        items: g.items.filter((item) => item.title.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }

  private static formatDateIsoLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async presentToast(message: string, color: 'success' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
