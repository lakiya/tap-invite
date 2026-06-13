import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Supabase {
    private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }
  
  get client() {
    return this.supabase;
  }

  
  async getEventDetails(eventId: string) {
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) throw error;
    return data;
  }

  
  async updateRsvpStatus(guestId: string, status: string, dietary?: string, count: number = 1) {
    const { data, error } = await this.supabase
      .from('rsvps')
      .update({ 
        status: status, 
        dietary_preference: dietary, 
        attending_count: count,
        updated_at: new Date().toISOString()
      })
      .eq('guest_id', guestId);

    if (error) throw error;
    return data;
  }
}