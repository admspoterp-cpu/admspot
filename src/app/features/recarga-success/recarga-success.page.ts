import { Component, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

import { recargaResultUiMode } from '../../services/mobile-phone-recharge.service';

export type RecargaSuccessNavState = {
  operatorName?: string;
  operatorImage?: string;
  phone?: string;
  amount?: number;
  rechargeStatus?: string;
  apiMessage?: string;
  uiMode?: 'success' | 'pending' | 'failed';
};

@Component({
  selector: 'app-recarga-success',
  templateUrl: './recarga-success.page.html',
  styleUrls: ['./recarga-success.page.scss'],
  standalone: false,
})
export class RecargaSuccessPage {
  private readonly navController = inject(NavController);

  readonly operatorName: string;
  readonly operatorImage: string;
  readonly phone: string;
  readonly amount: number;
  /** Resultado da API (`asaas.status`). */
  readonly rechargeStatus: string;
  readonly apiMessage: string;
  readonly uiMode: 'success' | 'pending' | 'failed';

  constructor() {
    const s = history.state as RecargaSuccessNavState & Record<string, unknown>;

    this.operatorName = typeof s.operatorName === 'string' && s.operatorName.trim() ? s.operatorName.trim() : 'VIVO';
    this.operatorImage =
      typeof s.operatorImage === 'string' && s.operatorImage.trim()
        ? s.operatorImage.trim()
        : 'assets/recarga-operadoras/VIVO.webp';
    this.phone = typeof s.phone === 'string' && s.phone.trim() ? s.phone.trim() : '(00) 00000-0000';
    this.amount = Number.isFinite(s.amount as number) ? Number(s.amount) : 50;
    this.rechargeStatus = typeof s.rechargeStatus === 'string' ? s.rechargeStatus : '';
    this.apiMessage = typeof s.apiMessage === 'string' ? s.apiMessage.trim() : '';

    const explicit = s.uiMode;
    if (explicit === 'success' || explicit === 'pending' || explicit === 'failed') {
      this.uiMode = explicit;
    } else {
      this.uiMode = recargaResultUiMode(this.rechargeStatus);
    }
  }

  get amountLabel(): string {
    return this.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get headingText(): string {
    if (this.uiMode === 'pending') {
      return 'Recarga em processamento';
    }
    if (this.uiMode === 'failed') {
      return 'Recarga não concluída';
    }
    return 'Recarga Feita!';
  }

  get subText(): string {
    if (this.uiMode === 'pending') {
      return 'Sua solicitação de recarga está em processo, aguarde 1 minuto para finalizar.';
    }
    if (this.uiMode === 'failed') {
      return this.apiMessage || 'Não foi possível concluir a recarga. Tente novamente em instantes.';
    }
    return 'Sua recarga foi realizada com sucesso!';
  }

  goBack(): void {
    this.navController.back();
  }
}
