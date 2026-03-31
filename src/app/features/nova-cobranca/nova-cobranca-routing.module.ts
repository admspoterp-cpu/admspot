import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { NovaCobrancaPage } from './nova-cobranca.page';

const routes: Routes = [
  {
    path: '',
    component: NovaCobrancaPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NovaCobrancaPageRoutingModule {}
