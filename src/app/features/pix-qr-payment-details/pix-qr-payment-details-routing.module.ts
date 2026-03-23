import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PixQrPaymentDetailsPage } from './pix-qr-payment-details.page';

const routes: Routes = [
  {
    path: '',
    component: PixQrPaymentDetailsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PixQrPaymentDetailsPageRoutingModule {}
