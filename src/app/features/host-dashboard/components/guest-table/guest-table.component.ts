import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Supabase } from '../../../../core/services/supabase/supabase';
import { ToastService } from '../../../../core/services/toast/toast.service';

@Component({
  selector: 'app-guest-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guest-table.component.html',
  styleUrls: ['./guest-table.component.css']
})
export class GuestTableComponent {
  @Input() guests: any[] = [];
  @Output() copyLink    = new EventEmitter<string>();
  @Output() guestDeleted = new EventEmitter<void>();

  searchTerm = signal('');
  private supabase = inject(Supabase);
  private toast    = inject(ToastService);

  sendingId      = signal<string | null>(null);
  totalGuests    = signal(0);
  totalAttending = signal(0);
  totalPending   = signal(0);
  totalDeclined  = signal(0);

  ngOnChanges() {
    this.totalGuests.set(this.guests.length);
    this.totalAttending.set(this.guests.filter(g => g.rsvps?.status === 'Accepted').length);
    this.totalPending.set(this.guests.filter(g => g.rsvps?.status === 'Tentative').length);
    this.totalDeclined.set(this.guests.filter(g => g.rsvps?.status === 'Declined').length);
  }

  async onSendEmail(guestId: string) {
    this.sendingId.set(guestId);
    try {
      await this.supabase.sendEmailInvitation(guestId);
      this.toast.success('Invitation email sent!');
    } catch {
      this.toast.error('Failed to send email. The email service may not be set up yet.');
    } finally {
      this.sendingId.set(null);
    }
  }

  getStatus(guest: any): string {
    return guest.rsvps?.status || 'Pending';
  }

  async onDelete(guestId: string) {
    const ok = await this.toast.confirm('Delete this guest?');
    if (!ok) return;
    try {
      await this.supabase.deleteGuest(guestId);
      this.guestDeleted.emit();
    } catch (err) {
      console.error('Error deleting guest:', err);
      this.toast.error('Failed to delete guest. Please try again.');
    }
  }
}
