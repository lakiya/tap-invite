import { Component, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/services/supabase/supabase';
import { ToastService } from '../../../core/services/toast/toast.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { EventFormComponent } from './event-form/event-form.component';
import { AddGuestFormComponent } from './add-guest-form/add-guest-form.component';
import { GuestTableComponent } from './guest-table/guest-table.component';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    EventFormComponent,
    AddGuestFormComponent,
    GuestTableComponent
  ],
  templateUrl: './host-dashboard.component.html',
  styleUrls: ['./host-dashboard.component.css']
})
export class HostDashboardComponent implements OnInit, OnDestroy {
  private supabase    = inject(Supabase);
  private router      = inject(Router);
  private toastService = inject(ToastService);
  private platformId  = inject(PLATFORM_ID);

  userId      = signal<string | null>(null);
  isLoading   = signal(true);
  activeEvent = signal<any>(null);
  guests      = signal<any[]>([]);

  private realtimeChannel: ReturnType<typeof this.supabase.client.channel> | null = null;

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.userId.set(user.id);
    await this.fetchDashboardData(user.id);
  }

  async fetchDashboardData(userId: string) {
    try {
      const events = await this.supabase.getEventByHost(userId);
      if (events?.length) {
        this.activeEvent.set(events[0]);
        await this.loadGuests(events[0].id);
        this.subscribeToRsvpUpdates(events[0].id);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  subscribeToRsvpUpdates(eventId: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.realtimeChannel = this.supabase.client
      .channel(`rsvps-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rsvps' },
        (payload) => {
          // Only reload if the changed RSVP belongs to a guest in this event
          const changedGuestId =
            (payload.new as { guest_id?: string })?.guest_id ??
            (payload.old as { guest_id?: string })?.guest_id;
          if (changedGuestId && this.guests().some(g => g.id === changedGuestId)) {
            this.loadGuests(eventId);
          }
        }
      )
      .subscribe();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
  }

  async loadGuests(eventId: string) {
    const list = await this.supabase.getGuests(eventId);
    this.guests.set(list || []);
  }

  handleEventCreated(event: any) {
    this.activeEvent.set(event);
  }

  async handleGuestAdded() {
    await this.loadGuests(this.activeEvent().id);
    this.showToast('Guest added successfully!');
  }

  async handleGuestDeleted() {
    await this.loadGuests(this.activeEvent().id);
    this.showToast('Guest deleted successfully!');
  }

  async copyLink(guestId: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `${window.location.origin}/w/${this.activeEvent().id}/${guestId}`;
    try {
      await navigator.clipboard.writeText(url);
      this.showToast('Invitation link copied!');
    } catch {
      this.showToast('Could not copy — please copy the link manually.', 'error');
    }
  }

  async sendEmailInvitation(guestId: string) {
    try {
      await this.supabase.sendEmailInvitation(guestId);
      this.showToast('Invitation email sent!');
    } catch {
      this.showToast('Failed to send email. The email service may not be set up yet.', 'error');
    }
  }

  async handleLogout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }

  showToast(message: string, type: 'success' | 'error' = 'success') {
    if (type === 'success') {
      this.toastService.success(message);
    } else {
      this.toastService.error(message);
    }
  }
}
