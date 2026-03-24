import { AfterViewInit, Directive, ElementRef, HostListener, Optional } from '@angular/core';
import { NgModel } from '@angular/forms';

import { brlStringToCents, formatBrlFromCents } from '../utils/brl-currency.util';

/**
 * Máscara monetária BRL em `<input>` com `[(ngModel)]`.
 * Dígitos digitados são interpretados como centavos: 0,00 → 0,01 → … → 1.000,00.
 */
@Directive({
  selector: '[appBrlCurrency]',
  standalone: false,
})
export class BrlCurrencyDirective implements AfterViewInit {
  constructor(
    @Optional() private readonly ngModel: NgModel | null,
    private readonly host: ElementRef<HTMLInputElement>,
  ) {}

  ngAfterViewInit(): void {
    if (!this.ngModel?.control) {
      return;
    }
    const input = this.host.nativeElement;
    const formatted = formatBrlFromCents(brlStringToCents(String(this.ngModel.control.value ?? '')));
    this.ngModel.control.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  @HostListener('input', ['$event'])
  onInput(ev: Event): void {
    if (!this.ngModel?.control) {
      return;
    }
    const input = ev.target as HTMLInputElement;
    const raw = input.value;
    const formatted = formatBrlFromCents(brlStringToCents(raw));
    const ctrl = this.ngModel.control;
    ctrl.setValue(formatted, { emitEvent: true });
    window.setTimeout(() => {
      if (input.value !== formatted) {
        input.value = formatted;
      }
      const len = formatted.length;
      try {
        input.setSelectionRange(len, len);
      } catch {
        // ignora
      }
    }, 0);
  }
}
