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
  @Output() copyLink     = new EventEmitter<string>();
  @Output() guestDeleted = new EventEmitter<void>();

  searchTerm = signal('');
  sendingIds = signal<Set<string>>(new Set());

  private supabase = inject(Supabase);
  private toast    = inject(ToastService);

  get guestsWithEmail() {
    return this.guests.filter(g => g.email);
  }

  get hasAnyEmail() {
    return this.guestsWithEmail.length > 0;
  }

  getStatus(guest: any): string {
    return guest.rsvps?.[0]?.status || 'Pending';
  }

  isSending(guestId: string): boolean {
    return this.sendingIds().has(guestId);
  }

  async onSendEmail(guestId: string) {
    this.sendingIds.update(s => new Set([...s, guestId]));
    try {
      await this.supabase.sendEmailInvitation(guestId);
      this.toast.success('Invitation sent!');
    } catch {
      this.toast.error('Failed to send invitation. Please try again.');
    } finally {
      this.sendingIds.update(s => { const n = new Set(s); n.delete(guestId); return n; });
    }
  }

  async handleSendAll() {
    const withEmail = this.guestsWithEmail;
    const results = await Promise.allSettled(
      withEmail.map(async g => {
        this.sendingIds.update(s => new Set([...s, g.id]));
        try {
          await this.supabase.sendEmailInvitation(g.id);
        } finally {
          this.sendingIds.update(s => { const n = new Set(s); n.delete(g.id); return n; });
        }
      })
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed === 0) {
      this.toast.success(`All ${withEmail.length} invitation${withEmail.length === 1 ? '' : 's'} sent!`);
    } else {
      this.toast.error(`${failed} invitation(s) failed to send.`);
    }
  }

  async onDelete(guestId: string) {
    const ok = await this.toast.confirm('Delete this guest?');
    if (!ok) return;
    try {
      await this.supabase.deleteGuest(guestId);
      this.guestDeleted.emit();
    } catch {
      this.toast.error('Failed to delete guest. Please try again.');
    }
  }
}
