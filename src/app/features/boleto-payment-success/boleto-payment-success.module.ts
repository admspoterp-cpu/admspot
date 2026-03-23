import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BoletoPaymentSuccessPageRoutingModule } from './boleto-payment-success-routing.module';
import { BoletoPaymentSuccessPage } from './boleto-payment-success.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BoletoPaymentSuccessPageRoutingModule,
  ],
  declarations: [BoletoPaymentSuccessPage],
})
export class BoletoPaymentSuccessPageModule {}
