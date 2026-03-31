import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ViewWillEnter } from '@ionic/angular';

@Component({
  selector: 'app-wallet-digital-unavailable',
  templateUrl: './wallet-digital-unavailable.page.html',
  styleUrls: ['./wallet-digital-unavailable.page.scss'],
  standalone: false,
})
export class WalletDigitalUnavailablePage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Se `1`, o voltar devolve à seleção de carteiras com `?pick=1`. */
  private returnPick = false;

  ionViewWillEnter(): void {
    this.returnPick = this.route.snapshot.queryParamMap.get('returnPick') === '1';
  }

  goBack(): void {
    if (this.returnPick) {
      void this.router.navigate(['/wallet-digital-setup'], { queryParams: { pick: '1' } });
      return;
    }
    void this.navController.navigateRoot('/wallet-digital-setup');
  }
}
