import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NavController } from '@ionic/angular';

import { RememberedLoginService } from '../../services/remembered-login.service';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage implements OnInit, OnDestroy {
  private readonly navController = inject(NavController);
  private readonly remembered = inject(RememberedLoginService);
  private slideIntervalId?: ReturnType<typeof setInterval>;

  /** Cópias locais em assets/onboarding/slides */
  readonly slides: readonly string[] = [
    'assets/onboarding/slides/photo-1454165804606-c3d57bc86b40.jpeg',
    'assets/onboarding/slides/photo-1486406146926-c627a92ad1ab.jpeg',
  ];

  /** Abre no 2.º item de `slides`; a rotação continua 0 → 1 → 0… */
  activeSlideIndex = 1;

  /** Tempo em ms que cada imagem permanece visível antes de avançar */
  private readonly slideDurationMs = 9000;

  ngOnInit(): void {
    // Usuário lembrado (app nativo): vai direto ao login para entrar por biometria.
    // O /login confirma as credenciais no cofre e, se faltarem, mostra o formulário.
    if (Capacitor.isNativePlatform() && this.remembered.has()) {
      void this.navController.navigateRoot('/login');
      return;
    }

    this.slideIntervalId = window.setInterval(() => {
      this.activeSlideIndex = (this.activeSlideIndex + 1) % this.slides.length;
    }, this.slideDurationMs);
  }

  ngOnDestroy(): void {
    if (this.slideIntervalId !== undefined) {
      window.clearInterval(this.slideIntervalId);
    }
  }

  goToLogin(): void {
    this.navController.navigateForward('/login');
  }
}
