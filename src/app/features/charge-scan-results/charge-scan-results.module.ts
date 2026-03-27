import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChargeScanResultsPageRoutingModule } from './charge-scan-results-routing.module';
import { ChargeScanResultsPage } from './charge-scan-results.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ChargeScanResultsPageRoutingModule],
  declarations: [ChargeScanResultsPage],
})
export class ChargeScanResultsPageModule {}
