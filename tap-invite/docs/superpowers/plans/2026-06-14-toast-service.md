# Toast Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace locally-managed toast logic with a centralized `ToastService` injectable from anywhere, supporting success/error/info/warning messages and inline confirmation toasts.

**Architecture:** A `providedIn: 'root'` `ToastService` holds a `signal<Toast[]>` and exposes `success/error/info/warning/confirm/dismiss` methods. `ToastComponent` is moved to the root `app.ts` template so it renders once across all routes, injecting the service directly instead of receiving an `@Input`. `HostDashboardComponent` is migrated to drop its local toast logic and call the service instead.

**Tech Stack:** Angular 22, Angular Signals, TypeScript 6

---

## File Map

| File | Action |
|------|--------|
| `src/styles.css` | **Modify** — add `--color-info` and `--color-warning` CSS variables |
| `src/app/core/services/toast/toast.service.ts` | **Create** — `Toast` interface + `ToastService` |
| `src/app/shared/components/toast/toast.component.ts` | **Modify** — inject service, remove `@Input`, add confirm/cancel methods |
| `src/app/shared/components/toast/toast.component.html` | **Modify** — add info/warning classes, confirm buttons row |
| `src/app/shared/components/toast/toast.component.css` | **Modify** — add info/warning/confirm styles |
| `src/app/app.ts` | **Modify** — import `ToastComponent`, add `<app-toast />` to template |
| `src/app/features/host-dashboard/components/host-dashboard.component.ts` | **Modify** — inject `ToastService`, remove local toast signal/counter/method |
| `src/app/features/host-dashboard/components/host-dashboard.component.html` | **Modify** — remove `<app-toast>` |

---

## Task 1: Add CSS color variables for info and warning

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add `--color-info` and `--color-warning` to both light and dark theme**

  In `src/styles.css`, update the `:root` block and `[data-theme="dark"]` block:

  ```css
  /* :root — add after --color-error: #ef4444; */
  --color-info: #3b82f6;
  --color-warning: #eab308;
  ```

  ```css
  /* [data-theme="dark"] — add after --color-error: #f87171; */
  --color-info: #60a5fa;
  --color-warning: #facc15;
  ```

  Final `:root` block:
  ```css
  :root {
    --color-primary: #0ea5e9;
    --color-primary-dark: #0284c7;
    --color-accent: #f97316;
    --color-accent-dark: #ea6c06;
    --color-band-from: #0ea5e9;
    --color-band-to: #0284c7;
    --color-bg: #f8fafc;
    --color-surface: #ffffff;
    --color-border: #e2e8f0;
    --color-text: #0f172a;
    --color-text-muted: #64748b;
    --color-success: #22c55e;
    --color-error: #ef4444;
    --color-info: #3b82f6;
    --color-warning: #eab308;
  }
  ```

  Final `[data-theme="dark"]` block:
  ```css
  [data-theme="dark"] {
    --color-primary: #38bdf8;
    --color-primary-dark: #0ea5e9;
    --color-accent: #fb923c;
    --color-accent-dark: #e05e00;
    --color-band-from: #0c2a4a;
    --color-band-to: #0f1f3d;
    --color-bg: #0b1120;
    --color-surface: #111827;
    --color-border: #1e293b;
    --color-text: #f1f5f9;
    --color-text-muted: #94a3b8;
    --color-success: #4ade80;
    --color-error: #f87171;
    --color-info: #60a5fa;
    --color-warning: #facc15;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/styles.css
  git commit -m "feat: add --color-info and --color-warning CSS variables"
  ```

---

## Task 2: Create ToastService

**Files:**
- Create: `src/app/core/services/toast/toast.service.ts`

- [ ] **Step 1: Create the service file**

  Create `src/app/core/services/toast/toast.service.ts` with this exact content:

  ```typescript
  import { Injectable, signal } from '@angular/core';

  export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning' | 'confirm';
    duration?: number;
    resolve?: (value: boolean) => void;
  }

  @Injectable({ providedIn: 'root' })
  export class ToastService {
    private _toasts = signal<Toast[]>([]);
    private _counter = 0;

    readonly toasts = this._toasts.asReadonly();

    success(message: string, duration = 3000): void {
      this._show({ message, type: 'success', duration });
    }

    error(message: string, duration = 3000): void {
      this._show({ message, type: 'error', duration });
    }

    info(message: string, duration = 3000): void {
      this._show({ message, type: 'info', duration });
    }

    warning(message: string, duration = 3000): void {
      this._show({ message, type: 'warning', duration });
    }

    confirm(message: string): Promise<boolean> {
      return new Promise<boolean>(resolve => {
        this._show({ message, type: 'confirm', resolve });
      });
    }

    dismiss(id: number): void {
      this._toasts.update(list => list.filter(t => t.id !== id));
    }

    private _show(partial: Omit<Toast, 'id'>): void {
      const id = ++this._counter;
      const toast: Toast = { id, ...partial };
      this._toasts.update(list => [...list, toast]);
      if (toast.duration !== undefined) {
        setTimeout(() => this.dismiss(id), toast.duration);
      }
    }
  }
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `ng build --configuration development`

  Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/core/services/toast/toast.service.ts
  git commit -m "feat: add ToastService with signal-based toast management"
  ```

---

## Task 3: Update ToastComponent TypeScript

**Files:**
- Modify: `src/app/shared/components/toast/toast.component.ts`

- [ ] **Step 1: Replace the entire file**

  Replace `src/app/shared/components/toast/toast.component.ts` with:

  ```typescript
  import { Component, inject } from '@angular/core';
  import { Toast, ToastService } from '../../../core/services/toast/toast.service';

  @Component({
    selector: 'app-toast',
    standalone: true,
    imports: [],
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.css']
  })
  export class ToastComponent {
    private toastService = inject(ToastService);

    readonly toasts = this.toastService.toasts;

    icon(type: Toast['type']): string {
      return { success: '✓', error: '✕', info: 'ℹ', warning: '⚠', confirm: '?' }[type];
    }

    confirm(toast: Toast): void {
      toast.resolve?.(true);
      this.toastService.dismiss(toast.id);
    }

    cancel(toast: Toast): void {
      toast.resolve?.(false);
      this.toastService.dismiss(toast.id);
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/shared/components/toast/toast.component.ts
  git commit -m "feat: refactor ToastComponent to inject ToastService"
  ```

---

## Task 4: Update ToastComponent HTML template

**Files:**
- Modify: `src/app/shared/components/toast/toast.component.html`

- [ ] **Step 1: Replace the entire template**

  Replace `src/app/shared/components/toast/toast.component.html` with:

  ```html
  <div class="toast-stack" aria-live="polite">
    @for (toast of toasts(); track toast.id) {
      <div class="toast"
           [class.toast-success]="toast.type === 'success'"
           [class.toast-error]="toast.type === 'error'"
           [class.toast-info]="toast.type === 'info'"
           [class.toast-warning]="toast.type === 'warning'"
           [class.toast-confirm]="toast.type === 'confirm'">
        <span class="toast-icon">{{ icon(toast.type) }}</span>
        <div class="toast-body">
          <span class="toast-msg">{{ toast.message }}</span>
          @if (toast.type === 'confirm') {
            <div class="toast-actions">
              <button class="btn-confirm" (click)="confirm(toast)">Confirm</button>
              <button class="btn-cancel" (click)="cancel(toast)">Cancel</button>
            </div>
          }
        </div>
      </div>
    }
  </div>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/shared/components/toast/toast.component.html
  git commit -m "feat: update ToastComponent template for info/warning/confirm types"
  ```

---

## Task 5: Update ToastComponent CSS

**Files:**
- Modify: `src/app/shared/components/toast/toast.component.css`

- [ ] **Step 1: Replace the entire CSS file**

  Replace `src/app/shared/components/toast/toast.component.css` with:

  ```css
  .toast-stack {
    position: fixed;
    top: 72px;
    right: 16px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 18px;
    border-radius: 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
    animation: slide-in 0.2s ease;
    backdrop-filter: blur(16px);
  }

  .toast-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toast-icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-success);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .toast-error .toast-icon {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-error);
  }

  .toast-info .toast-icon {
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-info);
  }

  .toast-warning .toast-icon {
    background: rgba(234, 179, 8, 0.15);
    color: var(--color-warning);
  }

  .toast-confirm .toast-icon {
    background: rgba(14, 165, 233, 0.15);
    color: var(--color-primary);
  }

  .toast-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
    pointer-events: all;
  }

  .btn-confirm {
    padding: 4px 14px;
    border-radius: 8px;
    border: none;
    background: var(--color-success);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-confirm:hover {
    opacity: 0.85;
  }

  .btn-cancel {
    padding: 4px 14px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: var(--color-border);
  }

  @keyframes slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/shared/components/toast/toast.component.css
  git commit -m "feat: add info/warning/confirm styles to ToastComponent"
  ```

---

## Task 6: Move ToastComponent to app root

**Files:**
- Modify: `src/app/app.ts`

- [ ] **Step 1: Replace `app.ts`**

  Replace `src/app/app.ts` with:

  ```typescript
  import { Component } from '@angular/core';
  import { RouterModule } from '@angular/router';
  import { ToastComponent } from './shared/components/toast/toast.component';

  @Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule, ToastComponent],
    template: `<router-outlet /><app-toast />`,
  })
  export class App {}
  ```

- [ ] **Step 2: Verify the build compiles**

  Run: `ng build --configuration development`

  Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/app.ts
  git commit -m "feat: mount ToastComponent at app root for global access"
  ```

---

## Task 7: Migrate HostDashboardComponent

**Files:**
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.ts`
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.html`

- [ ] **Step 1: Replace `host-dashboard.component.ts`**

  Replace the entire file with:

  ```typescript
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
    private supabase   = inject(Supabase);
    private router     = inject(Router);
    private platformId = inject(PLATFORM_ID);
    private toast      = inject(ToastService);

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
      this.toast.success('Guest added successfully!');
    }

    async handleGuestDeleted() {
      await this.loadGuests(this.activeEvent().id);
      this.toast.success('Guest deleted successfully!');
    }

    async copyLink(guestId: string) {
      if (!isPlatformBrowser(this.platformId)) return;
      const url = `${window.location.origin}/w/${this.activeEvent().id}/${guestId}`;
      try {
        await navigator.clipboard.writeText(url);
        this.toast.info('Invitation link copied!');
      } catch {
        this.toast.error('Could not copy — please copy the link manually.');
      }
    }

    async sendEmailInvitation(guestId: string) {
      try {
        await this.supabase.sendEmailInvitation(guestId);
        this.toast.success('Invitation email sent!');
      } catch {
        this.toast.error('Failed to send email. The email service may not be set up yet.');
      }
    }

    async handleLogout() {
      await this.supabase.signOut();
      this.router.navigate(['/login']);
    }
  }
  ```

- [ ] **Step 2: Remove `<app-toast>` from the dashboard template**

  Replace `src/app/features/host-dashboard/components/host-dashboard.component.html` with:

  ```html
  <app-header variant="dashboard" (logoutClick)="handleLogout()"></app-header>

  <main class="dash-main">

    @if (isLoading()) {
      <div class="loading-wrap">
        <div class="spinner"></div>
        <p>Loading your dashboard…</p>
      </div>
    }

    @else if (!activeEvent()) {
      <app-event-form
        [hostId]="userId()!"
        (eventCreated)="handleEventCreated($event)"
      ></app-event-form>
    }

    @else {
      <!-- Event strip -->
      <div class="event-strip">
        <div class="event-strip-inner">
          <div>
            <h1 class="event-title">{{ activeEvent().title }}</h1>
            <p class="event-meta">
              {{ activeEvent().event_date | date:'EEEE, MMM d · h:mm a' }}
              @if (activeEvent().location_text) {
                · {{ activeEvent().location_text }}
              }
            </p>
          </div>
          <span class="live-badge">● Live</span>
        </div>
      </div>

      <!-- Dashboard grid -->
      <div class="dash-grid">
        <app-add-guest-form
          [eventId]="activeEvent().id"
          (guestAdded)="handleGuestAdded()"
          (guestDeleted)="handleGuestDeleted()"
        ></app-add-guest-form>

        <app-guest-table
          [guests]="guests()"
          (copyLink)="copyLink($event)"
          (sendEmail)="sendEmailInvitation($event)"
          (guestDeleted)="handleGuestDeleted()"
        ></app-guest-table>
      </div>
    }

  </main>
  ```

- [ ] **Step 3: Verify the build compiles**

  Run: `ng build --configuration development`

  Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/features/host-dashboard/components/host-dashboard.component.ts
  git add src/app/features/host-dashboard/components/host-dashboard.component.html
  git commit -m "feat: migrate HostDashboardComponent to ToastService"
  ```

---

## Done

At this point the toast system is fully operational. Any component or service can call:

```typescript
private toast = inject(ToastService);

this.toast.success('Done!');
this.toast.error('Something went wrong.');
this.toast.info('Link copied.');
this.toast.warning('Unsaved changes.');

const ok = await this.toast.confirm('Delete this guest?');
if (ok) { /* proceed */ }
```
