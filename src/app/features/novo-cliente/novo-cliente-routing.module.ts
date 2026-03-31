import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { NovoClientePage } from './novo-cliente.page';

const routes: Routes = [
  {
    path: '',
    component: NovoClientePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NovoClientePageRoutingModule {}
