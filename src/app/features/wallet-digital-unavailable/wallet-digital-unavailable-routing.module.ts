import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { WalletDigitalUnavailablePage } from './wallet-digital-unavailable.page';

const routes: Routes = [
  {
    path: '',
    component: WalletDigitalUnavailablePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WalletDigitalUnavailablePageRoutingModule {}
