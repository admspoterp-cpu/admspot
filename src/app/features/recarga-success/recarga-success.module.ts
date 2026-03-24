import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RecargaSuccessPageRoutingModule } from './recarga-success-routing.module';
import { RecargaSuccessPage } from './recarga-success.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RecargaSuccessPageRoutingModule],
  declarations: [RecargaSuccessPage],
})
export class RecargaSuccessPageModule {}
