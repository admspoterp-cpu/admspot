import { Component, inject } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

import { BiometricAuthService } from '../../services/biometric-auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  private readonly navController = inject(NavController);
  private readonly toastController = inject(ToastController);
  private readonly biometricAuth = inject(BiometricAuthService);

  showPassword = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Acesso ao dashboard só após biometria nativa (Face ID / Touch ID / digital).
   */
  async onAccess(): Promise<void> {
    const result = await this.biometricAuth.authenticateForLogin();

    switch (result) {
      case 'success':
        await this.navController.navigateRoot('/dashboard');
        return;

      case 'not_native': {
        const toast = await this.toastController.create({
          message:
            'O login com Face ID ou digital está disponível apenas no app instalado no celular (iOS ou Android).',
          duration: 4000,
          position: 'bottom',
          color: 'medium',
        });
        await toast.present();
        return;
      }

      case 'not_available': {
        const toast = await this.toastController.create({
          message:
            'Biometria não disponível. Ative Face ID, Touch ID ou impressão digital nas configurações do celular.',
          duration: 4500,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      case 'cancelled_or_failed':
        // Cancelamento explícito: sem toast; falha técnica poderia ser logada depois
        return;

      default:
        return;
    }
  }
}
