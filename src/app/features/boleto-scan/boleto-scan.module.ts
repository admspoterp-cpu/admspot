import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BoletoScanPageRoutingModule } from './boleto-scan-routing.module';
import { BoletoScanPage } from './boleto-scan.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BoletoScanPageRoutingModule,
  ],
  declarations: [BoletoScanPage],
})
export class BoletoScanPageModule {}
