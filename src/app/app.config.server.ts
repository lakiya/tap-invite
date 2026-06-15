import { mergeApplicationConfig, ApplicationConfig, TransferState } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { APP_ENV, APP_ENV_STATE_KEY, AppEnv } from './core/tokens/app-env';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: APP_ENV,
      useFactory: (ts: TransferState): AppEnv => {
        const env: AppEnv = {
          supabaseUrl: process.env['SUPABASE_URL'] ?? '',
          supabaseKey: process.env['SUPABASE_KEY'] ?? '',
        };
        ts.set(APP_ENV_STATE_KEY, env);
        return env;
      },
      deps: [TransferState],
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
