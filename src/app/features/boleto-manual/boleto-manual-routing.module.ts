import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BoletoManualPage } from './boleto-manual.page';

const routes: Routes = [
  {
    path: '',
    component: BoletoManualPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BoletoManualPageRoutingModule {}
