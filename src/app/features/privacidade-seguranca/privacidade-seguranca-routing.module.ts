import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PrivacidadeSegurancaPage } from './privacidade-seguranca.page';

const routes: Routes = [
  {
    path: '',
    component: PrivacidadeSegurancaPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PrivacidadeSegurancaPageRoutingModule {}
