import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NovoClientePageRoutingModule } from './novo-cliente-routing.module';
import { NovoClientePage } from './novo-cliente.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, NovoClientePageRoutingModule],
  declarations: [NovoClientePage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NovoClientePageModule {}
