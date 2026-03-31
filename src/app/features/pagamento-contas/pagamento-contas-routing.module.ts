import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PagamentoContasPage } from './pagamento-contas.page';

const routes: Routes = [
  {
    path: '',
    component: PagamentoContasPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagamentoContasPageRoutingModule {}
