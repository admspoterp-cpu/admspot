import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BoletoScanPage } from './boleto-scan.page';

const routes: Routes = [
  {
    path: '',
    component: BoletoScanPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BoletoScanPageRoutingModule {}
