import { Component, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-boleto-manual',
  templateUrl: './boleto-manual.page.html',
  styleUrls: ['./boleto-manual.page.scss'],
  standalone: false,
})
export class BoletoManualPage {
  private readonly navController = inject(NavController);

  goBack(): void {
    this.navController.navigateBack('/boleto-scan');
  }
}
