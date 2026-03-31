import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CobrancaDetalhePageRoutingModule } from './cobranca-detalhe-routing.module';
import { CobrancaDetalhePage } from './cobranca-detalhe.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CobrancaDetalhePageRoutingModule],
  declarations: [CobrancaDetalhePage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CobrancaDetalhePageModule {}
