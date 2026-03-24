import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DepositarPageRoutingModule } from './depositar-routing.module';
import { DepositarPage } from './depositar.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, DepositarPageRoutingModule],
  declarations: [DepositarPage],
})
export class DepositarPageModule {}
