import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CobrancasPage } from './cobrancas.page';

const routes: Routes = [
  {
    path: '',
    component: CobrancasPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CobrancasPageRoutingModule {}
