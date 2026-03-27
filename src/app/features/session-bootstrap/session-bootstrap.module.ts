import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { SessionBootstrapPageRoutingModule } from './session-bootstrap-routing.module';
import { SessionBootstrapPage } from './session-bootstrap.page';

@NgModule({
  imports: [CommonModule, IonicModule, SessionBootstrapPageRoutingModule],
  declarations: [SessionBootstrapPage],
})
export class SessionBootstrapPageModule {}
