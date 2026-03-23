import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BoletoPaymentDetailsPageRoutingModule } from './boleto-payment-details-routing.module';
import { BoletoPaymentDetailsPage } from './boleto-payment-details.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BoletoPaymentDetailsPageRoutingModule,
  ],
  declarations: [BoletoPaymentDetailsPage],
})
export class BoletoPaymentDetailsPageModule {}
