import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../../shared/shared.module';
import { PixQrOpenAmountPageRoutingModule } from './pix-qr-open-amount-routing.module';
import { PixQrOpenAmountPage } from './pix-qr-open-amount.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    PixQrOpenAmountPageRoutingModule,
  ],
  declarations: [PixQrOpenAmountPage],
})
export class PixQrOpenAmountPageModule {}
