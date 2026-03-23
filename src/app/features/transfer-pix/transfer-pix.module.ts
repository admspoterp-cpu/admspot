import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TransferPixPageRoutingModule } from './transfer-pix-routing.module';
import { TransferPixPage } from './transfer-pix.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TransferPixPageRoutingModule],
  declarations: [TransferPixPage],
})
export class TransferPixPageModule {}
