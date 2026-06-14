import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Supabase } from '../../../core/services/supabase/supabase';
import { RsvpButtonsComponent, RsvpStatus } from './rsvp-buttons/rsvp-buttons.component';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

interface EventData {
  id: string;
  title: string;
  event_date: string;
  location_text: string;
  google_maps_url?: string;
}

interface GuestData {
  id: string;
  display_name: string;
}

@Component({
  selector: 'app-guest-view',
  standalone: true,
  imports: [CommonModule, RouterModule, LottieComponent, RsvpButtonsComponent],
  templateUrl: './guest-view.component.html',
  styleUrls: ['./guest-view.component.css']
})
export class GuestViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private supabase = inject(Supabase);

  eventId   = signal<string | null>(null);
  guestId   = signal<string | null>(null);
  eventData = signal<EventData | null>(null);
  guestData = signal<GuestData | null>(null);
  rsvpStatus = signal<RsvpStatus>('Pending');
  isLoading  = signal(true);
  hasError   = signal(false);
  rsvpError  = signal<string | null>(null);

  lottieOptions: AnimationOptions = {
    path: 'assets/animations/celebration4.json',
    loop: true,
    autoplay: true
  };

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
        this.supabase.client.from('guests').select('*').eq('id', this.guestId()).single(),
        this.supabase.client.from('rsvps').select('*').eq('guest_id', this.guestId()).single()
      ]);
      if (eventRes.error || guestRes.error) throw new Error('Invitation not found');
      this.eventData.set(eventRes.data);
      this.guestData.set(guestRes.data);
      if (rsvpRes.data?.status) this.rsvpStatus.set(rsvpRes.data.status as RsvpStatus);
    } catch (error) {
      console.error(error);
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleRsvpChange(status: RsvpStatus) {
    if (status === 'Pending') { this.rsvpStatus.set('Pending'); return; }
    const guestId = this.guestId();
    if (!guestId) return;
    this.rsvpError.set(null);
    try {
      await this.supabase.updateRsvpStatus(guestId, status);
      this.rsvpStatus.set(status);
    } catch (error) {
      console.error(error);
      this.rsvpError.set('Failed to save your response. Please try again.');
    }
  }
}
