import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PayTransferPixPage } from './pay-transfer-pix.page';

const routes: Routes = [
  {
    path: '',
    component: PayTransferPixPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PayTransferPixPageRoutingModule {}
