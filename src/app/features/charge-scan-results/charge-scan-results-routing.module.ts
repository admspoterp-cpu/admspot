import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChargeScanResultsPage } from './charge-scan-results.page';

const routes: Routes = [
  {
    path: '',
    component: ChargeScanResultsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChargeScanResultsPageRoutingModule {}
