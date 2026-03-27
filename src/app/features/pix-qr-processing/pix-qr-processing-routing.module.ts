import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PixQrProcessingPage } from './pix-qr-processing.page';

const routes: Routes = [
  {
    path: '',
    component: PixQrProcessingPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PixQrProcessingPageRoutingModule {}
