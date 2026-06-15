import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase/supabase';
import { ProfilesService } from '../services/profiles/profiles.service';

export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const profiles = inject(ProfilesService);
  const router = inject(Router);

  const user = await supabase.getCurrentUser();
  if (!user) return router.createUrlTree(['/login']);

  const profile = await profiles.getMyProfile(user.id);
  if (profile?.role === 'super_admin') return true;

  return router.createUrlTree(['/dashboard']);
};
