import { NgModule } from '@angular/core';

import { BrlCurrencyDirective } from './directives/brl-currency.directive';

@NgModule({
  declarations: [BrlCurrencyDirective],
  exports: [BrlCurrencyDirective],
})
export class SharedModule {}
