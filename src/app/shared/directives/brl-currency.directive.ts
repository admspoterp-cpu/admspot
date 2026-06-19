import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, Optional } from '@angular/core';
import { NgModel } from '@angular/forms';
import { Subscription } from 'rxjs';

import { brlStringToCents, formatBrlFromCents } from '../utils/brl-currency.util';

/**
 * Máscara monetária BRL em `<input>` com `[(ngModel)]`.
 * Dígitos digitados são interpretados como centavos: 0,00 → 0,01 → … → 1.000,00.
 *
 * A formatação inicial não pode rodar síncrona em `ngAfterViewInit`: com `*ngIf` e dados
 * assíncronos, o `NgModel` às vezes ainda não recebeu o valor do componente — ler `''` e
 * fazer `setValue('0,00')` zerava a meta no modelo mesmo sem o utilizador tocar no campo.
 */
@Directive({
  selector: '[appBrlCurrency]',
  standalone: false,
})
export class BrlCurrencyDirective implements AfterViewInit, OnDestroy {
  private valueChangesSub?: Subscription;

  constructor(
    @Optional() private readonly ngModel: NgModel | null,
    private readonly host: ElementRef<HTMLInputElement>,
  ) {}

  ngAfterViewInit(): void {
    if (!this.ngModel?.control) {
      return;
    }
    const ctrl = this.ngModel.control;
    const runSync = () => this.syncFormattedFromModel();
    queueMicrotask(runSync);
    setTimeout(runSync, 0);

    this.valueChangesSub = ctrl.valueChanges.subscribe(() => {
      this.syncFormattedFromModel();
    });
  }

  ngOnDestroy(): void {
    this.valueChangesSub?.unsubscribe();
  }

  /** Alinha modelo + DOM ao formato de centavos (`emitEvent: false` para não reentrar em `valueChanges`). */
  private syncFormattedFromModel(): void {
    if (!this.ngModel?.control) {
      return;
    }
    const ctrl = this.ngModel.control;
    const input = this.host.nativeElement;
    const formatted = formatBrlFromCents(brlStringToCents(String(ctrl.value ?? '')));
    if (ctrl.value === formatted) {
      if (input.value !== formatted) {
        input.value = formatted;
      }
      return;
    }
    ctrl.setValue(formatted, { emitEvent: false });
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
