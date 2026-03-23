import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BoletoPaymentSuccessPage } from './boleto-payment-success.page';

const routes: Routes = [
  {
    path: '',
    component: BoletoPaymentSuccessPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BoletoPaymentSuccessPageRoutingModule {}
