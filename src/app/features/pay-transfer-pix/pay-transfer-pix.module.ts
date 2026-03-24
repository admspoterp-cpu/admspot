import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SharedModule } from '../../shared/shared.module';
import { PayTransferPixPageRoutingModule } from './pay-transfer-pix-routing.module';
import { PayTransferPixPage } from './pay-transfer-pix.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, PayTransferPixPageRoutingModule],
  declarations: [PayTransferPixPage],
})
export class PayTransferPixPageModule {}
