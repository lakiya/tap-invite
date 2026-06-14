import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase/supabase';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const router = inject(Router);
  const user = await supabase.getCurrentUser();
  if (user) return true;
  return router.createUrlTree(['/login']);
};
