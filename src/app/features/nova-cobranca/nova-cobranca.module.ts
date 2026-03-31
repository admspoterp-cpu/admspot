import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../../shared/shared.module';
import { NovaCobrancaPageRoutingModule } from './nova-cobranca-routing.module';
import { NovaCobrancaPage } from './nova-cobranca.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, NovaCobrancaPageRoutingModule],
  declarations: [NovaCobrancaPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NovaCobrancaPageModule {}
