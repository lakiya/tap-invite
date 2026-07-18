// src/app/features/admin/components/event-grid.component.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminEvent, AdminGuest, EventStatus } from '../admin.types';
import { AdminService } from '../admin.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { EventEditModalComponent } from './event-edit-modal.component';

@Component({
  selector: 'app-event-grid',
  standalone: true,
  imports: [FormsModule, EventEditModalComponent],
  template: `
    <section class="grid-section">
      <h2 class="section-title">All Events</h2>

      <div class="filters">
        <input
          type="text"
          class="admin-input search-input"
          placeholder="Search by host email, title, or event ID…"
          [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
        />
        <select class="admin-input status-select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
          <option value="">All Statuses</option>
          <option value="Upcoming">Upcoming</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Passed">Passed</option>
          <option value="Disabled">Disabled</option>
        </select>
      </div>

      @if (isLoading()) {
        <p class="hint-text">Loading events…</p>
      } @else if (filteredEvents().length === 0) {
        <p class="hint-text">No events match your search.</p>
      } @else {
        <div class="table-wrap">
          <table class="events-table">
            <thead>
              <tr>
                <th>Host Email</th>
                <th>Event Title</th>
                <th>Date</th>
                <th>Status</th>
                <th>Enabled</th>
                <th>Premium</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (event of filteredEvents(); track event.id) {
                <tr>
                  <td class="cell-muted">{{ event.hostEmail }}</td>
                  <td>{{ event.title }}</td>
                  <td class="cell-muted">{{ event.event_date }}</td>
                  <td>
                    <span class="badge" [class]="'badge--' + event.computedStatus.toLowerCase()">
                      {{ event.computedStatus }}
                    </span>
                  </td>
                  <td>
                    <button
                      class="toggle-pill"
                      [class.toggle-pill--on]="event.is_enabled"
                      (click)="toggleEnabled(event)"
                    >{{ event.is_enabled ? 'ON' : 'OFF' }}</button>
                  </td>
                  <td>
                    <button
                      class="toggle-pill"
                      [class.toggle-pill--on]="event.is_premium"
                      (click)="togglePremium(event)"
                    >{{ event.is_premium ? 'ON' : 'OFF' }}</button>
                  </td>
                  <td class="actions-cell">
                    <button class="btn-edit" (click)="openEdit(event)">✏️ Edit</button>
                    <button class="btn-delete" (click)="confirmDelete(event)">🗑 Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    @if (editingEvent()) {
      <app-event-edit-modal
        [event]="editingEvent()!"
        [guests]="editingGuests()"
        (close)="editingEvent.set(null)"
        (saved)="onEventSaved()"
      />
    }

    @if (deletingEvent()) {
      <div class="modal-backdrop" (click)="deletingEvent.set(null)">
        <div class="confirm-box" role="dialog" (click)="$event.stopPropagation()">
          <h3>Delete Event?</h3>
          <p>Permanently delete <strong>{{ deletingEvent()!.title }}</strong> and all its guests and RSVPs? This cannot be undone.</p>
          <div class="confirm-actions">
            <button class="btn-cancel" (click)="deletingEvent.set(null)">Cancel</button>
            <button class="btn-delete-confirm" (click)="executeDelete()">Delete</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .grid-section { background:#1e293b; border-radius:12px; padding:24px; }
    .section-title { color:#f1f5f9; font-size:1rem; font-weight:700; margin:0 0 16px; }
    .filters { display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
    .admin-input { background:#0f172a; border:1px solid #334155; border-radius:6px; padding:8px 12px; color:#f1f5f9; font-size:0.875rem; }
    .admin-input:focus { outline:none; border-color:#7c3aed; }
    .search-input { flex:1; min-width:200px; }
    .status-select { width:160px; }
    .hint-text { color:#64748b; font-size:0.875rem; }
    .table-wrap { overflow-x:auto; }
    .events-table { width:100%; border-collapse:collapse; font-size:0.8125rem; }
    .events-table th { text-align:left; padding:8px 12px; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #334155; white-space:nowrap; }
    .events-table td { padding:10px 12px; border-bottom:1px solid #263348; color:#e2e8f0; vertical-align:middle; }
    .events-table tr:hover td { background:#263348; }
    .cell-muted { color:#94a3b8; }
    .badge { padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; white-space:nowrap; }
    .badge--upcoming { background:#dcfce7; color:#16a34a; }
    .badge--ongoing  { background:#fef9c3; color:#854d0e; }
    .badge--passed   { background:#f1f5f9; color:#64748b; }
    .badge--disabled { background:#fee2e2; color:#dc2626; }
    .toggle-pill { padding:3px 14px; border-radius:20px; border:none; cursor:pointer; font-size:0.75rem; font-weight:700; background:#475569; color:#94a3b8; transition:background 0.15s; }
    .toggle-pill--on { background:#7c3aed; color:white; }
    .actions-cell { display:flex; gap:8px; }
    .btn-edit { background:#334155; color:#e2e8f0; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.75rem; }
    .btn-delete { background:#450a0a; color:#fca5a5; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.75rem; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:100; padding:16px; }
    .confirm-box { background:#1e293b; border:1px solid #ef4444; border-radius:12px; padding:28px; max-width:400px; width:100%; }
    .confirm-box h3 { color:#f1f5f9; margin:0 0 10px; }
    .confirm-box p { color:#94a3b8; font-size:0.875rem; line-height:1.5; margin:0 0 20px; }
    .confirm-actions { display:flex; justify-content:flex-end; gap:10px; }
    .btn-cancel { background:#334155; color:#94a3b8; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; font-size:0.875rem; }
    .btn-delete-confirm { background:#dc2626; color:white; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; font-size:0.875rem; font-weight:600; }
  `]
})
export class EventGridComponent implements OnInit {
  private adminService = inject(AdminService);
  private toast = inject(ToastService);

  allEvents = signal<AdminEvent[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');
  statusFilter = signal<EventStatus | ''>('');
  editingEvent = signal<AdminEvent | null>(null);
  editingGuests = signal<AdminGuest[]>([]);
  deletingEvent = signal<AdminEvent | null>(null);

  filteredEvents = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const s = this.statusFilter();
    return this.allEvents().filter(e => {
      const matchesSearch = !q ||
        e.hostEmail.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q);
      const matchesStatus = !s || e.computedStatus === s;
      return matchesSearch && matchesStatus;
    });
  });

  async ngOnInit() {
    await this.loadEvents();
  }

  async loadEvents() {
    try {
      this.isLoading.set(true);
      this.allEvents.set(await this.adminService.getAllEvents());
    } catch {
      this.toast.error('Failed to load events.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleEnabled(event: AdminEvent) {
    const newValue = !event.is_enabled;
    this.allEvents.update(events =>
      events.map(e => e.id === event.id
        ? { ...e, is_enabled: newValue, computedStatus: this.adminService.computeStatus({ ...e, is_enabled: newValue }) }
        : e
      )
    );
    try {
      await this.adminService.toggleEventEnabled(event.id, newValue);
    } catch {
      this.allEvents.update(events =>
        events.map(e => e.id === event.id
          ? { ...e, is_enabled: event.is_enabled, computedStatus: this.adminService.computeStatus(event) }
          : e
        )
      );
      this.toast.error('Failed to update event status.');
    }
  }

  async togglePremium(event: AdminEvent) {
    const newValue = !event.is_premium;
    this.allEvents.update(events =>
      events.map(e => e.id === event.id
        ? { ...e, is_premium: newValue }
        : e
      )
    );
    try {
      await this.adminService.togglePremium(event.id, newValue);
    } catch {
      this.allEvents.update(events =>
        events.map(e => e.id === event.id
          ? { ...e, is_premium: event.is_premium }
          : e
        )
      );
      this.toast.error('Failed to update premium status.');
    }
  }

  async openEdit(event: AdminEvent) {
    try {
      const guests = await this.adminService.getGuestsForEvent(event.id);
      this.editingGuests.set(guests);
      this.editingEvent.set(event);
    } catch {
      this.toast.error('Failed to load guests for this event.');
    }
  }

  onEventSaved() {
    this.editingEvent.set(null);
    this.loadEvents();
  }

  confirmDelete(event: AdminEvent) {
    this.deletingEvent.set(event);
  }

  async executeDelete() {
    const event = this.deletingEvent();
    if (!event) return;
    this.deletingEvent.set(null);
    try {
      await this.adminService.deleteEvent(event.id);
      this.allEvents.update(events => events.filter(e => e.id !== event.id));
      this.toast.success(`"${event.title}" deleted.`);
    } catch {
      this.toast.error('Failed to delete event.');
    }
  }
}
