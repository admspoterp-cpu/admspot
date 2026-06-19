import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { FaqPageRoutingModule } from './faq-routing.module';
import { FaqPage } from './faq.page';

@NgModule({
  imports: [CommonModule, IonicModule, FaqPageRoutingModule],
  declarations: [FaqPage],
})
export class FaqPageModule {}
