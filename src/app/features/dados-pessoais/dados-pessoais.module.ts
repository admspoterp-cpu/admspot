import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DadosPessoaisPageRoutingModule } from './dados-pessoais-routing.module';
import { DadosPessoaisPage } from './dados-pessoais.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, DadosPessoaisPageRoutingModule],
  declarations: [DadosPessoaisPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DadosPessoaisPageModule {}
