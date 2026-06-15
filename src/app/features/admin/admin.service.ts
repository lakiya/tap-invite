// src/app/features/admin/admin.service.ts
import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Supabase } from '../../core/services/supabase/supabase';
import { AdminEvent, AdminGuest, AdminProfile, EventEditFields, EventStatus } from './admin.types';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private supabase = inject(Supabase);
  private document = inject(DOCUMENT);

  async getAllEvents(): Promise<AdminEvent[]> {
    const [eventsRes, profilesRes] = await Promise.all([
      this.supabase.client.from('events').select('*').order('created_at', { ascending: false }),
      this.supabase.client.from('profiles').select('id, email')
    ]);
    if (eventsRes.error) throw eventsRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const profileMap = new Map<string, string>(
      (profilesRes.data ?? []).map((p: { id: string; email: string }) => [p.id, p.email])
    );

    return (eventsRes.data ?? []).map((event: {
      host_id: string; is_enabled: boolean; event_date: string; [key: string]: unknown
    }) => ({
      ...event,
      hostEmail: profileMap.get(event.host_id) ?? 'Unknown',
      computedStatus: this.computeStatus(event)
    })) as AdminEvent[];
  }

  async getAllProfiles(): Promise<AdminProfile[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AdminProfile[];
  }

  async getGuestsForEvent(eventId: string): Promise<AdminGuest[]> {
    const { data, error } = await this.supabase.client
      .from('guests')
      .select('id, event_id, display_name, phone_number, email')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AdminGuest[];
  }

  async toggleEventEnabled(id: string, is_enabled: boolean): Promise<void> {
    const { error } = await this.supabase.client
      .from('events').update({ is_enabled }).eq('id', id);
    if (error) throw error;
  }

  async updateEvent(id: string, fields: EventEditFields): Promise<void> {
    const { error } = await this.supabase.client
      .from('events').update(fields).eq('id', id);
    if (error) throw error;
  }

  async updateGuestName(guestId: string, display_name: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('guests').update({ display_name }).eq('id', guestId);
    if (error) throw error;
  }

  async deleteEvent(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('events').delete().eq('id', id);
    if (error) throw error;
  }

  async sendManualMagicLink(email: string): Promise<void> {
    const redirectTo = `${this.document.location.origin}/auth/callback`;
    const { error } = await this.supabase.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) throw error;
  }

  computeStatus(event: { is_enabled: boolean; event_date: string }): EventStatus {
    if (!event.is_enabled) return 'Disabled';
    const today = new Date().toISOString().split('T')[0];
    const eventDay = event.event_date.split('T')[0];
    if (eventDay > today) return 'Upcoming';
    if (eventDay === today) return 'Ongoing';
    return 'Passed';
  }
}
