import { Component, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage {
  private readonly navController = inject(NavController);

  goToLogin(): void {
    this.navController.navigateForward('/login');
  }
}
