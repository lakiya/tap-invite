import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/services/supabase/supabase';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ToastComponent, Toast } from '../../../shared/components/toast/toast.component';
import { EventFormComponent } from './event-form/event-form.component';
import { AddGuestFormComponent } from './add-guest-form/add-guest-form.component';
import { GuestTableComponent } from './guest-table/guest-table.component';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    ToastComponent,
    EventFormComponent,
    AddGuestFormComponent,
    GuestTableComponent
  ],
  templateUrl: './host-dashboard.component.html',
  styleUrls: ['./host-dashboard.component.css']
})
export class HostDashboardComponent implements OnInit {
  private supabase = inject(Supabase);
  private router   = inject(Router);

  userId      = signal<string | null>(null);
  isLoading   = signal(true);
  activeEvent = signal<any>(null);
  guests      = signal<any[]>([]);
  toasts      = signal<Toast[]>([]);

  private toastCounter = 0;

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
      }
    } finally {
      this.isLoading.set(false);
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

  copyLink(guestId: string) {
    const url = `${window.location.origin}/w/${this.activeEvent().id}/${guestId}`;
    navigator.clipboard.writeText(url);
    this.showToast('Invitation link copied!');
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
    const id = ++this.toastCounter;
    this.toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.toasts.update(t => t.filter(x => x.id !== id)), 3000);
  }
}
