import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PayTransferPixPageRoutingModule } from './pay-transfer-pix-routing.module';
import { PayTransferPixPage } from './pay-transfer-pix.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PayTransferPixPageRoutingModule],
  declarations: [PayTransferPixPage],
})
export class PayTransferPixPageModule {}
