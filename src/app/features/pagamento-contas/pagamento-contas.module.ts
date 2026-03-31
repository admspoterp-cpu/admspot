import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PagamentoContasPageRoutingModule } from './pagamento-contas-routing.module';
import { PagamentoContasPage } from './pagamento-contas.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PagamentoContasPageRoutingModule],
  declarations: [PagamentoContasPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PagamentoContasPageModule {}
