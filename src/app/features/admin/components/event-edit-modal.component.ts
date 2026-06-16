// src/app/features/admin/components/event-edit-modal.component.ts
import { Component, EventEmitter, Input, OnInit, Output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminEvent, AdminGuest, EventEditFields } from '../admin.types';
import { AdminService } from '../admin.service';
import { ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-event-edit-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-box" role="dialog">
        <h2 class="modal-title">Edit Event</h2>

        <div class="form-group">
          <label>Title</label>
          <input type="text" [(ngModel)]="editTitle" class="admin-input" />
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" [(ngModel)]="editDate" class="admin-input" />
        </div>
        <div class="form-group">
          <label>Venue</label>
          <input type="text" [(ngModel)]="editVenue" class="admin-input" />
        </div>
        <div class="form-group">
          <label>Google Maps URL</label>
          <input type="url" [(ngModel)]="editMapsUrl" class="admin-input" />
        </div>

        @if (guests.length > 0) {
          <div class="form-group">
            <label>Guest Names</label>
            @for (guest of guests; track guest.id) {
              <div class="guest-row">
                <input type="text" [(ngModel)]="guestEdits[guest.id]" class="admin-input guest-input" />
              </div>
            }
          </div>
        }

        <div class="modal-actions">
          <button class="btn-cancel" (click)="close.emit()">Cancel</button>
          <button class="btn-save" (click)="onSave()">Save Changes</button>
        </div>
      </div>
    </div>

    @if (showVerify()) {
      <div class="modal-backdrop verify-backdrop">
        <div class="verify-box" role="dialog">
          <div class="verify-icon">⚠️</div>
          <h3>Confirm Edit</h3>
          <p>Warning: You are editing an old or active event. Type <strong>VERIFY</strong> to confirm these changes.</p>
          <input
            type="text"
            [(ngModel)]="verifyInput"
            class="admin-input verify-input"
            placeholder="Type VERIFY..."
          />
          <div class="verify-actions">
            <button class="btn-cancel" (click)="showVerify.set(false); verifyInput = ''">Cancel</button>
            <button
              class="btn-save"
              [disabled]="verifyInput !== 'VERIFY'"
              [class.btn-disabled]="verifyInput !== 'VERIFY'"
              (click)="confirmSave()"
            >Save Changes</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:100; padding:16px; }
    .verify-backdrop { z-index:200; }
    .modal-box { background:#1e293b; border:1px solid #334155; border-radius:12px; padding:28px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; }
    .modal-title { color:#f1f5f9; font-size:1.1rem; font-weight:700; margin:0 0 20px; }
    .form-group { margin-bottom:14px; }
    label { display:block; font-size:0.75rem; color:#94a3b8; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em; }
    .admin-input { width:100%; background:#0f172a; border:1px solid #334155; border-radius:6px; padding:8px 12px; color:#f1f5f9; font-size:0.875rem; box-sizing:border-box; }
    .admin-input:focus { outline:none; border-color:#7c3aed; }
    .guest-row { margin-bottom:6px; }
    .modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
    .btn-cancel { background:#334155; color:#94a3b8; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; font-size:0.875rem; }
    .btn-save { background:#7c3aed; color:white; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; font-size:0.875rem; font-weight:600; }
    .btn-disabled { background:#475569 !important; cursor:not-allowed !important; }
    .verify-box { background:#1e293b; border:1px solid #7c3aed; border-radius:12px; padding:28px; width:100%; max-width:380px; text-align:center; }
    .verify-icon { font-size:2rem; margin-bottom:12px; }
    .verify-box h3 { color:#f1f5f9; margin:0 0 8px; }
    .verify-box p { color:#94a3b8; font-size:0.875rem; margin:0 0 16px; line-height:1.5; }
    .verify-input { text-align:center; margin-bottom:16px; }
    .verify-actions { display:flex; justify-content:center; gap:10px; }
  `]
})
export class EventEditModalComponent implements OnInit {
  @Input({ required: true }) event!: AdminEvent;
  @Input() guests: AdminGuest[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private adminService = inject(AdminService);
  private toast = inject(ToastService);

  editTitle = '';
  editDate = '';
  editVenue = '';
  editMapsUrl = '';
  guestEdits: Record<string, string> = {};
  showVerify = signal(false);
  verifyInput = '';

  ngOnInit() {
    this.editTitle = this.event.title;
    this.editDate = this.event.event_date?.split('T')[0] ?? '';
    this.editVenue = this.event.location_text;
    this.editMapsUrl = this.event.google_maps_url ?? '';
    this.guests.forEach(g => { this.guestEdits[g.id] = g.display_name; });
  }

  onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }

  onSave() {
    this.showVerify.set(true);
  }

  async confirmSave() {
    if (this.verifyInput !== 'VERIFY') return;
    this.showVerify.set(false);
    this.verifyInput = '';
    try {
      const fields: EventEditFields = {
        title: this.editTitle,
        event_date: this.editDate,
        location_text: this.editVenue,
        google_maps_url: this.editMapsUrl || null,
      };
      await this.adminService.updateEvent(this.event.id, fields);

      const guestUpdates = this.guests
        .filter(g => this.guestEdits[g.id] !== g.display_name)
        .map(g => this.adminService.updateGuestName(g.id, this.guestEdits[g.id]));
      await Promise.all(guestUpdates);

      this.toast.success('Event updated successfully');
      this.saved.emit();
    } catch {
      this.toast.error('Failed to save changes. Please try again.');
    }
  }
}
