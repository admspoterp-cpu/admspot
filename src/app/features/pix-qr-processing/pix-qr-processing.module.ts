import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { PixQrProcessingPageRoutingModule } from './pix-qr-processing-routing.module';
import { PixQrProcessingPage } from './pix-qr-processing.page';

@NgModule({
  imports: [CommonModule, IonicModule, PixQrProcessingPageRoutingModule],
  declarations: [PixQrProcessingPage],
})
export class PixQrProcessingPageModule {}
