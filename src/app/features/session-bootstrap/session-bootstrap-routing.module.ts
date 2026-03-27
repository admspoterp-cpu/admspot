import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SessionBootstrapPage } from './session-bootstrap.page';

const routes: Routes = [
  {
    path: '',
    component: SessionBootstrapPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SessionBootstrapPageRoutingModule {}
