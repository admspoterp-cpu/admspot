import { Component, OnInit, inject } from '@angular/core';
import { Platform } from '@ionic/angular';

import { AppResumeLockService } from './services/app-resume-lock.service';
import { AppScreenOrientationService } from './services/app-screen-orientation.service';
import { PushNotificationsService } from './services/push-notifications.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly platform = inject(Platform);
  private readonly screenOrientation = inject(AppScreenOrientationService);
  private readonly pushNotifications = inject(PushNotificationsService);
  readonly resumeLock = inject(AppResumeLockService);

  ngOnInit(): void {
    void this.platform.ready().then(async () => {
      this.screenOrientation.lockPortrait();
      await this.pushNotifications.initialize();
    });
  }

  onResumeUnlock(): void {
    void this.resumeLock.requestUnlock();
  }
}
