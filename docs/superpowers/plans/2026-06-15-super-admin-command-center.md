# Super Admin Command Center — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/admin` route with a dark-themed event management grid, edit modal with VERIFY guard, and manual magic link dispatcher — accessible only by `super_admin` role.

**Architecture:** New `src/app/features/admin/` feature folder with its own `AdminService` and 4 components. A new `ProfilesService` + `adminGuard` in core handle role-checking. Auth callback updated to route `super_admin` → `/admin`. All reads/writes enforced at Supabase RLS level.

**Tech Stack:** Angular 22 (standalone components, signals), @supabase/supabase-js 2.108.1

---

## File Map

**Create:**
- `src/app/core/services/profiles/profiles.service.ts`
- `src/app/core/guards/admin.guard.ts`
- `src/app/features/admin/admin.types.ts`
- `src/app/features/admin/admin.service.ts`
- `src/app/features/admin/components/event-edit-modal.component.ts`
- `src/app/features/admin/components/magic-link-panel.component.ts`
- `src/app/features/admin/components/event-grid.component.ts`
- `src/app/features/admin/admin-dashboard.component.ts`

**Modify:**
- `src/app/app.routes.ts`
- `src/app/features/auth/auth-callback.component.ts`
- `src/app/features/guest-view/components/guest-view.component.ts`
- `src/app/features/guest-view/components/guest-view.component.html`

**Task order note:** Components are created before routes reference them so every build step passes. Shell (Task 9) → routes registration (Task 10) → auth callback (Task 11) → guest view (Task 12).

---

### Task 1: Supabase Schema Setup (manual SQL)

**Note:** All steps run in the Supabase SQL editor — not via code.

- [ ] **Step 1: Create the `user_role` enum and `profiles` table**

```sql
CREATE TYPE user_role AS ENUM ('user', 'super_admin');

CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       user_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Create the auto-insert trigger**

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] **Step 3: Add `is_enabled` to events**

```sql
ALTER TABLE public.events
  ADD COLUMN is_enabled boolean NOT NULL DEFAULT true;
```

- [ ] **Step 4: Enable RLS and add super_admin policies**

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "user_select_own_profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Super admin can read all profiles
CREATE POLICY "super_admin_select_profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Super admin: full access to events
CREATE POLICY "super_admin_select_events"
  ON public.events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "super_admin_update_events"
  ON public.events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "super_admin_delete_events"
  ON public.events FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Super admin: read + update guests
CREATE POLICY "super_admin_select_guests"
  ON public.guests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "super_admin_update_guests"
  ON public.guests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );
```

- [ ] **Step 5: Bootstrap the super admin**

Run AFTER signing in at least once with your email so the trigger has created the profile row:

```sql
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = '<your-email>';

-- Verify
SELECT id, email, role FROM public.profiles WHERE role = 'super_admin';
-- Expected: one row with role = 'super_admin'
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-06-15-super-admin-command-center-design.md docs/superpowers/plans/2026-06-15-super-admin-command-center.md
git commit -m "chore: super admin schema applied in Supabase — profiles table, is_enabled, RLS policies"
```

---

### Task 2: Shared Admin Types

**Files:**
- Create: `src/app/features/admin/admin.types.ts`

- [ ] **Step 1: Create types file**

```typescript
// src/app/features/admin/admin.types.ts
export type EventStatus = 'Upcoming' | 'Ongoing' | 'Passed' | 'Disabled';

export interface AdminEvent {
  id: string;
  title: string;
  event_date: string;
  location_text: string;
  google_maps_url: string | null;
  is_enabled: boolean;
  host_id: string;
  created_at: string;
  hostEmail: string;
  computedStatus: EventStatus;
}

export interface AdminProfile {
  id: string;
  email: string;
  role: 'user' | 'super_admin';
  created_at: string;
}

export interface EventEditFields {
  title?: string;
  event_date?: string;
  location_text?: string;
  google_maps_url?: string | null;
}

export interface AdminGuest {
  id: string;
  event_id: string;
  display_name: string;
  phone_number: string | null;
  email: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/admin.types.ts
git commit -m "feat: add shared admin types"
```

---

### Task 3: ProfilesService

**Files:**
- Create: `src/app/core/services/profiles/profiles.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/app/core/services/profiles/profiles.service.ts
import { inject, Injectable } from '@angular/core';
import { Supabase } from '../supabase/supabase';

@Injectable({ providedIn: 'root' })
export class ProfilesService {
  private supabase = inject(Supabase);

  async getMyProfile(userId: string): Promise<{ role: 'user' | 'super_admin' } | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data as { role: 'user' | 'super_admin' };
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/profiles/profiles.service.ts
git commit -m "feat: add ProfilesService for role lookup"
```

---

### Task 4: adminGuard

**Files:**
- Create: `src/app/core/guards/admin.guard.ts`

- [ ] **Step 1: Create the guard**

```typescript
// src/app/core/guards/admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../services/supabase/supabase';
import { ProfilesService } from '../services/profiles/profiles.service';

export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(Supabase);
  const profiles = inject(ProfilesService);
  const router = inject(Router);

  const user = await supabase.getCurrentUser();
  if (!user) return router.createUrlTree(['/login']);

  const profile = await profiles.getMyProfile(user.id);
  if (profile?.role === 'super_admin') return true;

  return router.createUrlTree(['/dashboard']);
};
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/guards/admin.guard.ts
git commit -m "feat: add adminGuard — redirects non-super_admin to /dashboard"
```

---

### Task 5: AdminService

**Files:**
- Create: `src/app/features/admin/admin.service.ts`

- [ ] **Step 1: Create the service**

```typescript
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

    return (eventsRes.data ?? []).map((event: any) => ({
      ...event,
      hostEmail: profileMap.get(event.host_id) ?? 'Unknown',
      computedStatus: this.computeStatus(event)
    }));
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
    await this.supabase.signInWithMagicLink(email, redirectTo);
  }

  computeStatus(event: { is_enabled: boolean; event_date: string }): EventStatus {
    if (!event.is_enabled) return 'Disabled';
    const today = new Date().toISOString().split('T')[0];
    if (event.event_date > today) return 'Upcoming';
    if (event.event_date === today) return 'Ongoing';
    return 'Passed';
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/admin.service.ts
git commit -m "feat: add AdminService with all event/profile/guest/magic-link methods"
```

---

### Task 6: Event Edit Modal Component

**Files:**
- Create: `src/app/features/admin/components/event-edit-modal.component.ts`

- [ ] **Step 1: Create the component**

```typescript
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
          <p>You are editing an <strong>{{ event.computedStatus.toLowerCase() }}</strong> event.<br>Type <strong>VERIFY</strong> to confirm.</p>
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
    this.editDate = this.event.event_date;
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
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/components/event-edit-modal.component.ts
git commit -m "feat: add EventEditModal with VERIFY guard"
```

---

### Task 7: Magic Link Panel Component

**Files:**
- Create: `src/app/features/admin/components/magic-link-panel.component.ts`

- [ ] **Step 1: Create the component**

```typescript
// src/app/features/admin/components/magic-link-panel.component.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminProfile } from '../admin.types';
import { AdminService } from '../admin.service';
import { ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-magic-link-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel-section">
      <h2 class="section-title">✉️ Manual Magic Link Dispatcher</h2>
      <p class="section-sub">Search for a user and send them a fresh magic login link.</p>

      <div class="search-row">
        <input
          type="text"
          class="admin-input search-input"
          placeholder="Search user by email…"
          [(ngModel)]="searchQuery"
        />
      </div>

      @if (filteredProfiles().length > 0) {
        <ul class="profile-list">
          @for (profile of filteredProfiles(); track profile.id) {
            <li class="profile-item">
              <span class="profile-email">{{ profile.email }}</span>
              <button
                class="btn-send"
                [disabled]="sending() === profile.email"
                (click)="sendLink(profile)"
              >{{ sending() === profile.email ? 'Sending…' : 'Send Magic Email' }}</button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .panel-section { background:#1e293b; border-radius:12px; padding:24px; }
    .section-title { color:#f1f5f9; font-size:1rem; font-weight:700; margin:0 0 4px; }
    .section-sub { color:#64748b; font-size:0.8125rem; margin:0 0 16px; }
    .search-row { margin-bottom:12px; }
    .admin-input { background:#0f172a; border:1px solid #334155; border-radius:6px; padding:8px 12px; color:#f1f5f9; font-size:0.875rem; }
    .admin-input:focus { outline:none; border-color:#7c3aed; }
    .search-input { width:100%; max-width:460px; box-sizing:border-box; }
    .profile-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; max-width:560px; }
    .profile-item { display:flex; align-items:center; justify-content:space-between; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:10px 14px; }
    .profile-email { color:#e2e8f0; font-size:0.875rem; }
    .btn-send { background:#7c3aed; color:white; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.8125rem; font-weight:600; white-space:nowrap; }
    .btn-send:disabled { background:#475569; cursor:not-allowed; }
  `]
})
export class MagicLinkPanelComponent implements OnInit {
  private adminService = inject(AdminService);
  private toast = inject(ToastService);

  allProfiles = signal<AdminProfile[]>([]);
  searchQuery = '';
  sending = signal<string | null>(null);

  filteredProfiles = computed(() => {
    const q = this.searchQuery.toLowerCase();
    if (q.length < 2) return [];
    return this.allProfiles().filter(p => p.email.toLowerCase().includes(q)).slice(0, 8);
  });

  async ngOnInit() {
    try {
      this.allProfiles.set(await this.adminService.getAllProfiles());
    } catch {
      this.toast.error('Failed to load users.');
    }
  }

  async sendLink(profile: AdminProfile) {
    this.sending.set(profile.email);
    try {
      await this.adminService.sendManualMagicLink(profile.email);
      this.toast.success(`Magic link sent to ${profile.email}`);
      this.searchQuery = '';
    } catch {
      this.toast.error(`Failed to send link to ${profile.email}`);
    } finally {
      this.sending.set(null);
    }
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/components/magic-link-panel.component.ts
git commit -m "feat: add MagicLinkPanel for manual OTP dispatch"
```

---

### Task 8: Event Grid Component

**Files:**
- Create: `src/app/features/admin/components/event-grid.component.ts`

- [ ] **Step 1: Create the component**

```typescript
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
          [(ngModel)]="searchQuery"
        />
        <select class="admin-input status-select" [(ngModel)]="statusFilter">
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
  searchQuery = '';
  statusFilter = '';
  editingEvent = signal<AdminEvent | null>(null);
  editingGuests = signal<AdminGuest[]>([]);
  deletingEvent = signal<AdminEvent | null>(null);

  filteredEvents = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const s = this.statusFilter as EventStatus | '';
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
    try {
      await this.adminService.toggleEventEnabled(event.id, newValue);
      this.allEvents.update(events =>
        events.map(e => e.id === event.id
          ? { ...e, is_enabled: newValue, computedStatus: this.adminService.computeStatus({ ...e, is_enabled: newValue }) }
          : e
        )
      );
    } catch {
      this.toast.error('Failed to update event status.');
    }
  }

  async openEdit(event: AdminEvent) {
    const guests = await this.adminService.getGuestsForEvent(event.id);
    this.editingGuests.set(guests);
    this.editingEvent.set(event);
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
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/components/event-grid.component.ts
git commit -m "feat: add EventGrid with search, filter, toggle, edit, and delete"
```

---

### Task 9: Admin Dashboard Shell

**Files:**
- Create: `src/app/features/admin/admin-dashboard.component.ts`

- [ ] **Step 1: Create the shell**

```typescript
// src/app/features/admin/admin-dashboard.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';
import { EventGridComponent } from './components/event-grid.component';
import { MagicLinkPanelComponent } from './components/magic-link-panel.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [EventGridComponent, MagicLinkPanelComponent],
  template: `
    <div class="admin-shell">
      <nav class="admin-nav">
        <span class="admin-nav__brand">⚡ Admin Command Center</span>
        <button class="admin-nav__signout" (click)="signOut()">Sign Out</button>
      </nav>
      <main class="admin-main">
        <app-event-grid />
        <app-magic-link-panel />
      </main>
    </div>
  `,
  styles: [`
    .admin-shell { min-height:100vh; background:#0f172a; color:#f1f5f9; font-family:inherit; }
    .admin-nav { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; background:#1e293b; border-bottom:1px solid #334155; position:sticky; top:0; z-index:10; }
    .admin-nav__brand { font-weight:700; font-size:1rem; color:#a78bfa; }
    .admin-nav__signout { background:none; border:1px solid #475569; color:#94a3b8; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:0.8rem; transition:color 0.15s,border-color 0.15s; }
    .admin-nav__signout:hover { color:#f1f5f9; border-color:#94a3b8; }
    .admin-main { padding:24px; max-width:1400px; margin:0 auto; display:flex; flex-direction:column; gap:24px; }
  `]
})
export class AdminDashboardComponent {
  private supabase = inject(Supabase);
  private router = inject(Router);

  async signOut() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/admin-dashboard.component.ts
git commit -m "feat: add AdminDashboard shell with dark nav"
```

---

### Task 10: Register /admin Route

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Add the admin route**

Replace the entire file:

```typescript
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'w/:eventId/:guestId',
    loadComponent: () => import('./features/guest-view/components/guest-view.component').then(c => c.GuestViewComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/host-dashboard/components/host-dashboard.component').then(c => c.HostDashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-dashboard.component').then(c => c.AdminDashboardComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/auth-callback.component').then(c => c.AuthCallbackComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(c => c.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(c => c.LandingComponent)
  },
  {
    path: 'magic-link',
    loadComponent: () => import('./features/support/magic-link.component').then(c => c.MagicLinkComponent)
  },
  { path: '**', redirectTo: '' }
];
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: register /admin route with adminGuard"
```

---

### Task 11: Update Auth Callback for Role-Based Routing

**Files:**
- Modify: `src/app/features/auth/auth-callback.component.ts`

- [ ] **Step 1: Replace the component**

The key change: inject `ProfilesService` and replace the hardcoded `/dashboard` redirect with a `navigateByRole(userId)` helper that checks the profile role first. Remove the TODO redirect that short-circuits to `/dashboard`.

```typescript
// src/app/features/auth/auth-callback.component.ts
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';
import { ProfilesService } from '../../core/services/profiles/profiles.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [RouterModule],
  template: `
    <main class="callback-page">
      <div class="callback-card">
        <div class="logo-mark">T</div>
        @if (errorMessage()) {
          <h2 class="error-title">Link Expired</h2>
          <p class="error-sub">{{ errorMessage() }}</p>
          <a routerLink="/login" class="retry-btn">Request a new link</a>
        } @else {
          <div class="spinner"></div>
          <p class="loading-text">Signing you in…</p>
        }
      </div>
    </main>
  `,
  styles: [`
    .callback-page { display:flex; justify-content:center; align-items:center; min-height:100vh; background:var(--color-bg); padding:24px; }
    .callback-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:20px; padding:40px 36px; max-width:420px; width:100%; box-shadow:0 8px 40px rgba(0,0,0,0.08); text-align:center; }
    .logo-mark { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,var(--color-primary),var(--color-primary-dark)); color:white; font-size:1.3rem; font-weight:800; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }
    .spinner { width:36px; height:36px; border:3px solid var(--color-border); border-top-color:var(--color-primary); border-radius:50%; animation:spin 0.7s linear infinite; margin:0 auto 16px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .loading-text { font-size:0.9rem; color:var(--color-text-muted); margin:0; }
    .error-title { font-size:1.25rem; font-weight:800; color:var(--color-text); margin:0 0 10px; }
    .error-sub { font-size:0.875rem; color:var(--color-text-muted); margin:0 0 24px; }
    .retry-btn { display:inline-block; padding:12px 28px; border-radius:12px; background:linear-gradient(135deg,var(--color-accent),var(--color-accent-dark)); color:white; font-size:0.9rem; font-weight:700; text-decoration:none; box-shadow:0 4px 14px rgba(249,115,22,0.35); transition:opacity 0.15s; }
    .retry-btn:hover { opacity:0.9; }
  `]
})
export class AuthCallbackComponent implements OnInit, OnDestroy {
  private supabase = inject(Supabase);
  private profiles = inject(ProfilesService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);

  errorMessage = signal<string | null>(null);
  private authSubscription: { unsubscribe: () => void } | null = null;
  private navigated = false;

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const params = new URLSearchParams(this.document.location.hash.substring(1));
    const error = params.get('error');

    if (error) {
      const description = params.get('error_description') ?? 'The magic link has expired or already been used.';
      this.errorMessage.set(description.replace(/\+/g, ' '));
      return;
    }

    if (!this.document.location.hash) {
      this.router.navigate(['/login']);
      return;
    }

    const { data: { subscription } } = this.supabase.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) this.navigateByRole(session.user.id);
    });
    this.authSubscription = subscription;

    const { data: { session } } = await this.supabase.client.auth.getSession();
    if (session) {
      this.navigateByRole(session.user.id);
      return;
    }

    setTimeout(() => {
      if (!this.navigated) {
        this.errorMessage.set('Sign-in timed out. Please request a new link.');
      }
    }, 8000);
  }

  private async navigateByRole(userId: string) {
    if (this.navigated) return;
    this.navigated = true;
    const profile = await this.profiles.getMyProfile(userId);
    const dest = profile?.role === 'super_admin' ? '/admin' : '/dashboard';
    this.router.navigate([dest]);
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/auth/auth-callback.component.ts
git commit -m "feat: route super_admin to /admin after sign-in"
```

---

### Task 12: Guest View Disabled Fallback

**Files:**
- Modify: `src/app/features/guest-view/components/guest-view.component.ts`
- Modify: `src/app/features/guest-view/components/guest-view.component.html`

- [ ] **Step 1: Add `isDisabled` signal to GuestViewComponent**

In `guest-view.component.ts`, add the `isDisabled` signal alongside the other signals and set it inside `loadInvitationData`. Replace the existing `loadInvitationData` method and add the signal declaration:

Add `isDisabled = signal(false);` on the line after `hasError = signal(false);` (around line 27).

Replace the `loadInvitationData` method body with:

```typescript
async loadInvitationData() {
  try {
    this.isLoading.set(true);
    const [eventRes, guestRes, rsvpRes] = await Promise.all([
      this.supabase.client.from('events').select('*').eq('id', this.eventId()).single(),
      this.supabase.client.from('guests').select('*').eq('id', this.guestId()).single(),
      this.supabase.client.from('rsvps').select('*').eq('guest_id', this.guestId()).maybeSingle()
    ]);
    if (eventRes.error || guestRes.error) throw new Error('Invitation not found');
    this.eventData.set(eventRes.data as EventData);
    this.isDisabled.set(!(eventRes.data as any).is_enabled);
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
```

- [ ] **Step 2: Replace `guest-view.component.html`**

```html
<!-- src/app/features/guest-view/components/guest-view.component.html -->
<main class="guest-page">

  @if (isLoading()) {
    <div class="status-wrap fade-in">
      <div class="spinner"></div>
      <p class="status-text">Preparing your invitation…</p>
    </div>
  }

  @else if (hasError()) {
    <div class="status-wrap error fade-in">
      <div class="err-icon">🔍</div>
      <h2>Invitation not found</h2>
      <p>Please verify the link with your host.</p>
      <a routerLink="/" class="back-home">← Back to home</a>
    </div>
  }

  @else if (isDisabled()) {
    <div class="status-wrap fade-in">
      <div class="err-icon">🔒</div>
      <h2>Invitation Unavailable</h2>
      <p>This invitation is temporarily unavailable. Please contact the host.</p>
    </div>
  }

  @else if (templateContext()) {
    <app-template-renderer [context]="templateContext()!"></app-template-renderer>
  }

</main>
```

- [ ] **Step 3: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/guest-view/components/guest-view.component.ts src/app/features/guest-view/components/guest-view.component.html
git commit -m "feat: show disabled fallback on guest view when event is_enabled = false"
```

---

### Task 13: End-to-End Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
npx ng serve
```

Navigate to `http://localhost:4200`.

- [ ] **Step 2: Verify admin routing after sign-in**

1. Sign out if already signed in
2. Go to `http://localhost:4200/login`
3. Enter your super admin email and request a magic link
4. Click the email link
5. Expected: lands on `http://localhost:4200/admin` — dark "⚡ Admin Command Center" page visible

- [ ] **Step 3: Verify non-admin is blocked**

1. Sign in with any other email address
2. Manually navigate to `http://localhost:4200/admin`
3. Expected: immediately redirected to `/dashboard`

- [ ] **Step 4: Verify event grid loads**

1. On the admin panel, confirm events from all hosts appear in the table
2. Check status badges match each event's date (Upcoming = future date, Passed = past date, Ongoing = today)
3. Confirm the search input filters by host email, title, and event ID
4. Confirm the status dropdown filters correctly

- [ ] **Step 5: Verify enable/disable toggle**

1. Click the ON toggle for any event
2. Expected: pill switches to OFF immediately (optimistic update)
3. Reload the page — expected: OFF state persists

- [ ] **Step 6: Verify edit + VERIFY guard**

1. Click ✏️ Edit on any event
2. Change the title to something new
3. Click "Save Changes"
4. Expected: VERIFY modal appears with "Save Changes" button greyed out
5. Type `verify` (lowercase) — button stays disabled
6. Clear and type `VERIFY` (exact) — button enables
7. Click "Save Changes"
8. Expected: modal closes, success toast appears, grid reloads with updated title

- [ ] **Step 7: Verify disabled event fallback**

1. On the admin panel, toggle any event to OFF (Disabled)
2. Copy a guest magic link for that event: `http://localhost:4200/w/:eventId/:guestId`
3. Open the link in a new tab (or sign out and visit it directly)
4. Expected: "🔒 Invitation Unavailable. Please contact the host." — no RSVP buttons visible

- [ ] **Step 8: Verify manual magic link dispatch**

1. In the Magic Link panel at the bottom of the admin page, type at least 2 characters of a registered user's email
2. Expected: matching user appears in the list below
3. Click "Send Magic Email"
4. Expected: button shows "Sending…" then returns to normal; success toast fires
5. Check the user's inbox — Supabase OTP email should arrive

- [ ] **Step 9: Verify hard delete**

1. Click 🗑 Delete on an event
2. Expected: red-bordered confirmation dialog appears
3. Click Delete
4. Expected: event row disappears from grid; success toast fires
5. In Supabase Table Editor, confirm that event's guests and RSVPs rows are also gone (cascade delete)
