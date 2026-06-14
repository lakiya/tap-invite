# TapInvite UI/UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Sky Blue + Slate Premium design system across all four pages, extract sub-components from the monolithic dashboard, and add a persistent light/dark theme toggle.

**Architecture:** Global CSS custom properties drive all colours; `ThemeService` toggles `data-theme="dark"` on `document.documentElement` and persists to `localStorage`. `HostDashboardComponent` becomes a thin orchestrator; all form and table logic moves to dedicated sub-components. `HeaderComponent` is shared between Landing and Dashboard.

**Tech Stack:** Angular 22 standalone components, Angular Signals, CSS custom properties, Supabase JS client, SSR (Express)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/styles.css` | CSS custom properties (light + dark tokens) |
| Create | `src/app/core/services/theme/theme.service.ts` | Theme toggle + localStorage persistence |
| Create | `src/app/core/services/theme/theme.service.spec.ts` | Unit tests for ThemeService |
| Create | `src/app/shared/components/toast/toast.component.ts` | Toast display + auto-dismiss |
| Create | `src/app/shared/components/toast/toast.component.html` | Toast template |
| Create | `src/app/shared/components/toast/toast.component.css` | Toast styles |
| Create | `src/app/shared/components/header/header.component.ts` | Shared sticky header |
| Create | `src/app/shared/components/header/header.component.html` | Header template |
| Create | `src/app/shared/components/header/header.component.css` | Header styles |
| Create | `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts` | RSVP 3-button UI |
| Create | `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.html` | RSVP template |
| Create | `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.css` | RSVP styles |
| Create | `src/app/features/host-dashboard/components/event-form/event-form.component.ts` | Create-event form |
| Create | `src/app/features/host-dashboard/components/event-form/event-form.component.html` | Event form template |
| Create | `src/app/features/host-dashboard/components/event-form/event-form.component.css` | Event form styles |
| Create | `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.ts` | Add-guest form + validation |
| Create | `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.spec.ts` | Validation unit tests |
| Create | `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.html` | Add-guest template |
| Create | `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.css` | Add-guest styles |
| Create | `src/app/features/host-dashboard/components/guest-table/guest-table.component.ts` | Guest list table |
| Create | `src/app/features/host-dashboard/components/guest-table/guest-table.component.html` | Guest table template |
| Create | `src/app/features/host-dashboard/components/guest-table/guest-table.component.css` | Guest table styles |
| Modify | `src/app/core/services/supabase/supabase.ts` | Extend addGuest + add sendEmailInvitation + getEventByHost |
| Modify | `src/app/features/auth/login.component.ts` | Premium restyle |
| Modify | `src/app/features/landing/landing.component.ts` | Premium restyle + HeaderComponent |
| Modify | `src/app/features/guest-view/components/guest-view.component.ts` | Import RsvpButtonsComponent |
| Modify | `src/app/features/guest-view/components/guest-view.component.html` | Use RsvpButtonsComponent |
| Modify | `src/app/features/guest-view/components/guest-view.component.css` | Premium restyle |
| Modify | `src/app/features/host-dashboard/components/host-dashboard.component.ts` | Orchestrator rewrite |
| Modify | `src/app/features/host-dashboard/components/host-dashboard.component.html` | Orchestrator template |
| Modify | `src/app/features/host-dashboard/components/host-dashboard.component.css` | Premium restyle |

---

## Task 0: Global CSS Custom Properties

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Replace styles.css content**

```css
/* src/styles.css */
:root {
  --color-primary: #0ea5e9;
  --color-primary-dark: #0284c7;
  --color-accent: #f97316;
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-success: #22c55e;
  --color-error: #ef4444;
}

[data-theme="dark"] {
  --color-primary: #38bdf8;
  --color-primary-dark: #0ea5e9;
  --color-accent: #fb923c;
  --color-bg: #0b1120;
  --color-surface: #111827;
  --color-border: #1e293b;
  --color-text: #f1f5f9;
  --color-text-muted: #94a3b8;
  --color-success: #4ade80;
  --color-error: #f87171;
}

* {
  box-sizing: border-box;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  margin: 0;
  transition: background 0.2s ease, color 0.2s ease;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add CSS custom property design tokens (light + dark)"
```

---

## Task 1: ThemeService

**Files:**
- Create: `src/app/core/services/theme/theme.service.ts`
- Create: `src/app/core/services/theme/theme.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/services/theme/theme.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(ThemeService);
  });

  it('starts in light mode when no localStorage value', () => {
    expect(service.isDark()).toBeFalse();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('toggle() switches to dark mode and sets attribute', () => {
    service.toggle();
    expect(service.isDark()).toBeTrue();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle() persists choice to localStorage', () => {
    service.toggle();
    expect(localStorage.getItem('tapinvite-theme')).toBe('dark');
  });

  it('toggle() twice returns to light mode', () => {
    service.toggle();
    service.toggle();
    expect(service.isDark()).toBeFalse();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('reads stored dark preference on init', () => {
    localStorage.setItem('tapinvite-theme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    const fresh = TestBed.inject(ThemeService);
    expect(fresh.isDark()).toBeTrue();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
ng test --include="src/app/core/services/theme/theme.service.spec.ts" --watch=false
```
Expected: `Cannot find module './theme.service'`

- [ ] **Step 3: Create the service**

```typescript
// src/app/core/services/theme/theme.service.ts
import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'tapinvite-theme';

  isDark = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'dark') {
      this.applyDark(true);
    } else if (stored === null) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) this.applyDark(true);
    }
  }

  toggle(): void {
    this.applyDark(!this.isDark());
  }

  private applyDark(dark: boolean): void {
    this.isDark.set(dark);
    if (isPlatformBrowser(this.platformId)) {
      if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
ng test --include="src/app/core/services/theme/theme.service.spec.ts" --watch=false
```
Expected: 5 specs, 0 failures

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/theme/
git commit -m "feat: add ThemeService with localStorage persistence and SSR guard"
```

---

## Task 2: ToastComponent

**Files:**
- Create: `src/app/shared/components/toast/toast.component.ts`
- Create: `src/app/shared/components/toast/toast.component.html`
- Create: `src/app/shared/components/toast/toast.component.css`

- [ ] **Step 1: Create the TypeScript file**

```typescript
// src/app/shared/components/toast/toast.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent {
  @Input() toasts: Toast[] = [];
}
```

- [ ] **Step 2: Create the HTML template**

```html
<!-- src/app/shared/components/toast/toast.component.html -->
<div class="toast-stack" aria-live="polite">
  @for (toast of toasts; track toast.id) {
    <div class="toast" [class.toast-error]="toast.type === 'error'">
      <span class="toast-icon">{{ toast.type === 'success' ? '✓' : '✕' }}</span>
      <span class="toast-msg">{{ toast.message }}</span>
    </div>
  }
</div>
```

- [ ] **Step 3: Create the CSS**

```css
/* src/app/shared/components/toast/toast.component.css */
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
  align-items: center;
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

@keyframes slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/components/toast/
git commit -m "feat: add ToastComponent with success/error styles and slide-in animation"
```

---

## Task 3: HeaderComponent

**Files:**
- Create: `src/app/shared/components/header/header.component.ts`
- Create: `src/app/shared/components/header/header.component.html`
- Create: `src/app/shared/components/header/header.component.css`

- [ ] **Step 1: Create the TypeScript file**

```typescript
// src/app/shared/components/header/header.component.ts
import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../../core/services/theme/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  @Input() variant: 'landing' | 'dashboard' = 'landing';
  @Output() logoutClick = new EventEmitter<void>();

  themeService = inject(ThemeService);
}
```

- [ ] **Step 2: Create the HTML template**

```html
<!-- src/app/shared/components/header/header.component.html -->
<header class="site-header">
  <div class="header-inner">

    <a routerLink="/" class="logo">
      <span class="logo-mark">T</span>
      <span class="logo-text">TapInvite</span>
    </a>

    @if (variant === 'landing') {
      <nav class="header-nav">
        <a href="#features" class="nav-link">Features</a>
        <a href="#pricing" class="nav-link">Pricing</a>
        <a routerLink="/login" class="nav-cta">Get Started</a>
      </nav>
    }

    @if (variant === 'dashboard') {
      <div class="header-actions">
        <button class="logout-btn" (click)="logoutClick.emit()">Logout</button>
      </div>
    }

    <button class="theme-toggle" (click)="themeService.toggle()" [attr.aria-label]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'">
      <span class="toggle-track" [class.dark]="themeService.isDark()">
        <span class="toggle-knob">{{ themeService.isDark() ? '🌙' : '☀️' }}</span>
      </span>
    </button>

  </div>
</header>
```

- [ ] **Step 3: Create the CSS**

```css
/* src/app/shared/components/header/header.component.css */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(248, 250, 252, 0.85);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
  transition: background 0.2s ease, border-color 0.2s ease;
}

[data-theme="dark"] .site-header {
  background: rgba(11, 17, 32, 0.85);
}

.header-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--color-text);
  text-decoration: none;
}

.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 800;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-left: auto;
}

.nav-link {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--color-primary);
}

.nav-cta {
  padding: 8px 18px;
  border-radius: 10px;
  background: var(--color-primary);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s ease;
}

.nav-cta:hover {
  background: var(--color-primary-dark);
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.logout-btn {
  padding: 7px 16px;
  border-radius: 9px;
  border: 1.5px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.logout-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Theme toggle */
.theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-left: 8px;
  flex-shrink: 0;
}

.toggle-track {
  display: flex;
  align-items: center;
  width: 48px;
  height: 26px;
  border-radius: 13px;
  background: #cbd5e1;
  padding: 3px;
  transition: background 0.2s ease;
}

.toggle-track.dark {
  background: #1d4ed8;
  justify-content: flex-end;
}

.toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/components/header/
git commit -m "feat: add HeaderComponent with landing/dashboard variants and theme toggle"
```

---

## Task 4: RsvpButtonsComponent

**Files:**
- Create: `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts`
- Create: `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.html`
- Create: `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.css`

- [ ] **Step 1: Create the TypeScript file**

```typescript
// src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type RsvpStatus = 'Pending' | 'Accepted' | 'Declined' | 'Tentative';

@Component({
  selector: 'app-rsvp-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rsvp-buttons.component.html',
  styleUrls: ['./rsvp-buttons.component.css']
})
export class RsvpButtonsComponent {
  @Input() status: RsvpStatus = 'Pending';
  @Output() rsvpChange = new EventEmitter<'Accepted' | 'Declined' | 'Tentative'>();
}
```

- [ ] **Step 2: Create the HTML template**

```html
<!-- src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.html -->
<div class="rsvp-section">
  @if (status === 'Pending') {
    <h3 class="rsvp-heading">Will you join us?</h3>
    <div class="rsvp-actions">
      <button class="btn-accept" (click)="rsvpChange.emit('Accepted')">✓ Accept with Joy</button>
      <button class="btn-maybe"  (click)="rsvpChange.emit('Tentative')">〜 Maybe</button>
      <button class="btn-decline" (click)="rsvpChange.emit('Declined')">✕ Regretfully Decline</button>
    </div>
  }

  @if (status === 'Accepted') {
    <div class="rsvp-banner rsvp-accepted">
      <span class="banner-icon">🎉</span>
      <div>
        <p class="banner-title">You're coming!</p>
        <p class="banner-sub">We can't wait to see you.</p>
      </div>
    </div>
    <button class="btn-change" (click)="rsvpChange.emit('Pending' as any)">Change my response</button>
  }

  @if (status === 'Declined') {
    <div class="rsvp-banner rsvp-declined">
      <span class="banner-icon">😔</span>
      <div>
        <p class="banner-title">Sorry you can't make it</p>
        <p class="banner-sub">We'll miss you.</p>
      </div>
    </div>
    <button class="btn-change" (click)="rsvpChange.emit('Pending' as any)">Change my response</button>
  }

  @if (status === 'Tentative') {
    <div class="rsvp-banner rsvp-tentative">
      <span class="banner-icon">🤔</span>
      <div>
        <p class="banner-title">We've noted your maybe</p>
        <p class="banner-sub">Let us know if your plans change.</p>
      </div>
    </div>
    <button class="btn-change" (click)="rsvpChange.emit('Pending' as any)">Change my response</button>
  }
</div>
```

> **Note on `'Pending' as any`:** `GuestViewComponent` handles 'Pending' by resetting `rsvpStatus` signal locally — it never writes 'Pending' to the DB. The `rsvpChange` Output type is `'Accepted' | 'Declined' | 'Tentative'` but the parent checks for 'Pending' to show the buttons again. Alternatively, expand the Output type to include 'Pending'; either approach works.

- [ ] **Step 3: Create the CSS**

```css
/* src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.css */
.rsvp-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
}

.rsvp-heading {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.rsvp-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 320px;
}

.btn-accept {
  padding: 13px 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  font-weight: 700;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-accept:hover { opacity: 0.9; }

.btn-maybe {
  padding: 11px 20px;
  border-radius: 12px;
  background: transparent;
  border: 1.5px solid var(--color-border);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.btn-maybe:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-decline {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.83rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.15s;
}

.btn-decline:hover { color: var(--color-error); }

.rsvp-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 14px;
  width: 100%;
  max-width: 320px;
}

.rsvp-accepted { background: rgba(34, 197, 94, 0.12); border: 1.5px solid rgba(34, 197, 94, 0.3); }
.rsvp-declined { background: rgba(100, 116, 139, 0.1); border: 1.5px solid rgba(100, 116, 139, 0.25); }
.rsvp-tentative { background: rgba(234, 179, 8, 0.1); border: 1.5px solid rgba(234, 179, 8, 0.3); }

.banner-icon { font-size: 1.6rem; flex-shrink: 0; }

.banner-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text);
  margin: 0 0 2px;
}

.banner-sub {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.btn-change {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.15s;
}

.btn-change:hover { color: var(--color-primary); }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/guest-view/components/rsvp-buttons/
git commit -m "feat: add RsvpButtonsComponent with Pending/Accepted/Declined/Tentative states"
```

---

## Task 5: EventFormComponent

**Files:**
- Create: `src/app/features/host-dashboard/components/event-form/event-form.component.ts`
- Create: `src/app/features/host-dashboard/components/event-form/event-form.component.html`
- Create: `src/app/features/host-dashboard/components/event-form/event-form.component.css`

- [ ] **Step 1: Create the TypeScript file**

```typescript
// src/app/features/host-dashboard/components/event-form/event-form.component.ts
import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../../../core/services/supabase/supabase';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.css']
})
export class EventFormComponent {
  @Input() hostId!: string;
  @Output() eventCreated = new EventEmitter<any>();

  private supabase = inject(Supabase);

  isSubmitting = signal(false);
  fields = { title: '', date: '', location: '' };

  async handleSubmit() {
    if (!this.fields.title.trim()) return;
    this.isSubmitting.set(true);
    try {
      const event = await this.supabase.createEvent(
        this.hostId,
        this.fields.title,
        this.fields.date,
        this.fields.location
      );
      this.eventCreated.emit(event);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
```

- [ ] **Step 2: Create the HTML template**

```html
<!-- src/app/features/host-dashboard/components/event-form/event-form.component.html -->
<div class="form-card">
  <p class="step-eyebrow">Step 1 of 1</p>
  <h2 class="form-title">Create Your Event</h2>
  <p class="form-sub">Fill in the details and launch your event in seconds.</p>

  <form (ngSubmit)="handleSubmit()">
    <div class="field-group">
      <label class="field-label">Event Name <span class="required">*</span></label>
      <input
        class="field-input"
        [(ngModel)]="fields.title"
        name="title"
        placeholder="e.g. Priya & Kamal's Wedding"
        required
      />
    </div>

    <div class="field-group">
      <label class="field-label">Date &amp; Time</label>
      <input
        class="field-input"
        type="datetime-local"
        [(ngModel)]="fields.date"
        name="date"
      />
    </div>

    <div class="field-group">
      <label class="field-label">Location</label>
      <input
        class="field-input"
        [(ngModel)]="fields.location"
        name="location"
        placeholder="e.g. The Grand Ballroom, Colombo"
      />
    </div>

    <button class="submit-btn" type="submit" [disabled]="isSubmitting() || !fields.title.trim()">
      {{ isSubmitting() ? 'Launching...' : '🚀 Launch Event' }}
    </button>
  </form>
</div>
```

- [ ] **Step 3: Create the CSS**

```css
/* src/app/features/host-dashboard/components/event-form/event-form.component.css */
.form-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 36px 40px;
  max-width: 520px;
  margin: 48px auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.07);
}

.step-eyebrow {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  margin: 0 0 10px;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 6px;
  letter-spacing: -0.02em;
}

.form-sub {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 28px;
}

.field-group {
  margin-bottom: 18px;
}

.field-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.required {
  color: var(--color-accent);
}

.field-input {
  width: 100%;
  padding: 11px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
  padding: 13px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-accent), #ea6c06);
  color: white;
  font-size: 0.95rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
}

.submit-btn:hover:not(:disabled) { opacity: 0.92; }
.submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/host-dashboard/components/event-form/
git commit -m "feat: add EventFormComponent for creating new events"
```

---

## Task 6: Update SupabaseService

**Files:**
- Modify: `src/app/core/services/supabase/supabase.ts`

The existing `addGuest` only accepts `displayName` and `phoneNumber`. We need to add optional `email`, add `getEventByHost`, and add `sendEmailInvitation`.

- [ ] **Step 1: Replace `addGuest`, add `getEventByHost` and `sendEmailInvitation`**

Replace the existing `addGuest` method (lines 106–119) and add two new methods. Full updated file:

```typescript
// src/app/core/services/supabase/supabase.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Supabase {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  get client() {
    return this.supabase;
  }

  async getEventDetails(eventId: string) {
    const { data, error } = await this.supabase
      .from('events').select('*').eq('id', eventId).single();
    if (error) throw error;
    return data;
  }

  async getEventByHost(hostId: string) {
    const { data, error } = await this.supabase
      .from('events').select('*').eq('host_id', hostId).limit(1);
    if (error) throw error;
    return data ?? [];
  }

  async updateRsvpStatus(guestId: string, status: string, dietary?: string, count: number = 1) {
    const { data, error } = await this.supabase
      .from('rsvps')
      .update({ status, dietary_preference: dietary, attending_count: count, updated_at: new Date().toISOString() })
      .eq('guest_id', guestId);
    if (error) throw error;
    return data;
  }

  async signInWithMagicLink(email: string) {
    const { data, error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` }
    });
    if (error) throw error;
    return data;
  }

  async getCurrentUser() {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return session?.user || null;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async createEvent(hostId: string, title: string, date: string, location: string) {
    const { data, error } = await this.supabase
      .from('events')
      .insert([{ host_id: hostId, title, event_date: date, location_text: location }])
      .select().single();
    if (error) throw error;
    return data;
  }

  async getGuests(eventId: string) {
    const { data, error } = await this.supabase
      .from('guests')
      .select('*, rsvps(status)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async addGuest(eventId: string, displayName: string, phoneNumber?: string, email?: string) {
    const { data, error } = await this.supabase
      .from('guests')
      .insert([{
        event_id: eventId,
        display_name: displayName,
        phone_number: phoneNumber || null,
        email: email || null
      }])
      .select().single();
    if (error) throw error;
    return data;
  }

  async sendEmailInvitation(guestId: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('send-invite-email', {
      body: { guestId }
    });
    if (error) throw error;
  }
}
```

- [ ] **Step 2: Apply Supabase schema migration**

Open the Supabase dashboard → SQL Editor and run:

```sql
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS email text;
```

> This ensures the `guests` table accepts the new optional columns. `phone_number` may already exist — `IF NOT EXISTS` makes this safe to run.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/supabase/supabase.ts
git commit -m "feat: extend SupabaseService — addGuest accepts email, add getEventByHost + sendEmailInvitation"
```

---

## Task 7: AddGuestFormComponent

**Files:**
- Create: `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.ts`
- Create: `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.spec.ts`
- Create: `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.html`
- Create: `src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.css`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddGuestFormComponent } from './add-guest-form.component';
import { Supabase } from '../../../../core/services/supabase/supabase';

const mockSupabase = { addGuest: jasmine.createSpy('addGuest').and.resolveTo({}) };

describe('AddGuestFormComponent — validation', () => {
  let component: AddGuestFormComponent;
  let fixture: ComponentFixture<AddGuestFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddGuestFormComponent],
      providers: [{ provide: Supabase, useValue: mockSupabase }]
    }).compileComponents();
    fixture = TestBed.createComponent(AddGuestFormComponent);
    component = fixture.componentInstance;
    component.eventId = 'test-event-id';
    fixture.detectChanges();
  });

  it('phoneError is null when phone is empty', () => {
    component.phone = '';
    component.validatePhone();
    expect(component.phoneError()).toBeNull();
  });

  it('phoneError is set when phone has invalid format', () => {
    component.phone = 'abc123';
    component.validatePhone();
    expect(component.phoneError()).toBeTruthy();
  });

  it('phoneError is null when phone has valid format', () => {
    component.phone = '+94 77 234 5678';
    component.validatePhone();
    expect(component.phoneError()).toBeNull();
  });

  it('emailError is null when email is empty', () => {
    component.email = '';
    component.validateEmail();
    expect(component.emailError()).toBeNull();
  });

  it('emailError is set when email format is invalid', () => {
    component.email = 'not-an-email';
    component.validateEmail();
    expect(component.emailError()).toBeTruthy();
  });

  it('emailError is null when email format is valid', () => {
    component.email = 'user@example.com';
    component.validateEmail();
    expect(component.emailError()).toBeNull();
  });

  it('canSubmit is true when name set, phone empty, email empty', () => {
    component.name = 'Priya';
    component.phone = '';
    component.email = '';
    expect(component.canSubmit()).toBeTrue();
  });

  it('canSubmit is false when name set but phone has invalid format', () => {
    component.name = 'Priya';
    component.phone = 'bad';
    component.validatePhone();
    expect(component.canSubmit()).toBeFalse();
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
ng test --include="src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.spec.ts" --watch=false
```
Expected: `Cannot find module './add-guest-form.component'`

- [ ] **Step 3: Create the TypeScript file**

```typescript
// src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.ts
import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../../../core/services/supabase/supabase';

const PHONE_REGEX = /^\+?[\d\s\-()]{7,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-add-guest-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-guest-form.component.html',
  styleUrls: ['./add-guest-form.component.css']
})
export class AddGuestFormComponent {
  @Input() eventId!: string;
  @Output() guestAdded = new EventEmitter<void>();

  private supabase = inject(Supabase);

  name = '';
  phone = '';
  email = '';

  phoneError = signal<string | null>(null);
  emailError = signal<string | null>(null);
  isSubmitting = signal(false);

  validatePhone() {
    if (!this.phone.trim()) { this.phoneError.set(null); return; }
    this.phoneError.set(PHONE_REGEX.test(this.phone.trim()) ? null : 'Enter a valid phone number (e.g. +94 77 234 5678)');
  }

  validateEmail() {
    if (!this.email.trim()) { this.emailError.set(null); return; }
    this.emailError.set(EMAIL_REGEX.test(this.email.trim()) ? null : 'Enter a valid email address');
  }

  canSubmit(): boolean {
    return !!this.name.trim() && !this.phoneError() && !this.emailError();
  }

  async handleSubmit() {
    this.validatePhone();
    this.validateEmail();
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);
    try {
      await this.supabase.addGuest(
        this.eventId,
        this.name.trim(),
        this.phone.trim() || undefined,
        this.email.trim() || undefined
      );
      this.name = '';
      this.phone = '';
      this.email = '';
      this.phoneError.set(null);
      this.emailError.set(null);
      this.guestAdded.emit();
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
ng test --include="src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.spec.ts" --watch=false
```
Expected: 8 specs, 0 failures

- [ ] **Step 5: Create the HTML template**

```html
<!-- src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.html -->
<div class="ag-card">
  <h3 class="ag-title">➕ Add Guest</h3>

  <form (ngSubmit)="handleSubmit()">
    <div class="field-group">
      <label class="field-label">Full Name <span class="required">*</span></label>
      <input
        class="field-input"
        [(ngModel)]="name"
        name="gname"
        placeholder="e.g. Priya Sharma"
        required
      />
    </div>

    <div class="divider"></div>

    <div class="field-group">
      <label class="field-label">
        Phone <span class="opt-badge">Optional</span>
      </label>
      <input
        class="field-input"
        [(ngModel)]="phone"
        name="gphone"
        placeholder="+94 77 000 0000"
        (blur)="validatePhone()"
        [class.input-valid]="phone && !phoneError()"
        [class.input-invalid]="phoneError()"
      />
      @if (!phone) {
        <p class="hint hint-neutral">Leave blank — invite link can be shared manually.</p>
      } @else if (phoneError()) {
        <p class="hint hint-error">✕ {{ phoneError() }}</p>
      } @else {
        <p class="hint hint-valid">✓ Looks like a valid phone number</p>
      }
    </div>

    <div class="field-group">
      <label class="field-label">
        Email <span class="opt-badge">Optional</span>
      </label>
      <input
        class="field-input"
        type="email"
        [(ngModel)]="email"
        name="gemail"
        placeholder="guest@example.com"
        (blur)="validateEmail()"
        [class.input-valid]="email && !emailError()"
        [class.input-invalid]="emailError()"
      />
      @if (!email) {
        <p class="hint hint-neutral">Add email to enable "Send Invite" action.</p>
      } @else if (emailError()) {
        <p class="hint hint-error">✕ {{ emailError() }}</p>
      } @else {
        <p class="hint hint-valid">✓ "Send Email" action will appear for this guest.</p>
      }
    </div>

    <button class="submit-btn" type="submit" [disabled]="isSubmitting() || !canSubmit()">
      {{ isSubmitting() ? 'Adding...' : '+ Add to Guest List' }}
    </button>

    @if (phoneError() || emailError()) {
      <p class="submit-hint">Fix the format above to continue</p>
    }
  </form>
</div>
```

- [ ] **Step 6: Create the CSS**

```css
/* src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.css */
.ag-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  height: fit-content;
}

.ag-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 18px;
}

.field-group { margin-bottom: 14px; }

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 5px;
}

.required { color: var(--color-accent); }

.opt-badge {
  background: var(--color-bg);
  color: var(--color-text-muted);
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  border: 1px solid var(--color-border);
}

.field-input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.field-input.input-valid {
  border-color: var(--color-success);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.field-input.input-invalid {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.hint {
  font-size: 0.68rem;
  margin: 5px 0 0;
  line-height: 1.4;
}

.hint-neutral { color: var(--color-text-muted); opacity: 0.7; }
.hint-valid   { color: var(--color-success); }
.hint-error   { color: var(--color-error); }

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 12px 0;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
  padding: 11px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  font-size: 0.875rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  box-shadow: 0 3px 10px rgba(14, 165, 233, 0.3);
}

.submit-btn:hover:not(:disabled) { opacity: 0.9; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.submit-hint {
  text-align: center;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin: 6px 0 0;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/features/host-dashboard/components/add-guest-form/
git commit -m "feat: add AddGuestFormComponent with optional phone+email, format-only blur validation"
```

---

## Task 8: GuestTableComponent

**Files:**
- Create: `src/app/features/host-dashboard/components/guest-table/guest-table.component.ts`
- Create: `src/app/features/host-dashboard/components/guest-table/guest-table.component.html`
- Create: `src/app/features/host-dashboard/components/guest-table/guest-table.component.css`

- [ ] **Step 1: Create the TypeScript file**

```typescript
// src/app/features/host-dashboard/components/guest-table/guest-table.component.ts
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
```

- [ ] **Step 2: Create the HTML template**

```html
<!-- src/app/features/host-dashboard/components/guest-table/guest-table.component.html -->
<div class="gt-card">
  <h3 class="gt-title">Guest Network <span class="guest-count">{{ guests.length }}</span></h3>

  @if (guests.length === 0) {
    <p class="empty-msg">No guests yet. Start building your list.</p>
  } @else {
    <div class="table-wrap">
      <table class="guest-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Contact</th>
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

              <td class="contact-icons">
                @if (guest.phone_number) { <span title="{{ guest.phone_number }}">📱</span> }
                @if (guest.email)        { <span title="{{ guest.email }}">✉️</span> }
              </td>

              <td class="action-cell">
                <button class="btn-copy" (click)="copyLink.emit(guest.id)">🔗 Copy</button>

                @if (guest.email) {
                  <button
                    class="btn-email"
                    [disabled]="sendingId() === guest.id"
                    (click)="onSendEmail(guest.id)"
                  >
                    {{ sendingId() === guest.id ? 'Sending…' : '✉ Email' }}
                  </button>
                } @else {
                  <span class="no-email">no email</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
```

- [ ] **Step 3: Create the CSS**

```css
/* src/app/features/host-dashboard/components/guest-table/guest-table.component.css */
.gt-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.gt-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.guest-count {
  background: var(--color-primary);
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 99px;
}

.empty-msg {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  text-align: center;
  padding: 32px 0;
}

.table-wrap { overflow-x: auto; }

.guest-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.guest-table th {
  text-align: left;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  padding: 0 12px 10px;
  border-bottom: 1px solid var(--color-border);
}

.guest-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: middle;
}

.guest-table tr:last-child td { border-bottom: none; }

.name-cell { font-weight: 600; }

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 0.7rem;
  font-weight: 700;
}

.badge-accepted  { background: rgba(34,197,94,0.15);  color: #16a34a; }
.badge-declined  { background: rgba(239,68,68,0.12);  color: #dc2626; }
.badge-tentative { background: rgba(234,179,8,0.12);  color: #ca8a04; }
.badge-pending   { background: var(--color-bg);       color: var(--color-text-muted); border: 1px solid var(--color-border); }

[data-theme="dark"] .badge-accepted  { color: #4ade80; }
[data-theme="dark"] .badge-declined  { color: #f87171; }
[data-theme="dark"] .badge-tentative { color: #fde047; }

.contact-icons {
  display: flex;
  gap: 6px;
  font-size: 1rem;
}

.action-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-copy, .btn-email {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1.5px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.btn-copy:hover  { border-color: var(--color-primary); color: var(--color-primary); }
.btn-email:hover { border-color: var(--color-accent);  color: var(--color-accent); }
.btn-email:disabled { opacity: 0.5; cursor: not-allowed; }

.no-email {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  opacity: 0.5;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/host-dashboard/components/guest-table/
git commit -m "feat: add GuestTableComponent with copy/email actions and RSVP badges"
```

---

## Task 9: Restyle LoginComponent

**Files:**
- Modify: `src/app/features/auth/login.component.ts` (full rewrite of template + styles)

- [ ] **Step 1: Replace the component file**

```typescript
// src/app/features/auth/login.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <main class="login-page">
      <div class="login-card">

        <div class="logo-mark">T</div>
        <h1 class="login-title">Welcome back</h1>
        <p class="login-sub">Enter your email to receive a secure magic link.</p>

        @if (!isSent()) {
          <form (ngSubmit)="handleLogin()">
            <div class="field-group">
              <label class="field-label">Email address</label>
              <input
                class="field-input"
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="you@example.com"
                [disabled]="isLoading()"
                autocomplete="email"
              />
            </div>
            <button class="submit-btn" type="submit" [disabled]="isLoading() || !email">
              {{ isLoading() ? 'Sending…' : '✉ Send Magic Link' }}
            </button>
          </form>
          <a routerLink="/" class="back-link">← Back to home</a>
        } @else {
          <div class="sent-card">
            <div class="sent-icon">✅</div>
            <h2 class="sent-title">Check your inbox!</h2>
            <p class="sent-sub">We sent a secure link to</p>
            <span class="email-chip">{{ email }}</span>
            <p class="sent-note">Link expires in 60 minutes.</p>
            <button class="resend-btn" (click)="handleLogin()">Resend link</button>
          </div>
        }

      </div>
    </main>
  `,
  styles: [`
    .login-page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--color-bg);
      padding: 24px;
    }

    .login-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 20px;
      padding: 40px 36px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
      text-align: center;
    }

    .logo-mark {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
      color: white;
      font-size: 1.3rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .login-title {
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 8px;
      letter-spacing: -0.02em;
    }

    .login-sub {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin: 0 0 28px;
    }

    .field-group { text-align: left; margin-bottom: 16px; }

    .field-label {
      display: block;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: 6px;
    }

    .field-input {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid var(--color-border);
      border-radius: 10px;
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .field-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
    }

    .submit-btn {
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-accent), #ea6c06);
      color: white;
      font-size: 0.95rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: opacity 0.15s;
      box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
      margin-top: 4px;
    }

    .submit-btn:hover:not(:disabled) { opacity: 0.92; }
    .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .back-link {
      display: inline-block;
      margin-top: 20px;
      font-size: 0.83rem;
      color: var(--color-text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }

    .back-link:hover { color: var(--color-primary); }

    .sent-card { padding: 8px 0; }

    .sent-icon { font-size: 2.5rem; margin-bottom: 14px; }

    .sent-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 8px;
    }

    .sent-sub {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin: 0 0 10px;
    }

    .email-chip {
      display: inline-block;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 99px;
      padding: 4px 14px;
      font-size: 0.83rem;
      font-weight: 600;
      color: var(--color-primary);
    }

    .sent-note {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin: 12px 0 16px;
    }

    .resend-btn {
      background: none;
      border: none;
      color: var(--color-primary);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  `]
})
export class LoginComponent {
  private supabase = inject(Supabase);

  email = '';
  isLoading = signal(false);
  isSent = signal(false);

  async handleLogin() {
    if (!this.email) return;
    try {
      this.isLoading.set(true);
      await this.supabase.signInWithMagicLink(this.email);
      this.isSent.set(true);
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to send magic link. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/auth/login.component.ts
git commit -m "feat: restyle LoginComponent — premium card, sent state, back link"
```

---

## Task 10: Restyle LandingComponent

**Files:**
- Modify: `src/app/features/landing/landing.component.ts`

- [ ] **Step 1: Replace the component file**

```typescript
// src/app/features/landing/landing.component.ts
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterModule, HeaderComponent],
  template: `
    <app-header variant="landing"></app-header>

    <main class="landing-main">

      <!-- Hero -->
      <section class="hero">
        <div class="hero-glow glow-1"></div>
        <div class="hero-glow glow-2"></div>
        <div class="hero-inner">
          <span class="eyebrow">
            <span class="pulse-dot"></span>
            Now in Beta
          </span>
          <h1 class="hero-title">
            Invitations that<br><span class="accent">make an impression</span>
          </h1>
          <p class="hero-sub">
            One-tap RSVP links. Real-time responses. Premium design your guests will love.
          </p>
          <div class="hero-ctas">
            <a routerLink="/login" class="cta-primary">Get Started Free →</a>
            <a href="#features" class="cta-ghost">See how it works</a>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features" id="features">
        <div class="features-inner">
          <div class="feature-card">
            <div class="feat-icon" style="background:rgba(14,165,233,0.12);color:#0ea5e9">🔗</div>
            <h3>One-tap RSVP</h3>
            <p>Guests tap a link and respond instantly — no app, no account needed.</p>
          </div>
          <div class="feature-card">
            <div class="feat-icon" style="background:rgba(249,115,22,0.12);color:#f97316">⚡</div>
            <h3>Real-time updates</h3>
            <p>Watch your guest list fill up live. Copies update the moment guests respond.</p>
          </div>
          <div class="feature-card">
            <div class="feat-icon" style="background:rgba(20,184,166,0.12);color:#14b8a6">🎨</div>
            <h3>Premium look</h3>
            <p>Beautifully designed invitations that impress from the first tap.</p>
          </div>
        </div>
      </section>

    </main>

    <!-- Footer -->
    <footer class="site-footer">
      <div class="footer-inner">
        <span class="footer-logo">TapInvite</span>
        <span class="footer-copy">© 2026 TapInvite. All rights reserved.</span>
        <a routerLink="/login" class="footer-cta">Create Your Event →</a>
      </div>
    </footer>
  `,
  styles: [`
    .landing-main { overflow: hidden; }

    /* Hero */
    .hero {
      position: relative;
      padding: 96px 24px 80px;
      text-align: center;
      overflow: hidden;
    }

    .hero-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }

    .hero-glow.glow-1 {
      width: 500px; height: 500px;
      background: rgba(14, 165, 233, 0.12);
      top: -100px; left: 50%; transform: translateX(-60%);
    }

    .hero-glow.glow-2 {
      width: 300px; height: 300px;
      background: rgba(249, 115, 22, 0.08);
      bottom: 0; right: 10%;
    }

    .hero-inner {
      position: relative;
      max-width: 680px;
      margin: 0 auto;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 99px;
      padding: 6px 16px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: 24px;
    }

    .pulse-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.6; transform: scale(1.3); }
    }

    .hero-title {
      font-size: clamp(2rem, 5vw, 3.2rem);
      font-weight: 800;
      color: var(--color-text);
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin: 0 0 20px;
    }

    .accent { color: var(--color-primary); }

    .hero-sub {
      font-size: 1.05rem;
      color: var(--color-text-muted);
      max-width: 500px;
      margin: 0 auto 36px;
      line-height: 1.65;
    }

    .hero-ctas {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .cta-primary {
      padding: 13px 28px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-accent), #ea6c06);
      color: white;
      font-weight: 700;
      font-size: 0.95rem;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(249,115,22,0.35);
      transition: opacity 0.15s;
    }

    .cta-primary:hover { opacity: 0.9; }

    .cta-ghost {
      padding: 13px 24px;
      border-radius: 12px;
      border: 1.5px solid var(--color-border);
      color: var(--color-text-muted);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      transition: border-color 0.15s, color 0.15s;
    }

    .cta-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }

    /* Features */
    .features { padding: 64px 24px 80px; }

    .features-inner {
      max-width: 900px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }

    .feature-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 18px;
      padding: 28px 24px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }

    .feat-icon {
      width: 48px; height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      margin-bottom: 16px;
    }

    .feature-card h3 {
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-text);
      margin: 0 0 8px;
    }

    .feature-card p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.6;
      margin: 0;
    }

    /* Footer */
    .site-footer {
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      padding: 24px;
    }

    .footer-inner {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .footer-logo { font-weight: 800; color: var(--color-text); }

    .footer-copy { font-size: 0.8rem; color: var(--color-text-muted); }

    .footer-cta {
      padding: 8px 18px;
      border-radius: 10px;
      background: var(--color-primary);
      color: white;
      font-size: 0.83rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }

    .footer-cta:hover { background: var(--color-primary-dark); }
  `]
})
export class LandingComponent {}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/landing/landing.component.ts
git commit -m "feat: restyle LandingComponent — hero, features, footer, HeaderComponent integrated"
```

---

## Task 11: Restyle GuestViewComponent

**Files:**
- Modify: `src/app/features/guest-view/components/guest-view.component.ts`
- Modify: `src/app/features/guest-view/components/guest-view.component.html`
- Modify: `src/app/features/guest-view/components/guest-view.component.css`

- [ ] **Step 1: Update the TypeScript — add RsvpButtonsComponent import**

```typescript
// src/app/features/guest-view/components/guest-view.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Supabase } from '../../../core/services/supabase/supabase';
import { RsvpButtonsComponent, RsvpStatus } from './rsvp-buttons/rsvp-buttons.component';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

interface EventData {
  id: string;
  title: string;
  event_date: string;
  location_text: string;
  google_maps_url?: string;
}

interface GuestData {
  id: string;
  display_name: string;
}

@Component({
  selector: 'app-guest-view',
  standalone: true,
  imports: [CommonModule, LottieComponent, RsvpButtonsComponent],
  templateUrl: './guest-view.component.html',
  styleUrls: ['./guest-view.component.css']
})
export class GuestViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private supabase = inject(Supabase);

  eventId   = signal<string | null>(null);
  guestId   = signal<string | null>(null);
  eventData = signal<EventData | null>(null);
  guestData = signal<GuestData | null>(null);
  rsvpStatus = signal<RsvpStatus>('Pending');
  isLoading  = signal(true);
  hasError   = signal(false);

  lottieOptions: AnimationOptions = {
    path: 'assets/animations/celebration4.json',
    loop: true,
    autoplay: true
  };

  ngOnInit() {
    this.eventId.set(this.route.snapshot.paramMap.get('eventId'));
    this.guestId.set(this.route.snapshot.paramMap.get('guestId'));
    if (this.eventId() && this.guestId()) {
      this.loadInvitationData();
    } else {
      this.hasError.set(true);
      this.isLoading.set(false);
    }
  }

  async loadInvitationData() {
    try {
      this.isLoading.set(true);
      const [eventRes, guestRes, rsvpRes] = await Promise.all([
        this.supabase.client.from('events').select('*').eq('id', this.eventId()).single(),
        this.supabase.client.from('guests').select('*').eq('id', this.guestId()).single(),
        this.supabase.client.from('rsvps').select('*').eq('guest_id', this.guestId()).single()
      ]);
      if (eventRes.error || guestRes.error) throw new Error('Invitation not found');
      this.eventData.set(eventRes.data);
      this.guestData.set(guestRes.data);
      if (rsvpRes.data?.status) this.rsvpStatus.set(rsvpRes.data.status as RsvpStatus);
    } catch (error) {
      console.error(error);
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleRsvpChange(status: 'Accepted' | 'Declined' | 'Tentative' | any) {
    if (status === 'Pending') { this.rsvpStatus.set('Pending'); return; }
    const guestId = this.guestId();
    if (!guestId) return;
    try {
      this.isLoading.set(true);
      await this.supabase.updateRsvpStatus(guestId, status);
      this.rsvpStatus.set(status as RsvpStatus);
    } catch (error) {
      console.error(error);
      alert('Failed to update RSVP. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
```

- [ ] **Step 2: Replace the HTML template**

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
    </div>
  }

  @else {
    <div class="invitation-card fade-up">

      <!-- Top band -->
      <div class="card-band">
        <span class="event-badge">You're Invited</span>
        <p class="greeting">Dear {{ guestData()?.display_name }},</p>
      </div>

      <!-- Content -->
      <div class="card-body">

        <div class="animation-wrap">
          <ng-lottie [options]="lottieOptions" width="160px" height="160px"></ng-lottie>
        </div>

        <h1 class="event-name">{{ eventData()?.title }}</h1>

        <div class="detail-rows">
          <div class="detail-row">
            <span class="detail-icon">📅</span>
            <div>
              <p class="detail-primary">{{ eventData()?.event_date | date:'EEEE, MMMM d, y' }}</p>
              <p class="detail-secondary">{{ eventData()?.event_date | date:'shortTime' }}</p>
            </div>
          </div>

          <div class="detail-row">
            <span class="detail-icon">📍</span>
            <div>
              <p class="detail-primary">{{ eventData()?.location_text }}</p>
              @if (eventData()?.google_maps_url) {
                <a [href]="eventData()?.google_maps_url" target="_blank" class="map-link">View on Google Maps →</a>
              }
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <app-rsvp-buttons
          [status]="rsvpStatus()"
          (rsvpChange)="handleRsvpChange($event)"
        ></app-rsvp-buttons>

      </div>
    </div>
  }

</main>
```

- [ ] **Step 3: Replace the CSS**

```css
/* src/app/features/guest-view/components/guest-view.component.css */
.guest-page {
  min-height: 100vh;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* Loading / Error states */
.status-wrap {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 40px; height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.status-text {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.status-wrap.error { color: var(--color-text); }
.err-icon { font-size: 2.5rem; }
.status-wrap h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }
.status-wrap p { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; }

/* Invitation card */
.invitation-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  max-width: 440px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.1);
}

.card-band {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  padding: 28px 28px 24px;
}

[data-theme="dark"] .card-band {
  background: linear-gradient(135deg, #0c2a4a, #0f1f3d);
  border-bottom: 1px solid var(--color-primary);
}

.event-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: 99px;
  margin-bottom: 12px;
}

.greeting {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin: 0;
}

.card-body { padding: 28px; }

.animation-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.event-name {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text);
  text-align: center;
  margin: 0 0 24px;
  letter-spacing: -0.02em;
}

.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.detail-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.detail-primary {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 2px;
}

.detail-secondary {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.map-link {
  font-size: 0.78rem;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}

.map-link:hover { text-decoration: underline; }

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 24px 0;
}

/* Animations */
.fade-in  { animation: fadeIn  0.3s ease; }
.fade-up  { animation: fadeUp  0.4s ease; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/guest-view/components/
git commit -m "feat: restyle GuestViewComponent — premium card, RsvpButtonsComponent integrated"
```

---

## Task 12: Rewrite HostDashboardComponent (Orchestrator)

**Files:**
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.ts`
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.html`
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.css`

- [ ] **Step 1: Replace the TypeScript (orchestrator only — no form/table logic)**

```typescript
// src/app/features/host-dashboard/components/host-dashboard.component.ts
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
```

- [ ] **Step 2: Replace the HTML template**

```html
<!-- src/app/features/host-dashboard/components/host-dashboard.component.html -->
<app-header variant="dashboard" (logoutClick)="handleLogout()"></app-header>

<app-toast [toasts]="toasts()"></app-toast>

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
      ></app-add-guest-form>

      <app-guest-table
        [guests]="guests()"
        (copyLink)="copyLink($event)"
        (sendEmail)="sendEmailInvitation($event)"
      ></app-guest-table>
    </div>
  }

</main>
```

- [ ] **Step 3: Replace the CSS**

```css
/* src/app/features/host-dashboard/components/host-dashboard.component.css */
.dash-main {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Event strip */
.event-strip {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.event-strip-inner {
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.event-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--color-text);
  margin: 0 0 4px;
  letter-spacing: -0.02em;
}

.event-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.live-badge {
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 99px;
  border: 1px solid rgba(34, 197, 94, 0.25);
  white-space: nowrap;
}

[data-theme="dark"] .live-badge {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  border-color: rgba(74, 222, 128, 0.2);
}

/* Dashboard grid */
.dash-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 768px) {
  .dash-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
ng build --configuration=development 2>&1 | tail -20
```
Expected: `Build at: ... - Time: ...ms` with no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/features/host-dashboard/components/
git commit -m "feat: rewrite HostDashboardComponent as orchestrator — sub-components wired up"
```

---

## Task 13: Smoke Test (Manual)

- [ ] **Step 1: Start the dev server**

```bash
ng serve
```

- [ ] **Step 2: Test each route**

| Route | Check |
|-------|-------|
| `http://localhost:4200/` | Landing renders with header, hero, features, footer |
| Header theme toggle | Click ☀️/🌙 — page switches light/dark; refresh — preference persists |
| "Get Started Free →" | Navigates to `/login` |
| `/login` | Premium card renders; enter email → submit → shows sent state |
| `/w/[any-uuid]/[any-uuid]` | Shows error state (expected — no real IDs) |
| `/dashboard` | Redirects to `/login` (no auth) |

- [ ] **Step 3: Dark mode persistence check**

1. Toggle to dark mode on landing
2. Reload page
3. Confirm dark mode is applied before Angular hydrates (CSS persists via `localStorage` restored in `ThemeService` constructor)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete UI/UX overhaul — Sky Blue + Slate Premium design system"
```

---

## Self-Review Notes

- **Spec §5 HeaderComponent:** `variant='landing'` shows Features + Pricing nav links ✓ (Task 3)
- **Spec §6 ToastComponent:** Fixed position top-right, auto-dismiss 3s ✓ (Task 2) — auto-dismiss is in `HostDashboardComponent.showToast()` which already had this pattern
- **Spec §7.3 RsvpButtonsComponent:** All 4 states implemented ✓ (Task 4)
- **Spec §7.4 AddGuestFormComponent:** Phone regex `/^\+?[\d\s\-()]{7,15}$/`, format-only, blur-triggered, empty = no error ✓ (Task 7)
- **Spec §8 Data flow:** `guestAdded → loadGuests`, `copyLink/sendEmail → orchestrator` ✓ (Task 12)
- **Spec §9 sendEmailInvitation:** Calls `supabase.functions.invoke`, dashboard catches and toasts error ✓ (Tasks 6 + 12)
- **Spec §10 Global styles:** CSS custom properties in `styles.css` before all other tasks ✓ (Task 0)
- **Type consistency:** `Toast` interface exported from `toast.component.ts`, imported in `host-dashboard.component.ts` ✓; `RsvpStatus` exported from `rsvp-buttons.component.ts`, imported in `guest-view.component.ts` ✓; `getEventByHost` defined in Task 6, used in Task 12 ✓
