import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TransferTedPage } from './transfer-ted.page';

const routes: Routes = [
  {
    path: '',
    component: TransferTedPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransferTedPageRoutingModule {}
