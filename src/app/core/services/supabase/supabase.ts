import { inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_ENV } from '../../tokens/app-env';

@Injectable({ providedIn: 'root' })
export class Supabase {
  private supabase: SupabaseClient;

  constructor() {
    const env = inject(APP_ENV);
    this.supabase = createClient(env.supabaseUrl, env.supabaseKey);
  }

  get client() {
    return this.supabase;
  }

  async getEventDetails(eventId: string) {
    const { data, error } = await this.supabase
      .from('events').select('*').eq('id', eventId).single();
    if (error) throw error;
    return data;
  }

  async getEventByHost(hostId: string) {
    const { data, error } = await this.supabase
      .from('events').select('*').eq('host_id', hostId)
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    return data ?? [];
  }

  async updateRsvpStatus(guestId: string, status: string, dietary?: string, count: number = 1) {
    const { data, error } = await this.supabase
      .from('rsvps')
      .upsert(
        { guest_id: guestId, status, dietary_preference: dietary, attending_count: count, updated_at: new Date().toISOString() },
        { onConflict: 'guest_id' }
      );
    if (error) throw error;
    return data;
  }

  async signInWithMagicLink(email: string, redirectTo: string) {
    const { data, error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) throw error;
    return data;
  }

  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) return null;
    return user;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async createEvent(hostId: string, title: string, date: string, location: string) {
    const { data, error } = await this.supabase
      .from('events')
      .insert([{ host_id: hostId, title, event_date: date, location_text: location }])
      .select().single();
    if (error) throw error;
    return data;
  }

  async getGuests(eventId: string) {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*, rsvps(status)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async addGuest(eventId: string, displayName: string, phoneNumber?: string, email?: string) {
    const { data, error } = await this.supabase
      .from('guests')
      .insert([{
        event_id: eventId,
        display_name: displayName,
        phone_number: phoneNumber || null,
        email: email || null
      }])
      .select().single();
    if (error) throw error;
    return data;
  }

  async deleteGuest(guestId: string) {
    const { error } = await this.supabase
      .from('guests')
      .delete()
      .eq('id', guestId);
    if (error) throw error;
  }

  async sendEmailInvitation(guestId: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('send-invite-email', {
      body: { guestId }
    });
    if (error) throw error;
  }
}
