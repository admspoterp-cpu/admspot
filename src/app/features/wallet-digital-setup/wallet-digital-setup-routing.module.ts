import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { WalletDigitalSetupPage } from './wallet-digital-setup.page';

const routes: Routes = [
  {
    path: '',
    component: WalletDigitalSetupPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WalletDigitalSetupPageRoutingModule {}
