import { Injectable } from '@angular/core';

import type { CentralClient } from './clients-list.service';

/**
 * Passa o cliente escolhido em `cliente-detalhe` → Nova Cobrança sem depender de
 * `Router.getCurrentNavigation()` (que costuma ser `null` em rotas lazy-loaded).
 */
@Injectable({ providedIn: 'root' })
export class NovaCobrancaClientePrefillService {
  private pending: CentralClient | null = null;

  setPendingClient(c: CentralClient | null): void {
    this.pending = c;
  }

  /** Lê e limpa — só um consumo por navegação. */
  consumePendingClient(): CentralClient | null {
    const c = this.pending;
    this.pending = null;
    return c;
  }
}
