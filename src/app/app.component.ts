import { Component, OnInit, inject } from '@angular/core';
import { Platform } from '@ionic/angular';

import { AppResumeLockService } from './services/app-resume-lock.service';
import { AppScreenOrientationService } from './services/app-screen-orientation.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly platform = inject(Platform);
  private readonly screenOrientation = inject(AppScreenOrientationService);
  readonly resumeLock = inject(AppResumeLockService);

  ngOnInit(): void {
    void this.platform.ready().then(() => this.screenOrientation.lockPortrait());
  }

  onResumeUnlock(): void {
    void this.resumeLock.requestUnlock();
  }
}
