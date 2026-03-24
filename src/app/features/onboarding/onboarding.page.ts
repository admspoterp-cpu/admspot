import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage implements OnInit, OnDestroy {
  private readonly navController = inject(NavController);
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
