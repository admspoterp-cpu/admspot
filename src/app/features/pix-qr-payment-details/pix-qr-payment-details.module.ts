import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PixQrPaymentDetailsPageRoutingModule } from './pix-qr-payment-details-routing.module';
import { PixQrPaymentDetailsPage } from './pix-qr-payment-details.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PixQrPaymentDetailsPageRoutingModule,
  ],
  declarations: [PixQrPaymentDetailsPage],
})
export class PixQrPaymentDetailsPageModule {}
