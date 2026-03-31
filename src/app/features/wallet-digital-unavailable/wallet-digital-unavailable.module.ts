import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { WalletDigitalUnavailablePageRoutingModule } from './wallet-digital-unavailable-routing.module';
import { WalletDigitalUnavailablePage } from './wallet-digital-unavailable.page';

@NgModule({
  imports: [CommonModule, IonicModule, WalletDigitalUnavailablePageRoutingModule],
  declarations: [WalletDigitalUnavailablePage],
})
export class WalletDigitalUnavailablePageModule {}
