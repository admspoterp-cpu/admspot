import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { RecargaSuccessPage } from './recarga-success.page';

const routes: Routes = [
  {
    path: '',
    component: RecargaSuccessPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RecargaSuccessPageRoutingModule {}
