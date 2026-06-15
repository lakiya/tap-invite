import { inject, Injectable } from '@angular/core';
import { Supabase } from '../supabase/supabase';

@Injectable({ providedIn: 'root' })
export class ProfilesService {
  private supabase = inject(Supabase);

  async getMyProfile(userId: string): Promise<{ role: 'user' | 'super_admin' } | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data as { role: 'user' | 'super_admin' };
  }
}
