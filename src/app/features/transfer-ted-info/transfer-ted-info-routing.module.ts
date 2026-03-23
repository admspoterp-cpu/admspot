import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TransferTedInfoPage } from './transfer-ted-info.page';

const routes: Routes = [
  {
    path: '',
    component: TransferTedInfoPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransferTedInfoPageRoutingModule {}
