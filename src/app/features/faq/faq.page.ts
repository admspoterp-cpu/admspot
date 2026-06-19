import { Component, inject } from '@angular/core';
import { NavController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-faq',
  templateUrl: './faq.page.html',
  styleUrls: ['./faq.page.scss'],
  standalone: false,
})
export class FaqPage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);

  readonly caretLeftSrc =
    'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1/CaretLeft-929df931-e44c-4c48-af18-efc51b7cea16.svg';

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
    }
  }

  goBack(): void {
    void this.navController.back();
  }
}
