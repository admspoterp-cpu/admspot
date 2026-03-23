import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TransferPixPage } from './transfer-pix.page';

const routes: Routes = [
  {
    path: '',
    component: TransferPixPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransferPixPageRoutingModule {}
