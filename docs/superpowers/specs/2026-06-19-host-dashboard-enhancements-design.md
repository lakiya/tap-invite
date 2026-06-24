# Host Dashboard Enhancements — Design Spec

**Date:** 2026-06-19
**Feature area:** Host Dashboard + Super Admin E2E
**Status:** Approved for planning

## 1. Summary

This spec covers five items:

1. **Super Admin E2E verification** — steps 5–8 (all code is already implemented; this is a testing checklist).
2. **Bulk upload E2E verification** — code is already implemented; this is a testing checklist.
3. **RSVP Stats Bar** — four count chips (Accepted / Declined / Tentative / Pending) above the guest table.
4. **Email Invitation Dispatch** — per-guest Send button + bulk "Send All" above the guest table.
5. **Event Share Panel** — copyable event link + downloadable QR code on the host dashboard.

Items 1 and 2 require no new code. Items 3–5 follow the existing Angular 22 signals + event-emission pattern already used by `GuestTableComponent`.

---

## 2. E2E Verification Checklists (no new code)

### 2.1 Super Admin — steps 5–8

| Step | What to verify |
|------|---------------|
| 5 | Open Edit on any event in `/admin`. Change a field. Click Save → VERIFY overlay appears. Type `VERIFY` → Save becomes enabled. Confirm save → event data updates, grid refreshes. |
| 6 | Disable an event via the toggle. Visit `/w/:eventId/:guestId` for a guest of that event → "Invitation Unavailable" screen appears (not the template). |
| 7 | In Magic Link panel, search for a user email → Send Magic Email → confirm toast and email arrives. |
| 8 | Click 🗑 Delete on an event → confirm dialog appears. Confirm → event removed from grid, toast shown. Verify in Supabase that guests and RSVPs for that event are also deleted (cascade). |

### 2.2 Bulk Guest Upload

| Step | What to verify |
|------|---------------|
| 1 | "Bulk upload" button appears inside the Add Guest card. |
| 2 | Clicking opens the dialog. Download CSV template → file has Name / Phone / Email headers + example rows. |
| 3 | Upload a CSV with valid rows → preview table appears with correct data. |
| 4 | Upload a CSV with a missing name → row flagged with error; Save disabled. Fix inline → Save enables. |
| 5 | Upload a CSV with a duplicate email already in the guest list → row shows duplicate badge. |
| 6 | Save → guests appear in the guest table; success toast shows count. |

---

## 3. RSVP Stats Bar

### 3.1 Component

**New:** `rsvp-stats-bar/rsvp-stats-bar.component.ts|html|css`
Location: `tap-invite/src/app/features/host-dashboard/components/rsvp-stats-bar/`

```ts
// Signal-based input so computed() reacts to changes
guests = input<any[]>([]);

accepted  = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Accepted').length);
declined  = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Declined').length);
tentative = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Tentative').length);
pending   = computed(() => this.guests().filter(
  g => !g.rsvps?.length || g.rsvps[0].status === 'Pending'
).length);
```

- Hidden when `guests.length === 0`.
- No service calls — derived purely from the input.
- Styling: 4 inline chips using existing CSS variable conventions. Colors:
  - Accepted → green (`#dcfce7` bg / `#16a34a` text)
  - Declined → red (`#fee2e2` / `#dc2626`)
  - Tentative → amber (`#fef9c3` / `#854d0e`)
  - Pending → muted (`#f1f5f9` / `#64748b`)

### 3.2 HostDashboardComponent change

- Import and declare `RsvpStatsBarComponent`.
- In `host-dashboard.component.html`, place `<app-rsvp-stats-bar [guests]="guests()">` above the guest table, inside the `@if (activeEvent())` block.

---

## 4. Email Invitation Dispatch

### 4.1 GuestTableComponent changes

**New outputs:**
```ts
@Output() sendInvite = new EventEmitter<string>();  // emits guestId
@Output() sendAll    = new EventEmitter<void>();
```

**New input:**
```ts
@Input() sendingIds: Set<string> = new Set();
```

**Template changes:**
- Add a **Send** button to each row's action cell:
  - Disabled when `sendingIds.has(guest.id)` or `!guest.email`.
  - Label: `'Sending…'` while in-flight, `'Send'` otherwise.
  - Guests with no email: button is visually dimmed with `title="No email on file"`.
- Add a **Send All Invitations** button above the table header:
  - Disabled when `sendingIds.size > 0` or no guests have an email.
  - Only rendered when at least one guest exists.

### 4.2 HostDashboardComponent changes

```ts
sendingIds = signal<Set<string>>(new Set());

async handleSendInvite(guestId: string) {
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
  const withEmail = this.guests().filter(g => g.email);
  // Call service directly — no per-guest toast (avoids N+1 toasts for bulk send)
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
```

- Wire on `<app-guest-table>`:
  ```html
  (sendInvite)="handleSendInvite($event)"
  (sendAll)="handleSendAll()"
  [sendingIds]="sendingIds()"
  ```

**Note:** `sendEmailInvitation(guestId)` already exists in `supabase.ts` — no service changes needed.

### 4.3 Edge cases

| Situation | Handling |
|-----------|----------|
| Guest has no email | Send button disabled + tooltip "No email on file" |
| All guests have no email | Send All button hidden |
| Partial failure in Send All | Error toast per failure; individual `handleSendInvite` toasts handle per-guest |
| Double-click | `sendingIds` check prevents re-sending while in-flight |

---

## 5. Event Share Panel

### 5.1 New public route

**New component:** `EventPublicPageComponent`
Location: `tap-invite/src/app/features/event-public/event-public.component.ts|html|css`

- Public route (no auth guard): `{ path: 'e/:eventId', component: EventPublicPageComponent }`
- Added to `app.routes.ts`.
- Loads event by ID via `supabase.client.from('events').select('*').eq('id', eventId).single()`.
- Displays: event title, formatted date, location text.
- `is_enabled === false` → shows "This event is currently unavailable."
- Not found / error → shows "Event not found."
- No RSVP controls — read-only public page.

### 5.2 EventSharePanelComponent

**New:** `event-share-panel/event-share-panel.component.ts|html|css`
Location: `tap-invite/src/app/features/host-dashboard/components/event-share-panel/`

```ts
@Input({ required: true }) eventId!: string;
@Input({ required: true }) eventTitle!: string;

private toast = inject(ToastService);
shareUrl = computed(() => `${window.location.origin}/e/${this.eventId}`);
qrDataUrl = signal<string>('');

async ngOnInit() {
  const url = await QRCode.toDataURL(this.shareUrl(), { width: 256, margin: 2 });
  this.qrDataUrl.set(url);
}

async copyLink() {
  await navigator.clipboard.writeText(this.shareUrl());
  this.toast.info('Event link copied!');
}
```

- **Copy button** calls `copyLink()`.
- **QR image**: `<img [src]="qrDataUrl()" alt="Event QR code" width="128" height="128">` — shown once `qrDataUrl()` is non-empty.
- **Download link**: `<a [href]="qrDataUrl()" [download]="eventTitle + '-invite-qr.png'">Download QR</a>` — native anchor, no JS needed.
- Shown in `host-dashboard.component.html` below the event details card, above the stats bar, inside the `@if (activeEvent())` block.

### 5.3 New dependency

```
npm install qrcode
npm install --save-dev @types/qrcode
```

---

## 6. Data flow summary

```
guests() signal (HostDashboard)
  → [guests] input → RsvpStatsBarComponent   (counts, no calls)
  → [sendingIds] input → GuestTableComponent  (per-row send state)
  ← (sendInvite) → handleSendInvite()        → supabase.sendEmailInvitation()
  ← (sendAll)    → handleSendAll()            → Promise.allSettled(...)

activeEvent() signal (HostDashboard)
  → [eventId][eventTitle] → EventSharePanelComponent
      → QRCode.toDataURL() → qrDataUrl signal → <img> + download <a>
      → copyLink() → navigator.clipboard
```

---

## 7. File checklist

### New files
- `host-dashboard/components/rsvp-stats-bar/rsvp-stats-bar.component.ts|html|css`
- `host-dashboard/components/event-share-panel/event-share-panel.component.ts|html|css`
- `event-public/event-public.component.ts|html|css`

### Modified files
- `host-dashboard/components/guest-table/guest-table.component.ts|html` — new outputs + sendingIds input
- `host-dashboard/components/host-dashboard.component.ts|html` — wire new components + handlers
- `app/app.routes.ts` — add `/e/:eventId` route
- `package.json` — add `qrcode` + `@types/qrcode`

### No changes needed
- `core/services/supabase/supabase.ts` — `sendEmailInvitation` already exists
- `admin/` — all admin code already implemented

---

## 8. Out of scope (YAGNI)

- WhatsApp / SMS dispatch (separate feature, requires different integration)
- Walk-in RSVP on the public event page (read-only is sufficient for QR use case)
- Per-guest QR codes
- RSVP analytics with dietary breakdown or attending headcount (deferred by user)
- Scheduling / reminder emails
- Resend webhook callbacks
