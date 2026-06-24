# Host Dashboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify super admin and bulk upload features end-to-end, then add an RSVP stats bar, bulk email dispatch, and an event share + QR panel to the host dashboard.

**Architecture:** Tasks 1–2 are manual E2E checklists (no code). Tasks 3–6 each add or upgrade one focused component, following the existing Angular 22 standalone + signals pattern. Email dispatch stays self-contained inside `GuestTableComponent` (existing pattern); RSVP stats and share panel are new standalone components wired into `HostDashboardComponent`.

**Tech Stack:** Angular 22 (standalone, signals, `input()` signal-based inputs), Vitest, Supabase JS client, `qrcode` npm package.

## Global Constraints

- Angular 22 standalone components, signals. No NgRx.
- New components that need reactive inputs use signal-based `input()` / `input.required<T>()`, not `@Input()` decorator.
- `getGuests()` returns `rsvps` as an **array** (`*, rsvps(status)` join) — always access status via `g.rsvps?.[0]?.status`, not `g.rsvps?.status`.
- CSS: custom CSS variables + existing class conventions. No Tailwind.
- Tests: Vitest + Angular TestBed. Mock with `vi.fn()`. Files: `*.spec.ts` colocated with source.
- All source files under `tap-invite/src/app/`.
- Project is NOT a git repository — no git commands.
- Run `npm test` from `tap-invite/` to execute tests.
- Run `npm start` from `tap-invite/` to serve the app.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `features/host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.ts\|html\|css` | 4 RSVP count chips |
| `features/host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.spec.ts` | Unit tests for computed counts |
| `features/host-dashboard/components/event-share-panel/event-share-panel.component.ts\|html\|css` | Copy link + QR code |
| `features/event-public/event-public.component.ts\|html\|css` | Public event details page (no auth) |

### Modified files
| Path | Change |
|------|--------|
| `features/host-dashboard/components/guest-table/guest-table.component.ts` | `sendingId` → `sendingIds` Set; add `handleSendAll()`; fix `getStatus()` |
| `features/host-dashboard/components/guest-table/guest-table.component.html` | Update button bindings; add Send All button |
| `features/host-dashboard/components/host-dashboard.component.ts` | Import + declare 2 new components |
| `features/host-dashboard/components/host-dashboard.component.html` | Place `<app-event-share-panel>` and `<app-rsvp-stats-bar>` |
| `app/app.routes.ts` | Add `/e/:eventId` route |
| `package.json` | Add `qrcode` + `@types/qrcode` |

---

## Task 1: E2E — Super Admin verification (steps 5–8)

No code changes. Start the app (`npm start` from `tap-invite/`) and log in as super admin.

- [ ] **Step 1: Verify Edit + VERIFY guard (Step 5)**
  1. Navigate to `/admin`.
  2. Click **✏️ Edit** on any event. Change the title. Click **Save Changes**.
  3. Expected: VERIFY overlay appears. Type `VERIFY` → Save becomes enabled. Click it.
  4. Expected: modal closes, grid row shows updated title, success toast appears.

- [ ] **Step 2: Verify disabled event guest view (Step 6)**
  1. In the event grid, click the **ON** toggle on any event to disable it (turns OFF).
  2. Copy a guest link for that event: `http://localhost:4200/w/<eventId>/<guestId>`.
  3. Open the link in an incognito window.
  4. Expected: page shows "Invitation Unavailable" (🔒), NOT the invitation template.

- [ ] **Step 3: Verify manual magic link dispatch (Step 7)**
  1. Scroll to **Manual Magic Link Dispatcher** in `/admin`.
  2. Type a real user email into the search field. Click **Send Magic Email**.
  3. Expected: button shows "Sending…" then resets; success toast; email arrives in inbox.

- [ ] **Step 4: Verify hard delete with cascade (Step 8)**
  1. Click **🗑 Delete** on any event in the grid.
  2. Expected: confirmation dialog appears with the event title.
  3. Click **Delete**.
  4. Expected: event disappears from grid; success toast shown.
  5. Open Supabase Table Editor → confirm `guests` and `rsvps` rows for that event are gone (ON DELETE CASCADE).

---

## Task 2: E2E — Bulk Upload verification

No code changes. Log in as a regular host. An event with at least one existing guest must exist.

- [ ] **Step 1: Verify entry point**
  Open `/dashboard`. Find the "Add Guest" card.
  Expected: a **Bulk upload** button is visible inside the card.

- [ ] **Step 2: Verify template download**
  Click "Bulk upload". In the dialog, click **Download CSV template**.
  Expected: a `.csv` file downloads with `Name`, `Phone`, `Email` columns and example rows.

- [ ] **Step 3: Verify valid upload**
  Create a CSV with 3 valid rows (name required; phone/email optional). Upload it.
  Expected: dialog switches to preview table showing 3 rows with no error highlights.

- [ ] **Step 4: Verify inline error + fix**
  Upload a CSV where one row has an empty name.
  Expected: that row is highlighted with an error; **Save** is disabled.
  Edit the name inline → error clears → Save becomes enabled.

- [ ] **Step 5: Verify duplicate detection**
  Upload a CSV that includes the email of the existing guest.
  Expected: that row shows a **Duplicate** badge. Save remains enabled (duplicates warn, don't block).

- [ ] **Step 6: Verify save**
  Click **Save** with valid rows.
  Expected: dialog closes; success toast shows count (e.g. "3 guests added successfully!"); guest table updates.

---

## Task 3: RSVP Stats Bar

**Files:**
- Create: `tap-invite/src/app/features/host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.ts`
- Create: `tap-invite/src/app/features/host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.html`
- Create: `tap-invite/src/app/features/host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.css`
- Create: `tap-invite/src/app/features/host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.spec.ts`
- Modify: `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.ts`
- Modify: `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.html`

**Interfaces:**
- Consumes: signal-based `guests` input — array where each element has `{ rsvps: Array<{ status: string }> | [] }`
- Produces: `<app-rsvp-stats-bar [guests]="guests()">` — selector `app-rsvp-stats-bar`

- [ ] **Step 1: Write the failing test**

Create `tap-invite/src/app/features/host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { RsvpStatsBarComponent } from './rsvp-stats-bar.component';

function makeGuest(status: string | null) {
  return { rsvps: status ? [{ status }] : [] };
}

describe('RsvpStatsBarComponent — computed counts', () => {
  it('counts each RSVP status correctly', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', [
      makeGuest('Accepted'),
      makeGuest('Accepted'),
      makeGuest('Declined'),
      makeGuest(null),
    ]);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.accepted()).toBe(2);
    expect(c.declined()).toBe(1);
    expect(c.tentative()).toBe(0);
    expect(c.pending()).toBe(1);
  });

  it('counts tentative guests', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', [makeGuest('Tentative'), makeGuest('Tentative')]);
    fixture.detectChanges();
    expect(fixture.componentInstance.tentative()).toBe(2);
  });

  it('treats empty rsvps array as pending', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', [makeGuest(null), makeGuest('Pending')]);
    fixture.detectChanges();
    expect(fixture.componentInstance.pending()).toBe(2);
  });

  it('returns all zeros for empty guest list', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', []);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.accepted()).toBe(0);
    expect(c.declined()).toBe(0);
    expect(c.tentative()).toBe(0);
    expect(c.pending()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```
cd tap-invite && npm test
```
Expected: FAIL — `RsvpStatsBarComponent` not found.

- [ ] **Step 3: Create the component**

Create `rsvp-stats-bar.component.ts`:

```typescript
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-rsvp-stats-bar',
  standalone: true,
  imports: [],
  templateUrl: './rsvp-stats-bar.component.html',
  styleUrls: ['./rsvp-stats-bar.component.css'],
})
export class RsvpStatsBarComponent {
  guests = input<any[]>([]);

  accepted  = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Accepted').length);
  declined  = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Declined').length);
  tentative = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Tentative').length);
  pending   = computed(() =>
    this.guests().filter(g => !g.rsvps?.length || g.rsvps[0].status === 'Pending').length
  );
}
```

Create `rsvp-stats-bar.component.html`:

```html
@if (guests().length > 0) {
  <div class="stats-bar">
    <div class="stat-chip stat-chip--accepted">
      <span class="stat-count">{{ accepted() }}</span>
      <span class="stat-label">Accepted</span>
    </div>
    <div class="stat-chip stat-chip--declined">
      <span class="stat-count">{{ declined() }}</span>
      <span class="stat-label">Declined</span>
    </div>
    <div class="stat-chip stat-chip--tentative">
      <span class="stat-count">{{ tentative() }}</span>
      <span class="stat-label">Tentative</span>
    </div>
    <div class="stat-chip stat-chip--pending">
      <span class="stat-count">{{ pending() }}</span>
      <span class="stat-label">Pending</span>
    </div>
  </div>
}
```

Create `rsvp-stats-bar.component.css`:

```css
.stats-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 18px;
  border-radius: 10px;
  min-width: 80px;
}
.stat-count {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
}
.stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}
.stat-chip--accepted  { background: #dcfce7; color: #16a34a; }
.stat-chip--declined  { background: #fee2e2; color: #dc2626; }
.stat-chip--tentative { background: #fef9c3; color: #854d0e; }
.stat-chip--pending   { background: #f1f5f9; color: #64748b; }
```

- [ ] **Step 4: Run test — expect PASS**

```
cd tap-invite && npm test
```
Expected: all 4 `RsvpStatsBarComponent` tests PASS.

- [ ] **Step 5: Wire into HostDashboardComponent**

In `host-dashboard.component.ts`, add the import and register the component:

```typescript
import { RsvpStatsBarComponent } from './rsvp-stats-bar/rsvp-stats-bar.component';
```

Add `RsvpStatsBarComponent` to the `imports` array inside `@Component({ ... })`.

In `host-dashboard.component.html`, insert just before `<div class="dash-grid">` (inside the `@else` block):

```html
    <!-- RSVP Stats Bar -->
    <app-rsvp-stats-bar [guests]="guests()"></app-rsvp-stats-bar>

    <!-- Dashboard grid -->
    <div class="dash-grid">
```

- [ ] **Step 6: Smoke test in browser**

Start the app (`npm start`). Open `/dashboard`. Set an RSVP via a guest link.
Expected: stats bar shows 4 colored chips with correct counts. Hidden when no guests exist.

---

## Task 4: Email Dispatch — upgrade GuestTable

**Files:**
- Modify: `tap-invite/src/app/features/host-dashboard/components/guest-table/guest-table.component.ts`
- Modify: `tap-invite/src/app/features/host-dashboard/components/guest-table/guest-table.component.html`
- Modify: `tap-invite/src/app/features/host-dashboard/components/guest-table/guest-table.component.css`

**Context:** `GuestTableComponent` currently has `sendingId = signal<string | null>(null)` (single guest at a time) and `onSendEmail()` calls the Supabase service directly. We keep this self-contained pattern: upgrade to `sendingIds` Set for parallel tracking and add `handleSendAll()` directly in the component.

The old `ngOnChanges` stats (`totalGuests`, `totalAttending`, etc.) used `g.rsvps?.status` which is incorrect (rsvps is an array). These signals are removed — `RsvpStatsBarComponent` (Task 3) now owns RSVP counts.

- [ ] **Step 1: Replace guest-table.component.ts**

```typescript
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
```

- [ ] **Step 2: Replace guest-table.component.html**

```html
<div class="gt-card">
  <div class="gt-header">
    <div class="field-group">
      <h3 class="gt-title">Guest Network</h3>
      <input
        class="field-input"
        [(value)]="searchTerm"
        name="search"
        placeholder="Guest Name or Phone"
      />
    </div>
    @if (guests.length > 0 && hasAnyEmail) {
      <button
        type="button"
        class="btn-send-all"
        [disabled]="sendingIds().size > 0"
        (click)="handleSendAll()"
      >
        {{ sendingIds().size > 0 ? 'Sending…' : '✉ Send All Invitations' }}
      </button>
    }
  </div>

  @if (guests.length === 0) {
    <p class="empty-msg">No guests yet. Start building your list.</p>
  } @else {
    <div class="table-wrap">
      <table class="guest-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Tools</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (guest of guests; track guest.id) {
            <tr>
              <td class="name-cell">{{ guest.display_name }}</td>
              <td>
                <span class="badge badge-{{ getStatus(guest).toLowerCase() }}">
                  {{ getStatus(guest) }}
                </span>
              </td>
              <td>
                <div class="field-group">
                  @if (guest.phone_number) {
                    <div>📱</div>
                  } @else {
                    <div class="email-icon-disabled">📱</div>
                  }
                  @if (guest.email) {
                    <div>✉</div>
                  } @else {
                    <div class="email-icon-disabled">✉</div>
                  }
                </div>
              </td>
              <td class="action-cell">
                <button type="button" class="btn-copy" (click)="copyLink.emit(guest.id)">🔗 Copy</button>
                <button
                  type="button"
                  class="btn-email"
                  [disabled]="isSending(guest.id) || !guest.email"
                  [title]="!guest.email ? 'No email on file' : ''"
                  (click)="onSendEmail(guest.id)"
                >
                  {{ isSending(guest.id) ? 'Sending…' : '✉ Send' }}
                </button>
                <button type="button" class="btn-delete" (click)="onDelete(guest.id)">🗑️ Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
```

- [ ] **Step 3: Add CSS for new elements**

Open `guest-table.component.css` and append at the end:

```css
.gt-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.btn-send-all {
  background: #7c3aed;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.btn-send-all:disabled {
  background: #475569;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Smoke test in browser**

Open `/dashboard`.
- Per-row **✉ Send** button is disabled for guests without email (and shows tooltip "No email on file").
- **✉ Send All Invitations** button appears above the table when at least one guest has an email.
- Clicking **✉ Send** on a guest shows "Sending…" state while the request is in flight.

---

## Task 5: Public Event Page + Route

**Files:**
- Modify: `tap-invite/package.json`
- Create: `tap-invite/src/app/features/event-public/event-public.component.ts`
- Create: `tap-invite/src/app/features/event-public/event-public.component.html`
- Create: `tap-invite/src/app/features/event-public/event-public.component.css`
- Modify: `tap-invite/src/app/app.routes.ts`

**Interfaces:**
- Produces: public route `/e/:eventId` that loads event from Supabase and displays title / date / location.
- Consumes: `supabase.client.from('events').select('*').eq('id', eventId).single()` — existing client, no service changes needed.

- [ ] **Step 1: Install qrcode**

```
cd tap-invite && npm install qrcode && npm install --save-dev @types/qrcode
```

Expected: `package.json` has `"qrcode"` in `dependencies` and `"@types/qrcode"` in `devDependencies`.

- [ ] **Step 2: Create EventPublicPageComponent**

Create `tap-invite/src/app/features/event-public/event-public.component.ts`:

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-event-public',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './event-public.component.html',
  styleUrls: ['./event-public.component.css'],
})
export class EventPublicPageComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private supabase = inject(Supabase);

  isLoading  = signal(true);
  event      = signal<any>(null);
  isDisabled = signal(false);
  hasError   = signal(false);

  async ngOnInit() {
    const eventId = this.route.snapshot.paramMap.get('eventId');
    if (!eventId) { this.hasError.set(true); this.isLoading.set(false); return; }
    try {
      const { data, error } = await this.supabase.client
        .from('events').select('*').eq('id', eventId).single();
      if (error || !data) throw new Error('not found');
      this.event.set(data);
      this.isDisabled.set(data.is_enabled === false);
    } catch {
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
```

Create `event-public.component.html`:

```html
<main class="pub-page">
  @if (isLoading()) {
    <div class="status-wrap">
      <div class="spinner"></div>
      <p>Loading event…</p>
    </div>
  } @else if (hasError()) {
    <div class="status-wrap">
      <div class="err-icon">🔍</div>
      <h2>Event not found</h2>
      <p>The link may be invalid or the event has been removed.</p>
      <a routerLink="/" class="back-home">← Back to home</a>
    </div>
  } @else if (isDisabled()) {
    <div class="status-wrap">
      <div class="err-icon">🔒</div>
      <h2>Event Unavailable</h2>
      <p>This event is currently unavailable. Please contact the host.</p>
    </div>
  } @else if (event()) {
    <div class="event-card">
      <h1 class="event-title">{{ event().title }}</h1>
      <p class="event-date">📅 {{ event().event_date | date:'EEEE, MMMM d, y' }}</p>
      @if (event().location_text) {
        <p class="event-location">📍 {{ event().location_text }}</p>
      }
    </div>
  }
</main>
```

Create `event-public.component.css`:

```css
.pub-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg, #f8fafc);
}
.status-wrap {
  text-align: center;
  max-width: 400px;
}
.err-icon { font-size: 2.5rem; margin-bottom: 12px; }
.spinner {
  width: 40px; height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.event-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  max-width: 480px;
  width: 100%;
  text-align: center;
}
.event-title   { font-size: 1.75rem; font-weight: 700; margin: 0 0 16px; color: #1e293b; }
.event-date,
.event-location { font-size: 1rem; color: #64748b; margin: 8px 0; }
.back-home { color: #7c3aed; text-decoration: none; font-size: 0.875rem; }
```

- [ ] **Step 3: Add route to app.routes.ts**

Add the following entry **before** the `{ path: '**', redirectTo: '' }` catch-all:

```typescript
{
  path: 'e/:eventId',
  loadComponent: () => import('./features/event-public/event-public.component').then(c => c.EventPublicPageComponent)
},
```

The full updated `routes` array in `app.routes.ts`:

```typescript
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
  {
    path: 'e/:eventId',
    loadComponent: () => import('./features/event-public/event-public.component').then(c => c.EventPublicPageComponent)
  },
  { path: '**', redirectTo: '' }
];
```

- [ ] **Step 4: Smoke test in browser**

Navigate to `http://localhost:4200/e/<a-valid-event-id>`.
Expected: event title, date, and location displayed. No RSVP controls visible.

Navigate to `http://localhost:4200/e/invalid-id`.
Expected: "Event not found" screen with a back-to-home link.

---

## Task 6: Event Share Panel

**Files:**
- Create: `tap-invite/src/app/features/host-dashboard/components/event-share-panel/event-share-panel.component.ts`
- Create: `tap-invite/src/app/features/host-dashboard/components/event-share-panel/event-share-panel.component.html`
- Create: `tap-invite/src/app/features/host-dashboard/components/event-share-panel/event-share-panel.component.css`
- Modify: `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.ts`
- Modify: `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.html`

**Pre-condition:** `qrcode` package is installed (Task 5, Step 1).

**Interfaces:**
- Consumes: `eventId = input.required<string>()`, `eventTitle = input.required<string>()`
- Consumes: `import QRCode from 'qrcode'` — `QRCode.toDataURL(url, { width: 256, margin: 2 }): Promise<string>`
- Consumes: `ToastService` injected directly (no parent wiring)
- Produces: `<app-event-share-panel [eventId]="activeEvent().id" [eventTitle]="activeEvent().title">`

- [ ] **Step 1: Create the component TypeScript**

Create `event-share-panel.component.ts`:

```typescript
import { Component, inject, input, computed, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import QRCode from 'qrcode';
import { ToastService } from '../../../../core/services/toast/toast.service';

@Component({
  selector: 'app-event-share-panel',
  standalone: true,
  imports: [],
  templateUrl: './event-share-panel.component.html',
  styleUrls: ['./event-share-panel.component.css'],
})
export class EventSharePanelComponent implements OnInit {
  eventId    = input.required<string>();
  eventTitle = input.required<string>();

  private toast      = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  shareUrl  = computed(() =>
    isPlatformBrowser(this.platformId)
      ? `${window.location.origin}/e/${this.eventId()}`
      : ''
  );
  qrDataUrl = signal('');

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = await QRCode.toDataURL(this.shareUrl(), { width: 256, margin: 2 });
    this.qrDataUrl.set(url);
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.toast.info('Event link copied!');
    } catch {
      this.toast.error('Could not copy — please copy the link manually.');
    }
  }
}
```

- [ ] **Step 2: Create the HTML template**

Create `event-share-panel.component.html`:

```html
<div class="share-panel">
  <h3 class="share-title">Share Event</h3>

  <div class="share-row">
    <input
      type="text"
      class="share-url-input"
      [value]="shareUrl()"
      readonly
      aria-label="Event share link"
    />
    <button type="button" class="btn-copy" (click)="copyLink()">🔗 Copy Link</button>
  </div>

  @if (qrDataUrl()) {
    <div class="qr-wrap">
      <img [src]="qrDataUrl()" alt="Event QR code" width="128" height="128" />
      <a
        class="btn-download"
        [href]="qrDataUrl()"
        [download]="eventTitle() + '-invite-qr.png'"
      >⬇ Download QR</a>
    </div>
  }
</div>
```

- [ ] **Step 3: Create the CSS**

Create `event-share-panel.component.css`:

```css
.share-panel {
  background: var(--color-card-bg, white);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.share-title {
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #64748b);
  margin: 0 0 12px;
}
.share-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.share-url-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
  background: var(--color-bg, #f8fafc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-copy {
  background: #7c3aed;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}
.qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
}
.qr-wrap img {
  border-radius: 8px;
  border: 1px solid var(--color-border, #e2e8f0);
}
.btn-download {
  font-size: 0.8125rem;
  color: #7c3aed;
  text-decoration: none;
  font-weight: 500;
}
.btn-download:hover { text-decoration: underline; }
```

- [ ] **Step 4: Wire into HostDashboardComponent**

In `host-dashboard.component.ts`, add the import:

```typescript
import { EventSharePanelComponent } from './event-share-panel/event-share-panel.component';
```

Add `EventSharePanelComponent` to the `imports` array inside `@Component({ ... })`.

In `host-dashboard.component.html`, inside the `@else` block, add both new elements after the event strip and before `<div class="dash-grid">`:

```html
    <!-- Event Share Panel -->
    <app-event-share-panel
      [eventId]="activeEvent().id"
      [eventTitle]="activeEvent().title">
    </app-event-share-panel>

    <!-- RSVP Stats Bar -->
    <app-rsvp-stats-bar [guests]="guests()"></app-rsvp-stats-bar>

    <!-- Dashboard grid -->
    <div class="dash-grid">
```

- [ ] **Step 5: Run full test suite**

```
cd tap-invite && npm test
```
Expected: all existing tests plus the 4 new `RsvpStatsBarComponent` tests pass. No regressions.

- [ ] **Step 6: Full smoke test in browser**

Open `/dashboard`. Expected:
- Share panel appears below the event strip with a read-only URL and **🔗 Copy Link** button.
- A 128×128 QR code renders within 1–2 seconds.
- Click **🔗 Copy Link** → toast "Event link copied!".
- Click **⬇ Download QR** → PNG file downloads named `<eventTitle>-invite-qr.png`.
- Navigate to the copied URL (`/e/<eventId>`) → event details page loads correctly.
- RSVP stats bar appears below the share panel with correct counts.
- Guest table shows per-row **✉ Send** buttons and **✉ Send All Invitations** above the table.
