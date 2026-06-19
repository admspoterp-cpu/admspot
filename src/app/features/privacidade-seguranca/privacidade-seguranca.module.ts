import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PrivacidadeSegurancaPageRoutingModule } from './privacidade-seguranca-routing.module';
import { PrivacidadeSegurancaPage } from './privacidade-seguranca.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PrivacidadeSegurancaPageRoutingModule],
  declarations: [PrivacidadeSegurancaPage],
})
export class PrivacidadeSegurancaPageModule {}
