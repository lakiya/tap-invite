import { ApplicationConfig, provideBrowserGlobalErrorListeners, TransferState } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideLottieOptions } from 'ngx-lottie';
import { APP_ENV, APP_ENV_STATE_KEY, AppEnv } from './core/tokens/app-env';
import { environment } from '../environments/environment';

const DEFAULT_ENV: AppEnv = { supabaseUrl: environment.supabaseUrl, supabaseKey: environment.supabaseKey };

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideAnimationsAsync(),
    provideLottieOptions({
      player: () => import('lottie-web'),
    }),
    {
      provide: APP_ENV,
      useFactory: (ts: TransferState): AppEnv => ts.get(APP_ENV_STATE_KEY, DEFAULT_ENV),
      deps: [TransferState],
    },
  ],
};
