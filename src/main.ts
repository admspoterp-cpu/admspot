import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { register } from 'swiper/element/bundle';

import { AppModule } from './app/app.module';

register();

function removeAppSplash(): void {
  const el = document.getElementById('app-splash');
  if (!el) {
    return;
  }
  el.classList.add('app-splash--exiting');
  window.setTimeout(() => {
    el.remove();
  }, 400);
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .then(() => removeAppSplash())
  .catch((err) => {
    console.log(err);
    removeAppSplash();
  });
