import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { QrScanPage } from './qr-scan.page';

const routes: Routes = [
  {
    path: '',
    component: QrScanPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QrScanPageRoutingModule {}
