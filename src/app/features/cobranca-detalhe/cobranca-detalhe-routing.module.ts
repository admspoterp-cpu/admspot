import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CobrancaDetalhePage } from './cobranca-detalhe.page';

const routes: Routes = [
  {
    path: '',
    component: CobrancaDetalhePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CobrancaDetalhePageRoutingModule {}
