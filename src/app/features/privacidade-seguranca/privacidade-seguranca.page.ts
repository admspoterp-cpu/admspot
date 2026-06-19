import { Component, inject } from '@angular/core';
import { NavController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';

const STORAGE_BIOMETRIA = 'admspot_priv_seg_biometria';
const STORAGE_SENHA = 'admspot_priv_seg_senha_transacao';
const STORAGE_PIN = 'admspot_priv_seg_pin';

@Component({
  selector: 'app-privacidade-seguranca',
  templateUrl: './privacidade-seguranca.page.html',
  styleUrls: ['./privacidade-seguranca.page.scss'],
  standalone: false,
})
export class PrivacidadeSegurancaPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);

  readonly caretLeftSrc =
    'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1/CaretLeft-929df931-e44c-4c48-af18-efc51b7cea16.svg';

  /** Habilitar biometria — exclusivo com senha de transação. */
  biometriaEnabled = false;

  /** Habilitar senha de transação — exclusivo com biometria. */
  transactionPasswordEnabled = false;

  /** 4 dígitos numéricos (exibido quando a senha de transação está ativa). */
  transactionPin = '';

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      this.biometriaEnabled = localStorage.getItem(STORAGE_BIOMETRIA) === '1';
      this.transactionPasswordEnabled = localStorage.getItem(STORAGE_SENHA) === '1';
      const pin = localStorage.getItem(STORAGE_PIN);
      this.transactionPin = pin && /^\d{4}$/.test(pin) ? pin : '';
    } catch {
      this.biometriaEnabled = false;
      this.transactionPasswordEnabled = false;
      this.transactionPin = '';
    }
    this.reconcileExclusive();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_BIOMETRIA, this.biometriaEnabled ? '1' : '0');
      localStorage.setItem(STORAGE_SENHA, this.transactionPasswordEnabled ? '1' : '0');
      if (this.transactionPasswordEnabled && /^\d{4}$/.test(this.transactionPin)) {
        localStorage.setItem(STORAGE_PIN, this.transactionPin);
      } else {
        localStorage.removeItem(STORAGE_PIN);
      }
    } catch {
      // ignora
    }
  }

  /** Garante no máximo uma opção ativa e coerência com a UI. */
  private reconcileExclusive(): void {
    if (this.biometriaEnabled && this.transactionPasswordEnabled) {
      this.transactionPasswordEnabled = false;
      this.transactionPin = '';
    }
  }

  get senhaSwitchDisabled(): boolean {
    return this.biometriaEnabled;
  }

  get biometriaSwitchDisabled(): boolean {
    return this.transactionPasswordEnabled;
  }

  onBiometriaChange(ev: CustomEvent): void {
    const checked = Boolean(ev.detail?.checked);
    this.biometriaEnabled = checked;
    if (checked) {
      this.transactionPasswordEnabled = false;
      this.transactionPin = '';
    }
    this.persist();
  }

  onSenhaTransacaoChange(ev: CustomEvent): void {
    if (this.senhaSwitchDisabled) {
      return;
    }
    const checked = Boolean(ev.detail?.checked);
    this.transactionPasswordEnabled = checked;
    if (checked) {
      this.biometriaEnabled = false;
    } else {
      this.transactionPin = '';
    }
    this.persist();
  }

  onPinModelChange(): void {
    this.transactionPin = this.transactionPin.replace(/\D/g, '').slice(0, 4);
    this.persist();
  }

  goBack(): void {
    void this.navController.back();
  }
}
