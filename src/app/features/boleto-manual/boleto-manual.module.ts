import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BoletoManualPageRoutingModule } from './boleto-manual-routing.module';
import { BoletoManualPage } from './boleto-manual.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BoletoManualPageRoutingModule,
  ],
  declarations: [BoletoManualPage],
})
export class BoletoManualPageModule {}
