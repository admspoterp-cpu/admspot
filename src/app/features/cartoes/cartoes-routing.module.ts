import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CartaoInfoPage } from './cartao-info.page';
import { CartaoNovoPage } from './cartao-novo.page';
import { CartoesPage } from './cartoes.page';

const routes: Routes = [
  {
    path: '',
    component: CartoesPage,
  },
  {
    path: 'info/:cardIndex',
    component: CartaoInfoPage,
  },
  {
    path: 'novo',
    component: CartaoNovoPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CartoesPageRoutingModule {}
