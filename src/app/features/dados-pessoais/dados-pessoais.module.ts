import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DadosPessoaisPageRoutingModule } from './dados-pessoais-routing.module';
import { DadosPessoaisPage } from './dados-pessoais.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, DadosPessoaisPageRoutingModule],
  declarations: [DadosPessoaisPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DadosPessoaisPageModule {}
