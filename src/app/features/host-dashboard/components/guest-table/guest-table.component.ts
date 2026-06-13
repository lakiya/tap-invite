import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-guest-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guest-table.component.html',
  styleUrls: ['./guest-table.component.css']
})
export class GuestTableComponent {
  @Input() guests: any[] = [];
  @Output() copyLink  = new EventEmitter<string>();
  @Output() sendEmail = new EventEmitter<string>();

  sendingId = signal<string | null>(null);

  onSendEmail(guestId: string) {
    this.sendingId.set(guestId);
    this.sendEmail.emit(guestId);
    setTimeout(() => {
      if (this.sendingId() === guestId) this.sendingId.set(null);
    }, 4000);
  }

  getStatus(guest: any): string {
    return guest.rsvps?.status || 'Pending';
  }
}
