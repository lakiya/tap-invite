# TapInvite UI/UX Overhaul — Design Spec
**Date:** 2026-06-13  
**Status:** Approved  

---

## 1. Overview

A full UI/UX upgrade of the TapInvite Angular 22 app using the **Sky Blue + Slate Premium** direction (Direction C). Introduces a light/dark theme system, a shared `HeaderComponent`, and splits the host dashboard into focused single-responsibility sub-components following Angular best practices.

---

## 2. Design System

### 2.1 Color Tokens

Applied via CSS custom properties on `:root` (light) and `[data-theme="dark"]` (dark). The `ThemeService` toggles the attribute on `document.documentElement`.

| Token | Light | Dark |
|---|---|---|
| `--color-primary` | `#0ea5e9` Sky Blue | `#38bdf8` brightened for dark bg |
| `--color-primary-dark` | `#0284c7` | `#0ea5e9` |
| `--color-accent` | `#f97316` Orange | `#fb923c` Orange (brighter) |
| `--color-bg` | `#f8fafc` Cool White | `#0b1120` Deep Navy |
| `--color-surface` | `#ffffff` | `#111827` |
| `--color-border` | `#e2e8f0` | `#1e293b` |
| `--color-text` | `#0f172a` | `#f1f5f9` |
| `--color-text-muted` | `#64748b` | `#94a3b8` |

### 2.2 Typography

System font stack — no external font load: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`

| Role | Size / Weight | Usage |
|---|---|---|
| Display | 3rem / 800 | Landing hero headline |
| H1 | 2rem / 800 | Page titles |
| H2 | 1.35rem / 700 | Section headings |
| Body | 0.9rem / 400 | Paragraphs, table cells |
| Label | 0.75rem / 600 uppercase | Form labels |
| Badge | 0.7rem / 700 | RSVP status badges |

### 2.3 RSVP Badge Colours

| Status | Light bg / text | Dark bg / text |
|---|---|---|
| Accepted | `#dcfce7` / `#16a34a` | `rgba(34,197,94,.15)` / `#4ade80` |
| Declined | `#fee2e2` / `#dc2626` | `rgba(239,68,68,.12)` / `#f87171` |
| Maybe | `#fef9c3` / `#ca8a04` | `rgba(234,179,8,.12)` / `#fde047` |
| Pending | `#f1f5f9` / `#64748b` | `rgba(255,255,255,.07)` / `#64748b` |

### 2.4 Shadows & Radius

- Cards: `border-radius: 16–20px`, `box-shadow: 0 8px 32px rgba(0,0,0,0.07)`
- Dark cards: `backdrop-filter: blur(16px)` + `inset 0 1px 0 rgba(255,255,255,0.06)`
- Buttons: `border-radius: 10–12px`
- Inputs: `border-radius: 9–10px`

---

## 3. Component Architecture (Approach B — Smart Domain Split)

```
src/app/
├── core/
│   └── services/
│       ├── supabase/supabase.ts          (existing)
│       └── theme/theme.service.ts        ← NEW
│
├── shared/
│   └── components/
│       ├── header/
│       │   ├── header.component.ts       ← NEW
│       │   ├── header.component.html     ← NEW
│       │   └── header.component.css      ← NEW
│       └── toast/
│           ├── toast.component.ts        ← NEW (extracted from dashboard)
│           ├── toast.component.html      ← NEW
│           └── toast.component.css       ← NEW
│
└── features/
    ├── landing/
    │   └── landing.component.ts          (restyled)
    ├── auth/
    │   └── login.component.ts            (restyled)
    ├── guest-view/
    │   └── components/
    │       ├── guest-view.component.*     (restyled)
    │       └── rsvp-buttons/
    │           ├── rsvp-buttons.component.ts   ← NEW
    │           ├── rsvp-buttons.component.html ← NEW
    │           └── rsvp-buttons.component.css  ← NEW
    └── host-dashboard/
        └── components/
            ├── host-dashboard.component.*       (restyled, orchestrator only)
            ├── event-form/
            │   ├── event-form.component.ts      ← NEW
            │   ├── event-form.component.html    ← NEW
            │   └── event-form.component.css     ← NEW
            ├── add-guest-form/
            │   ├── add-guest-form.component.ts  ← NEW
            │   ├── add-guest-form.component.html← NEW
            │   └── add-guest-form.component.css ← NEW
            └── guest-table/
                ├── guest-table.component.ts     ← NEW
                ├── guest-table.component.html   ← NEW
                └── guest-table.component.css    ← NEW
```

---

## 4. ThemeService

**File:** `src/app/core/services/theme/theme.service.ts`

**Responsibilities:**
- Read theme preference from `localStorage` on init (`key: 'tapinvite-theme'`, values: `'light' | 'dark'`)
- Apply `data-theme="dark"` attribute to `document.documentElement` when dark
- Expose `isDark = signal<boolean>(false)`
- Provide `toggle()` method that flips the signal, updates the DOM attribute, and persists to `localStorage`
- On init, fall back to the OS preference (`window.matchMedia('(prefers-color-scheme: dark)')`) if no stored value exists

**Interface:**
```typescript
isDark: Signal<boolean>
toggle(): void
```

**SSR note:** Wrap `localStorage` and `document` access with `isPlatformBrowser(platformId)` guard to prevent SSR crashes.

---

## 5. HeaderComponent

**File:** `src/app/shared/components/header/header.component.ts`  
**Used on:** Landing page, Host Dashboard

### Inputs / Outputs
```typescript
@Input() variant: 'landing' | 'dashboard' = 'landing'
@Output() logoutClick = new EventEmitter<void>()
```

### Behaviour
- `variant='landing'`: shows "Features" and "Pricing" nav links; hides logout button
- `variant='dashboard'`: shows logged-in user email and a Logout button; hides nav links; emits `logoutClick` when Logout is clicked
- Always shows the theme toggle
- Sticky positioning (`position: sticky; top: 0; z-index: 100`)
- Applies `backdrop-filter: blur(12px)` with a subtle bottom border on scroll

### Theme toggle
- Renders a pill toggle (44×24px)
- Light mode: grey pill, sun icon ☀️, knob left
- Dark mode: blue pill (`#1d4ed8`), moon icon 🌙, knob right
- Calls `themeService.toggle()` on click

---

## 6. ToastComponent

**File:** `src/app/shared/components/toast/toast.component.ts`  
**Used on:** Host Dashboard (via `HostDashboardComponent`)

### Interface
```typescript
// The Toast model (defined in toast.component.ts, exported)
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

@Input() toasts: Toast[] = []
```

### Behaviour
- Fixed position, top-right corner (`position: fixed; top: 72px; right: 16px`)
- Each toast: icon tile (✓ green / ✕ red) + message text + auto-dismiss after 3000ms
- Dark mode: glassmorphism style (`backdrop-filter: blur(16px)` + dark surface)
- Light mode: white card with shadow
- Stacks vertically with `gap: 8px`; new toasts slide in from the right

---

## 7. Pages

### 7.1 Landing Page

**File:** `src/app/features/landing/landing.component.ts`  
**Header:** `<app-header variant="landing">`  
**No footer component** — footer is inline within the landing template.

**Sections:**
1. `HeaderComponent` (sticky)
2. **Hero** — eyebrow badge (pulsing dot + "Now in Beta"), display headline with `--color-primary` accent span, subtext, two CTA buttons: primary Orange "Get Started Free →" (routes to `/login`) + ghost "See how it works"
3. **Features strip** — 3-column grid of feature cards (icon tile + heading + body). Icons: 🔗 One-tap RSVP (blue tile), ⚡ Real-time updates (orange tile), 🎨 Premium look (teal tile)
4. **Footer band** — dark background in light mode / glass border in dark. Logo left, copyright centre, "Create Your Event →" Sky Blue CTA right (routes to `/login`)

**Dark mode extras:** radial glow orbs behind hero (CSS only, no images)

---

### 7.2 Login Page

**File:** `src/app/features/auth/login.component.ts`  
**No header** — full-page centred layout.

**States:**

**Idle:**
- Full-page background: `--color-bg` with a subtle radial gradient behind the card
- Centred card: logo, "Welcome back" heading, subtitle, email input, Orange "✉ Send Magic Link" button
- Input focus: Sky Blue ring
- `[disabled]` on button when `isLoading()` or `!email`
- "← Back to home" link below card (routes to `/`)

**Sent:**
- Form replaced by success card: icon tile (✅ green in light / ✉️ blue-tint in dark), "Check your inbox!" heading, email chip showing the entered address, expiry note, "Resend link" text link

---

### 7.3 Guest Invitation View

**File:** `src/app/features/guest-view/components/guest-view.component.ts`  
**No header** — immersive full-page card.

**Structure:**
```
GuestViewComponent
  ├── Loading state   (isLoading signal)
  ├── Error state     (hasError signal)
  └── Invitation card
        ├── Card top band    (gradient, event name badge, greeting)
        ├── Detail rows      (date icon tile, location icon tile, Google Maps pill)
        └── RsvpButtonsComponent
```

**RsvpButtonsComponent:**
```typescript
@Input()  status: 'Pending' | 'Accepted' | 'Declined' | 'Tentative'
@Output() rsvpChange = new EventEmitter<'Accepted' | 'Declined' | 'Tentative'>()
```
- **Pending:** 3-button column — Sky Blue "✓ Accept with Joy", ghost "〜 Maybe", subtle text "✕ Regretfully Decline"
- **Accepted:** Green success banner, "You're coming! 🎉", "Change my response" text link
- **Declined:** Neutral grey banner, "Sorry you can't make it", "Change my response" text link
- **Tentative:** Amber banner, "We've noted your maybe", "Change my response" text link

**Card top band:**
- Light: Sky Blue gradient (`#0ea5e9 → #0284c7`)
- Dark: Deep navy tint (`#0c2a4a → #0f1f3d`) with Sky Blue bottom border

---

### 7.4 Host Dashboard

**File:** `src/app/features/host-dashboard/components/host-dashboard.component.ts`  
**Header:** `<app-header variant="dashboard" (logoutClick)="handleLogout()">`  

`HostDashboardComponent` is the **orchestrator only** — it holds state signals and delegates rendering to sub-components. It does not contain any form or table markup directly.

**States:**

**Loading:** Spinner card centred in `<main>`

**No event (EventFormComponent):**

```typescript
// event-form.component.ts
@Output() eventCreated = new EventEmitter<any>()
```
- Centred card, step eyebrow "Step 1 of 1", 3 inputs: Event Name (required), Date & Time (`datetime-local`), Location (text)
- Orange "🚀 Launch Event" submit button
- On success: emits `eventCreated` with the new event object

**Active dashboard:**
- **Event strip** at top: event name, date, location, "Live" badge
- **2-column grid**: `AddGuestFormComponent` (left, narrow) | `GuestTableComponent` (right, wider)
- `ToastComponent` fixed top-right

**AddGuestFormComponent:**
```typescript
@Input()  eventId: string
@Output() guestAdded = new EventEmitter<void>()
```
- Injects `SupabaseService` directly and calls `addGuest()` internally; emits `guestAdded` on success so the parent reloads the guest list
- 3 fields: Full Name (required), Phone (optional), Email (optional)
- **Validation:** only fires on blur, only if a value was entered
  - Phone regex: `/^\+?[\d\s\-()]{7,15}$/`
  - Email regex: standard RFC email pattern
  - Submit button disabled only if a field has an entered-but-invalid value
  - Empty phone + empty email → submit always allowed
- Hint text under each optional field (neutral grey when empty, green when valid, red when invalid)

**GuestTableComponent:**
```typescript
@Input()  guests: any[]
@Output() copyLink  = new EventEmitter<string>()   // guestId
@Output() sendEmail = new EventEmitter<string>()   // guestId
```
- Columns: Name | Status (badge) | Contact icons (📱 if phone exists, ✉️ if email exists) | Actions
- Actions per row:
  - "🔗 Copy" — always present, emits `copyLink`
  - "✉ Email" — present only if `guest.email` is truthy, emits `sendEmail`; disabled during send; muted "no email" label when absent

---

## 8. Data Flow — Host Dashboard

```
HostDashboardComponent
  │
  ├── ngOnInit → getCurrentUser() → fetchDashboardData()
  │
  ├── [activeEvent] signal ──→ EventFormComponent (shown when null)
  │                         └→ event-strip + grid (shown when set)
  │
  ├── [guests] signal ──→ GuestTableComponent @Input guests
  │
  ├── GuestTableComponent @Output copyLink   → copyLink(guestId) → navigator.clipboard → showToast()
  ├── GuestTableComponent @Output sendEmail  → sendEmailInvitation(guestId) → supabase fn → showToast()
  ├── AddGuestFormComponent @Output guestAdded → loadGuests(activeEvent().id)
  └── EventFormComponent @Output eventCreated → activeEvent.set(event)
```

---

## 9. Supabase — sendEmailInvitation

A new method on `SupabaseService`:

```typescript
async sendEmailInvitation(guestId: string): Promise<void>
```

Implementation: calls a Supabase Edge Function `send-invite-email` with `{ guestId }`. The Edge Function constructs the invite URL (`/w/:eventId/:guestId`) and sends via an email provider (e.g. Resend). The service method throws on error; `HostDashboardComponent` catches and shows an error toast.

> **Out of scope for this sprint:** The Edge Function itself. The service method and dashboard wiring are in scope. The button will exist and call the method; if the function doesn't exist yet it will toast an error gracefully.

---

## 10. Global Styles

`src/styles.css` gets the CSS custom property definitions:

```css
:root {
  --color-primary: #0ea5e9;
  --color-primary-dark: #0284c7;
  --color-accent: #f97316;
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
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
}

* { box-sizing: border-box; }
body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  margin: 0;
  transition: background 0.2s ease, color 0.2s ease;
}
```

All component CSS files use these variables — no hardcoded colour values except inside the variable definitions themselves.

---

## 11. Build Order

1. `ThemeService` — no dependencies
2. `ToastComponent` — no dependencies  
3. `HeaderComponent` — depends on `ThemeService`
4. `RsvpButtonsComponent` — no dependencies
5. `EventFormComponent` — no dependencies
6. `AddGuestFormComponent` — no dependencies
7. `GuestTableComponent` — no dependencies
8. Restyle `LoginComponent` — no new dependencies
9. Restyle `LandingComponent` — depends on `HeaderComponent`
10. Restyle `GuestViewComponent` — depends on `RsvpButtonsComponent`
11. Restyle `HostDashboardComponent` — depends on `HeaderComponent`, `EventFormComponent`, `AddGuestFormComponent`, `GuestTableComponent`, `ToastComponent`
12. Update `styles.css` — can be done at step 1
