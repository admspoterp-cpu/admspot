import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';

import { CARTOES_MOCK, type CartaoDados } from './cartoes-data';

const ASSET =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

@Component({
  selector: 'app-cartao-info',
  templateUrl: './cartao-info.page.html',
  styleUrls: ['./cartao-info.page.scss'],
  standalone: false,
})
export class CartaoInfoPage implements OnInit {
  readonly assetBase = ASSET;

  cardIndex = 0;
  baseCard!: CartaoDados;
  editEnabled = false;

  draft = {
    holderLabel: '',
    panDisplay: '',
    expiry: '',
    cvv: '',
  };

  private readonly route = inject(ActivatedRoute);
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('cardIndex');
    let i = raw != null ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(i) || i < 0 || i >= CARTOES_MOCK.length) {
      i = 0;
    }
    this.cardIndex = i;
    this.baseCard = CARTOES_MOCK[i];
    this.loadDraftFromBase();
  }

  loadDraftFromBase(): void {
    const c = this.baseCard;
    this.draft = {
      holderLabel: c.holderLabel,
      panDisplay: c.panDisplay,
      expiry: c.expiry,
      cvv: c.cvv,
    };
  }

  get previewCard(): CartaoDados {
    const digits = this.draft.panDisplay.replace(/\D/g, '');
    return {
      ...this.baseCard,
      holderLabel: this.draft.holderLabel,
      panDisplay: this.draft.panDisplay,
      panCopy: digits || this.baseCard.panCopy,
      expiry: this.draft.expiry,
      cvv: this.draft.cvv,
    };
  }

  onEditToggle(ev: Event): void {
    const ce = ev as CustomEvent<{ checked: boolean }>;
    const checked = !!ce.detail?.checked;
    if (!checked) {
      this.loadDraftFromBase();
    }
    this.editEnabled = checked;
  }

  goBack(): void {
    this.navController.back();
  }

  async copyPan(): Promise<void> {
    const card = this.previewCard;
    try {
      await navigator.clipboard.writeText(card.panCopy);
      await this.presentToast('Número do cartão copiado');
    } catch {
      await this.presentToast('Não foi possível copiar o número', 'warning');
    }
  }

  async copyCvv(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.previewCard.cvv);
      await this.presentToast('CVV copiado');
    } catch {
      await this.presentToast('Não foi possível copiar o CVV', 'warning');
    }
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
