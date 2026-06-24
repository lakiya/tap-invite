import { InjectionToken, makeStateKey } from '@angular/core';

export interface AppEnv {
  supabaseUrl: string;
  supabaseKey: string;
}

export const APP_ENV = new InjectionToken<AppEnv>('APP_ENV');
export const APP_ENV_STATE_KEY = makeStateKey<AppEnv>('appEnv');
