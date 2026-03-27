import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-boleto-manual',
  templateUrl: './boleto-manual.page.html',
  styleUrls: ['./boleto-manual.page.scss'],
  standalone: false,
})
export class BoletoManualPage {
  private readonly navController = inject(NavController);
  private readonly router = inject(Router);

  private linhaDigitavelDigits = '';
  submitting = false;

  goBack(): void {
    this.navController.navigateBack('/boleto-scan');
  }

  get continueDisabled(): boolean {
    const digits = this.linhaDigitavelDigits;
    return this.submitting || !(digits.length === 44 || digits.length === 47 || digits.length === 48);
  }

  get linhaDigitavelDisplay(): string {
    return this.formatLinhaForTyping(this.linhaDigitavelDigits);
  }

  onLinhaDigitavelInput(raw: string): void {
    this.linhaDigitavelDigits = String(raw ?? '').replace(/\D/g, '').slice(0, 48);
  }

  async onContinue(): Promise<void> {
    if (this.continueDisabled) {
      return;
    }
    this.submitting = true;
    try {
      await this.router.navigate(['/boleto-payment-details'], {
        state: {
          linhaDigitavel: this.linhaDigitavelDigits,
          source: 'manual',
        },
      });
    } finally {
      this.submitting = false;
    }
  }

  /** Quebra visual da linha digitável para não ficar longa em linha única. */
  private formatLinhaForTyping(digits: string): string {
    if (!digits) {
      return '';
    }
    const blocks: string[] = [];
    const chunk = 12;
    for (let i = 0; i < digits.length; i += chunk) {
      blocks.push(digits.slice(i, i + chunk));
    }
    if (blocks.length <= 2) {
      return blocks.join(' ');
    }
    return `${blocks[0]} ${blocks[1]}\n${blocks.slice(2).join(' ')}`.trim();
  }
}
