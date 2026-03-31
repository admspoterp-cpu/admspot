import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CobrancasPageRoutingModule } from './cobrancas-routing.module';
import { CobrancasPage } from './cobrancas.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CobrancasPageRoutingModule],
  declarations: [CobrancasPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CobrancasPageModule {}
