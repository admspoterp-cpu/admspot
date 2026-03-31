import { Component, inject } from '@angular/core';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';
import { ClientsCreateService } from '../../services/clients-create.service';
import {
  digitsOnly,
  formatCepMask,
  formatCpfCnpjMask,
  formatWhatsappBrMask,
  isValidCepDigits,
  isValidDocumentDigits,
} from '../../shared/utils/client-form-mask.util';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-novo-cliente',
  templateUrl: './novo-cliente.page.html',
  styleUrls: ['./novo-cliente.page.scss'],
  standalone: false,
})
export class NovoClientePage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-551d7cb4-ea42-4617-adb3-2d33f5ed3da9.svg`;

  name = '';
  documentDisplay = '';
  email = '';
  whatsappDisplay = '';
  cepDisplay = '';
  number = '';

  attemptedSubmit = false;
  submitBusy = false;

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly toastController = inject(ToastController);
  private readonly clientsCreateService = inject(ClientsCreateService);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
    }
  }

  goBack(): void {
    void this.navController.back();
  }

  onDocumentInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.documentDisplay = formatCpfCnpjMask(el.value);
  }

  onCepInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.cepDisplay = formatCepMask(el.value);
  }

  onWhatsappInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.whatsappDisplay = formatWhatsappBrMask(el.value);
  }

  get nameError(): string | null {
    if (!this.attemptedSubmit) {
      return null;
    }
    const t = this.name.trim();
    if (!t) {
      return 'Informe o nome completo.';
    }
    if (t.length < 2) {
      return 'Nome muito curto.';
    }
    return null;
  }

  get documentError(): string | null {
    if (!this.attemptedSubmit) {
      return null;
    }
    const d = digitsOnly(this.documentDisplay);
    if (!isValidDocumentDigits(d)) {
      return 'CPF (11 dígitos) ou CNPJ (14 dígitos).';
    }
    return null;
  }

  get emailError(): string | null {
    if (!this.attemptedSubmit) {
      return null;
    }
    const t = this.email.trim();
    if (!t) {
      return 'Informe o e-mail.';
    }
    if (!EMAIL_RE.test(t)) {
      return 'E-mail inválido.';
    }
    return null;
  }

  get whatsappError(): string | null {
    if (!this.attemptedSubmit) {
      return null;
    }
    const d = digitsOnly(this.whatsappDisplay);
    if (d.length < 10 || d.length > 11) {
      return 'DDD + número (10 ou 11 dígitos).';
    }
    return null;
  }

  get cepError(): string | null {
    if (!this.attemptedSubmit) {
      return null;
    }
    const d = digitsOnly(this.cepDisplay);
    if (!isValidCepDigits(d)) {
      return 'CEP com 8 dígitos.';
    }
    return null;
  }

  get numberError(): string | null {
    if (!this.attemptedSubmit) {
      return null;
    }
    if (!this.number.trim()) {
      return 'Informe o número.';
    }
    return null;
  }

  private isFormValid(): boolean {
    return (
      !this.nameError &&
      !this.documentError &&
      !this.emailError &&
      !this.whatsappError &&
      !this.cepError &&
      !this.numberError
    );
  }

  async onSubmit(): Promise<void> {
    this.attemptedSubmit = true;
    if (!this.isFormValid()) {
      const t = await this.toastController.create({
        message: 'Verifique os campos destacados.',
        duration: 2800,
        color: 'warning',
        position: 'top',
      });
      void t.present();
      return;
    }

    const accessToken = this.authSession.getAccessToken()?.trim();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!accessToken || !walletToken) {
      const t = await this.toastController.create({
        message: 'Sessão ou carteira indisponível. Faça login novamente.',
        duration: 3200,
        color: 'danger',
        position: 'top',
      });
      void t.present();
      return;
    }

    this.submitBusy = true;
    try {
      const body = {
        wallet_token: walletToken,
        name: this.name.trim(),
        document: digitsOnly(this.documentDisplay),
        email: this.email.trim(),
        whatsapp: digitsOnly(this.whatsappDisplay),
        zip_code: digitsOnly(this.cepDisplay),
        number: this.number.trim(),
      };

      const res = await this.clientsCreateService.create(accessToken, body);
      if (!res) {
        const t = await this.toastController.create({
          message: 'Não foi possível cadastrar. Tente novamente.',
          duration: 3200,
          color: 'danger',
          position: 'top',
        });
        void t.present();
        return;
      }

      if (res.success === true) {
        const msg = res.message?.trim() || 'Cliente cadastrado.';
        const toast = await this.toastController.create({
          message: msg,
          duration: 2600,
          color: 'success',
          position: 'top',
        });
        void toast.present();
        void this.navController.back();
        return;
      }

      const errMsg = res.message?.trim() || 'Não foi possível cadastrar o cliente.';
      const t = await this.toastController.create({
        message: errMsg,
        duration: 3800,
        color: 'danger',
        position: 'top',
      });
      void t.present();
    } finally {
      this.submitBusy = false;
    }
  }
}
