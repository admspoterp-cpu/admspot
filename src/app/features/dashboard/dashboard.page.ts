import { Component, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage {
  balanceHidden = false;
  activeTab: 'Home' | 'Send' | 'Pagar' | 'Cards' | 'More' = 'Home';
  paymentSheetOpen = false;
  private readonly navController = inject(NavController);

  toggleBalance(): void {
    this.balanceHidden = !this.balanceHidden;
  }

  setActiveTab(tab: 'Home' | 'Send' | 'Pagar' | 'Cards' | 'More'): void {
    this.activeTab = tab;
    if (tab !== 'Pagar') {
      this.paymentSheetOpen = false;
    }
  }

  openPaymentSheet(): void {
    this.activeTab = 'Pagar';
    this.paymentSheetOpen = true;
  }

  closePaymentSheet(): void {
    this.paymentSheetOpen = false;
  }

  goToQrScanner(): void {
    this.closePaymentSheet();
    this.navController.navigateForward('/qr-scan');
  }
}
