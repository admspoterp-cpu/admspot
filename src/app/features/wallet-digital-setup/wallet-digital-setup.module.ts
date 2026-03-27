import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { WalletDigitalSetupPageRoutingModule } from './wallet-digital-setup-routing.module';
import { WalletDigitalSetupPage } from './wallet-digital-setup.page';

@NgModule({
  imports: [CommonModule, IonicModule, WalletDigitalSetupPageRoutingModule],
  declarations: [WalletDigitalSetupPage],
})
export class WalletDigitalSetupPageModule {}
