import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PixQrOpenAmountPage } from './pix-qr-open-amount.page';

const routes: Routes = [
  {
    path: '',
    component: PixQrOpenAmountPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PixQrOpenAmountPageRoutingModule {}
