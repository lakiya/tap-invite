# Super Admin Command Center — Design Spec
**Date:** 2026-06-15  
**Project:** TapInvite  
**Author:** Product Owner

---

## Overview

A secure, standalone admin dashboard at `/admin` accessible only by the Product Owner (`super_admin` role). Provides full visibility and overriding control over all events, guests, and users — for customer support, fraud prevention, and platform management.

---

## 1. Database Schema

### 1.1 New `profiles` table

```sql
CREATE TYPE user_role AS ENUM ('user', 'super_admin');

CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       user_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

A Postgres trigger auto-inserts a `user` profile row whenever a new user signs up via `auth.users`:

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

To bootstrap the super admin, run once in Supabase SQL editor:

```sql
UPDATE profiles SET role = 'super_admin' WHERE email = '<your-email>';
```

### 1.2 New column on `events` table

```sql
ALTER TABLE events ADD COLUMN is_enabled boolean NOT NULL DEFAULT true;
```

Only the admin can set `is_enabled = false`. Regular hosts cannot modify this field (enforced by RLS).

### 1.3 Computed event status (UI-only, not stored)

Derived in `AdminService` after fetching events:

| Status     | Condition                                         |
|------------|---------------------------------------------------|
| `Disabled` | `is_enabled = false` (overrides date status)      |
| `Upcoming` | `is_enabled = true` AND `event_date > today`      |
| `Ongoing`  | `is_enabled = true` AND `event_date = today`      |
| `Passed`   | `is_enabled = true` AND `event_date < today`      |

The verification guard fires on **all four states** — every admin save requires typing "VERIFY".

---

## 2. Authentication, Routing & RLS

### 2.1 Auth callback update

`auth-callback.component.ts` updated post-`SIGNED_IN`:

1. Fetch `profiles` row for current user via `ProfilesService.getMyProfile(userId)`
2. If `role === 'super_admin'` → navigate to `/admin`
3. Else → navigate to `/dashboard`

### 2.2 New `ProfilesService`

**Path:** `src/app/core/services/profiles/profiles.service.ts`

Single method: `getMyProfile(userId: string)` — queries the `profiles` table and returns the user's role. Used by both `adminGuard` and `auth-callback`.

### 2.3 New `adminGuard`

**Path:** `src/app/core/guards/admin.guard.ts`

1. Check session via `supabase.getCurrentUser()` — redirect to `/login` if none
2. Fetch profile via `ProfilesService.getMyProfile()`
3. `role === 'super_admin'` → allow
4. Else → redirect to `/dashboard` (no error page)

### 2.4 Route registration

`app.routes.ts` — new protected route:

```ts
{
  path: 'admin',
  component: AdminDashboardComponent,
  canActivate: [adminGuard]
}
```

### 2.5 Supabase RLS policies

New policies added to existing tables (existing host policies are untouched):

| Table      | Operation | Condition                              |
|------------|-----------|----------------------------------------|
| `events`   | SELECT    | `profiles.role = 'super_admin'`        |
| `events`   | UPDATE    | `profiles.role = 'super_admin'`        |
| `events`   | DELETE    | `profiles.role = 'super_admin'`        |
| `guests`   | SELECT    | `profiles.role = 'super_admin'`        |
| `guests`   | UPDATE    | `profiles.role = 'super_admin'`        |
| `profiles` | SELECT    | `profiles.role = 'super_admin'`        |

Cascade delete on `events` automatically wipes associated `guests` and `rsvps` rows.

---

## 3. Feature Architecture

### 3.1 Folder structure

```
src/app/features/admin/
├── admin-dashboard.component.ts       ← root shell (dark nav + layout)
├── components/
│   ├── event-grid.component.ts        ← search, table, toggle, delete
│   ├── event-edit-modal.component.ts  ← edit form + verification guard modal
│   └── magic-link-panel.component.ts  ← user lookup + manual send
└── admin.service.ts                   ← all admin Supabase queries
```

### 3.2 `AdminService` API

| Method | Description |
|---|---|
| `getAllEvents()` | All events across all hosts, host email joined from profiles |
| `getAllProfiles()` | All user profiles (for magic link lookup) |
| `toggleEventEnabled(id, is_enabled)` | Flip `is_enabled` on an event |
| `updateEvent(id, fields)` | Patch any editable event fields |
| `deleteEvent(id)` | Hard delete — cascade wipes guests + rsvps |
| `sendManualMagicLink(email)` | Calls `supabase.signInWithMagicLink()` for the target email |

---

## 4. Feature A — Event Management Grid

**Component:** `event-grid.component.ts`

### Search & Filter
- Single text input searches across: host email, event title, event ID (client-side filter on loaded data)
- Status dropdown filter: All / Upcoming / Ongoing / Passed / Disabled

### Events Table columns
| Host Email | Event Title | Event Date | Status badge | Enabled toggle | Actions |
|---|---|---|---|---|---|

- **Status badge** colour: Upcoming=green, Ongoing=amber, Passed=grey, Disabled=red
- **Enabled toggle** — ON (purple pill) / OFF (grey pill). Clicking calls `AdminService.toggleEventEnabled()`. No VERIFY guard on toggle (it's a quick reversible action).
- **Edit button** — opens `event-edit-modal`
- **Delete button** — shows a simple confirmation dialog before calling `AdminService.deleteEvent()`

---

## 5. Feature B — Edit Modal & Verification Guard

**Component:** `event-edit-modal.component.ts`

### Editable fields
- Event title
- Event date
- `location_text` (venue name — existing column)
- `google_maps_url` (location URL — existing column)
- Guest display names (inline edit within modal, updates `guests.display_name`)

### Verification Guard
When the admin clicks "Save":
1. Check computed event status
2. If status is **any** of Ongoing / Upcoming / Passed / Disabled → intercept and show modal
3. Modal prompt: *"Warning: You are editing an old or active event. Type 'VERIFY' to confirm these changes."*
4. "Save Changes" button remains disabled until input value === `'VERIFY'` (exact, case-sensitive)
5. On match → proceed with `AdminService.updateEvent()`

---

## 6. Feature C — Manual Magic Link Dispatcher

**Component:** `magic-link-panel.component.ts`

- Search input filters `getAllProfiles()` results by email in real time
- "Send Magic Email" button calls `AdminService.sendManualMagicLink(email)`
- Uses the existing `supabase.signInWithMagicLink()` method — no new Supabase Edge Function required
- Success/error feedback via existing `ToastService`

---

## 7. Guest View Fallback

**Component:** `guest-view.component.ts` (existing, minor update)

After fetching event details, check `is_enabled`:
- If `false` → render fallback message: *"This invitation is temporarily unavailable. Please contact the host."*
- If `true` → render normally

---

## 8. UI Design

- **Route:** `/admin` (standalone, not embedded in host dashboard)
- **Theme:** Dark sidebar nav (`#1e293b` background), distinct from the light host dashboard
- **Nav header:** "⚡ Admin Command Center" + signed-in email + Sign Out
- No shared layout components with host dashboard

---

## 9. Out of Scope (deferred)

- Payment status (Paid/Unpaid) — no payment system exists yet; add when payments land
- Audit log of admin actions
- Multiple super_admin users
- Edge Functions for admin mutations (RLS policies provide sufficient server-side enforcement)
