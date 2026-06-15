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
    const role = (data as { role: string } | null)?.role;
    if (role !== 'user' && role !== 'super_admin') return null;
    return { role };
  }
}
