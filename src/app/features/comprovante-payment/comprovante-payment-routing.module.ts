import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ComprovantePaymentPage } from './comprovante-payment.page';

const routes: Routes = [
  {
    path: '',
    component: ComprovantePaymentPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ComprovantePaymentPageRoutingModule {}
