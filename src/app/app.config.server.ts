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
        const supabaseUrl = process.env['SUPABASE_URL'];
        const supabaseKey = process.env['SUPABASE_KEY'];
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('[server] SUPABASE_URL and SUPABASE_KEY must be set as environment variables');
        }
        const env: AppEnv = { supabaseUrl, supabaseKey };
        ts.set(APP_ENV_STATE_KEY, env);
        return env;
      },
      deps: [TransferState],
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
