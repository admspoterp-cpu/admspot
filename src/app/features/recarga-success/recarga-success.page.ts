import { Component, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

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

  constructor() {
    const navState = (window.history.state as {
      operatorName?: string;
      operatorImage?: string;
      phone?: string;
      amount?: number;
    }) ?? {};

    this.operatorName = navState.operatorName ?? 'VIVO';
    this.operatorImage = navState.operatorImage ?? 'assets/recarga-operadoras/VIVO.webp';
    this.phone = navState.phone ?? '(00) 00000-0000';
    this.amount = Number.isFinite(navState.amount) ? Number(navState.amount) : 50;
  }

  get amountLabel(): string {
    return this.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  goBack(): void {
    this.navController.back();
  }
}
