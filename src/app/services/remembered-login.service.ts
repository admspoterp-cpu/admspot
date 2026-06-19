import { Injectable } from '@angular/core';

/**
 * Perfil "lembrado" do último login, usado só para a UI de boas-vindas
 * (saudação "Olá, <nome>"). NÃO guarda credenciais — documento+senha ficam
 * no cofre seguro do aparelho via {@link BiometricAuthService}.
 */
export type RememberedProfile = {
  /** Nome exibido na saudação. */
  name: string;
  /** Documento mascarado, apenas para exibição (ex.: `•••.•••.•••-99`). */
  documentMasked: string;
};

@Injectable({ providedIn: 'root' })
export class RememberedLoginService {
  private readonly nameKey = 'admspot_remember_name';
  private readonly docMaskedKey = 'admspot_remember_doc_masked';

  save(profile: RememberedProfile): void {
    try {
      localStorage.setItem(this.nameKey, profile.name ?? '');
      localStorage.setItem(this.docMaskedKey, profile.documentMasked ?? '');
    } catch {
      // Sem persistência: o app só não mostra a tela de boas-vindas.
    }
  }

  get(): RememberedProfile | null {
    try {
      const name = localStorage.getItem(this.nameKey);
      if (name === null) {
        return null;
      }
      return { name, documentMasked: localStorage.getItem(this.docMaskedKey) ?? '' };
    } catch {
      return null;
    }
  }

  has(): boolean {
    try {
      return localStorage.getItem(this.nameKey) !== null;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.nameKey);
      localStorage.removeItem(this.docMaskedKey);
    } catch {
      // ignore
    }
  }
}
