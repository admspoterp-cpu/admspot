import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

const G =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

export interface CartaoDados {
  bgRect: string;
  mapPng?: string;
  ellipseDecor?: string;
  ellipse655?: string;
  unionDecor?: string;
  mcGroup?: string;
  holderLabel: string;
  panDisplay: string;
  panCopy: string;
  expiry: string;
  cvv: string;
  balanceFormatted: string;
  variant: 'minimal' | 'full' | 'mapOnly';
}

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
}

@Component({
  selector: 'app-cartoes',
  templateUrl: './cartoes.page.html',
  styleUrls: ['./cartoes.page.scss'],
  standalone: false,
})
export class CartoesPage implements AfterViewInit {
  @ViewChild('swiperEl') swiperRef?: ElementRef<HTMLElement & { swiper?: { update: () => void } }>;

  readonly cards: CartaoDados[] = [
    {
      bgRect: `${G}/Rectangle2-d0f8b206-38a3-492b-ac6b-4965ddb0223a.svg`,
      mapPng: `${G}%2Fe3515cb9-6cc5-45ea-9365-69859091bdeb.png`,
      ellipseDecor: `${G}/Ellipse1-a461728e-3661-4d82-afb4-06effb68acca.svg`,
      holderLabel: '',
      panDisplay: '•••• •••• •••• 1029',
      panCopy: '3782822463101029',
      expiry: '08/28',
      cvv: '214',
      balanceFormatted: 'R$ 12.400,00',
      variant: 'minimal',
    },
    {
      bgRect: `${G}/Rectangle2-19335240-2f56-4f9c-b3d3-8d695efab1a7.svg`,
      ellipseDecor: `${G}/Ellipse1-ac5c7033-3e1b-4f4f-8677-c7bfb981b36d.svg`,
      ellipse655: `${G}/Ellipse655-cafa124e-7ec9-4a06-bccc-6036461952be.svg`,
      unionDecor: `${G}/Union-0a2ddc5c-4f05-4559-8af8-9b0b9fe9edf2.svg`,
      mcGroup: `${G}/Group2-ea92af74-768f-48f6-a6e6-39526f5fb27c.svg`,
      holderLabel: 'ADMSPOT FINANCE',
      panDisplay: '4562 1122 4595 7852',
      panCopy: '4562112245957852',
      expiry: '12/39',
      cvv: '698',
      balanceFormatted: 'R$ 50.000,00',
      variant: 'full',
    },
    {
      bgRect: `${G}/Rectangle2-95077f83-0a08-4bb7-9b4b-8fd78df75696.svg`,
      mapPng: `${G}%2F1cdca65e-6a4e-49b8-95d6-13336e860783.png`,
      holderLabel: '',
      panDisplay: '•••• •••• •••• 8831',
      panCopy: '5555555555558831',
      expiry: '03/27',
      cvv: '042',
      balanceFormatted: 'R$ 8.200,00',
      variant: 'mapOnly',
    },
  ];

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
        },
      ],
    },
  ];

  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

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

  async searchSoon(): Promise<void> {
    await this.actionSoon('Busca');
  }

  async filterSoon(): Promise<void> {
    await this.actionSoon('Filtros');
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
