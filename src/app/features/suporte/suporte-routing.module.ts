import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SuporteChamadoPage } from './suporte-chamado.page';
import { SuportePage } from './suporte.page';

const routes: Routes = [
  {
    path: '',
    component: SuportePage,
  },
  {
    path: 'chamado/:id',
    component: SuporteChamadoPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SuportePageRoutingModule {}
