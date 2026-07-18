import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Supabase } from '../../../core/services/supabase/supabase';
import { RsvpStatus } from './rsvp-buttons/rsvp-buttons.component';
import { EventData, GuestData, TemplateContext } from '../../templates/template.types';
import { TemplateRendererComponent } from '../../templates/components/template-renderer/template-renderer.component';
import { PhotoTabComponent } from './photo-tab/photo-tab.component';

@Component({
  selector: 'app-guest-view',
  standalone: true,
  imports: [CommonModule, RouterModule, TemplateRendererComponent, PhotoTabComponent],
  templateUrl: './guest-view.component.html',
  styleUrls: ['./guest-view.component.css']
})
export class GuestViewComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private supabase = inject(Supabase);

  eventId    = signal<string | null>(null);
  guestId    = signal<string | null>(null);
  eventData  = signal<EventData | null>(null);
  guestData  = signal<GuestData | null>(null);
  rsvpStatus = signal<RsvpStatus>('Pending');
  isLoading  = signal(true);
  hasError   = signal(false);
  isDisabled = signal(false);
  isPast     = signal(false);
  rsvpError  = signal<string | null>(null);

  templateContext = computed<TemplateContext | null>(() => {
    const event = this.eventData();
    const guest = this.guestData();
    if (!event || !guest) return null;
    return {
      event,
      guest,
      rsvpStatus: this.rsvpStatus(),
      rsvpError:  this.rsvpError(),
      onRsvpChange: (status: RsvpStatus) => this.handleRsvpChange(status),
    };
  });

  ngOnInit() {
    this.eventId.set(this.route.snapshot.paramMap.get('eventId'));
    this.guestId.set(this.route.snapshot.paramMap.get('guestId'));
    if (this.eventId() && this.guestId()) {
      this.loadInvitationData();
    } else {
      this.hasError.set(true);
      this.isLoading.set(false);
    }
  }

  async loadInvitationData() {
    try {
      this.isLoading.set(true);
      const [eventRes, guestRes, rsvpRes] = await Promise.all([
        this.supabase.client.from('events').select('*').eq('id', this.eventId()).single(),
        this.supabase.client.from('guests').select('*')
          .eq('id', this.guestId())
          .eq('event_id', this.eventId())  // prevent cross-event data access
          .single(),
        this.supabase.client.from('rsvps').select('*').eq('guest_id', this.guestId()).maybeSingle()
      ]);
      if (eventRes.error || guestRes.error) throw new Error('Invitation not found');
      this.eventData.set(eventRes.data as EventData);
      this.isDisabled.set((eventRes.data as any).is_enabled === false);

      // Block RSVPs for past events
      const eventDay = (eventRes.data as any).event_date?.split('T')[0] ?? '';
      const today    = new Date().toISOString().split('T')[0];
      this.isPast.set(!!eventDay && eventDay < today);

      this.guestData.set(guestRes.data as GuestData);
      if (!rsvpRes.error && rsvpRes.data?.status) {
        this.rsvpStatus.set(rsvpRes.data.status as RsvpStatus);
      }
    } catch {
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleRsvpChange(status: RsvpStatus) {
    if (this.isPast()) {
      this.rsvpError.set('This event has already passed.');
      return;
    }
    if (status === 'Pending') { this.rsvpStatus.set('Pending'); return; }
    const guestId = this.guestId();
    if (!guestId) return;
    this.rsvpError.set(null);
    try {
      await this.supabase.updateRsvpStatus(guestId, status);
      this.rsvpStatus.set(status);
    } catch {
      this.rsvpError.set('Failed to save your response. Please try again.');
    }
  }
}
