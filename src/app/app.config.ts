import { ApplicationConfig, provideBrowserGlobalErrorListeners, TransferState } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideLottieOptions } from 'ngx-lottie';
import { APP_ENV, APP_ENV_STATE_KEY, AppEnv } from './core/tokens/app-env';

const DEFAULT_ENV: AppEnv = { supabaseUrl: '', supabaseKey: '' };

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
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
