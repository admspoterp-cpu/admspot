import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { ComprovantePaymentPageRoutingModule } from './comprovante-payment-routing.module';
import { ComprovantePaymentPage } from './comprovante-payment.page';

@NgModule({
  imports: [CommonModule, IonicModule, ComprovantePaymentPageRoutingModule],
  declarations: [ComprovantePaymentPage],
})
export class ComprovantePaymentPageModule {}
