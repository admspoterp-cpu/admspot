import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TransferTedInfoPageRoutingModule } from './transfer-ted-info-routing.module';
import { TransferTedInfoPage } from './transfer-ted-info.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TransferTedInfoPageRoutingModule],
  declarations: [TransferTedInfoPage],
})
export class TransferTedInfoPageModule {}
