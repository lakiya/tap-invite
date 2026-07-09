# Collaborative Guest Photo & Video Wall — Design Spec
**Date:** 2026-07-09
**Project:** TapInvite
**Author:** Product Owner

---

## Overview

Guests upload photos (and, on premium events, short videos) directly from their existing personal invite link — no new login. A host moderates uploads before they go public. Approved media appears in a shared in-app gallery visible to every guest, and on a separate public "live wall" URL meant to be cast on a screen/projector at the venue. A manually-toggled `is_premium` flag on each event (set by the super admin, mirroring the existing `is_enabled` pattern) gates video support, higher photo caps, ZIP export, and longer retention — seeding a monetization lever without requiring a payment system to exist yet.

**Why:** Shared event photo/video albums are one of the strongest virality and guest-engagement mechanics used by leading invitation platforms (Partiful, Apple Invites, WithJoy), and work equally well across weddings, social events, and corporate events — TapInvite's three target segments.

**Out of scope for this spec:** the manual bank-transfer payment/package-builder system that will eventually set `is_premium` end-to-end. That is a separate, larger feature to be designed in its own session. This spec only assumes `is_premium` is a boolean the super admin can flip manually today (same mechanism as `is_enabled`).

---

## 1. Database Schema

### 1.1 New columns on `events`

```sql
ALTER TABLE events ADD COLUMN is_premium boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN wall_token uuid NOT NULL DEFAULT gen_random_uuid();
```

- `is_premium` — only the super admin can set this (enforced by RLS, same pattern as `is_enabled`). Regular hosts cannot modify it.
- `wall_token` — generated once at event creation, used only by the public live-wall route. Never displayed alongside the event's normal invite links.

### 1.2 New `event_media` table

```sql
CREATE TYPE media_type AS ENUM ('photo', 'video');
CREATE TYPE media_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE event_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id     uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  media_type   media_type NOT NULL,
  storage_path text NOT NULL,
  caption      text,
  status       media_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### 1.3 Storage bucket

New bucket `event-media`. Objects keyed as `events/{eventId}/{guestId}/{uuid}.{ext}`.

**Bucket-level file size limit:** 50 MB (a hard backstop at the Storage layer). The finer-grained, tier-dependent limits below are enforced in application code (client-side validation before upload, re-checked in `EventMediaService.uploadMedia`) since they depend on the parent event's `is_premium` flag — not expressible as a static Postgres check constraint.

### 1.4 Tier limits (enforced at upload time)

| Tier | Media | Max count | Max file size | Max duration |
|---|---|---|---|---|
| Free | photo | 30 per event | 10 MB | — |
| Free | video | not allowed | — | — |
| Premium | photo | unlimited | 10 MB | — |
| Premium | video | unlimited | 50 MB | 60 seconds |

### 1.5 Retention

A daily scheduled job deletes `event_media` rows (and their storage objects) once:
- Free event: `event_date + 1 day < now()`
- Premium event: `event_date + 14 days < now()`

---

## 2. RLS Policies

| Table / Bucket | Operation | Condition |
|---|---|---|
| `event_media` | INSERT | `guest_id` matches the authenticated guest's own row for that `event_id` |
| `event_media` | SELECT | `status = 'approved'` (any guest of that event) OR requester is the event's host |
| `event_media` | UPDATE (status) | requester is the event's host only |
| `event_media` | DELETE | requester is the event's host only |
| `events` | UPDATE `is_premium` | `profiles.role = 'super_admin'` only |
| Storage `event-media` | INSERT | path prefix matches caller's own `eventId/guestId` |
| Storage `event-media` | SELECT | joined against `event_media.status = 'approved'`, or requester is host |

The public live-wall route reads through a dedicated read path scoped to `wall_token` + `status = 'approved'` — it never exposes guest identity beyond `display_name`, and never exposes pending/rejected media.

---

## 3. Feature Architecture

### 3.1 New/updated folders

```
src/app/features/guest-view/components/
└── photo-tab/
    ├── photo-tab.component.ts       ← upload control + gallery grid
    └── photo-upload-form.component.ts

src/app/features/host-dashboard/components/
└── photo-moderation/
    ├── photo-moderation.component.ts  ← pending queue, approve/reject
    └── photo-gallery.component.ts     ← approved grid, delete, download-all (premium)

src/app/features/wall/
└── wall.component.ts                ← public live-wall slideshow, no auth

src/app/core/services/event-media/
└── event-media.service.ts           ← all Supabase queries for event_media
```

### 3.2 `EventMediaService` API

| Method | Description |
|---|---|
| `getApprovedMedia(eventId)` | Approved media for guest gallery / wall |
| `getPendingMedia(eventId)` | Host moderation queue |
| `getMediaCount(eventId, type)` | Used to enforce the free-tier photo cap client-side before upload |
| `uploadMedia(eventId, guestId, file, caption?)` | Validates type/size/duration, uploads to Storage, inserts `pending` row |
| `approveMedia(mediaId)` | Host action → `status = 'approved'` |
| `rejectMedia(mediaId)` | Host action → deletes storage object + row |
| `deleteMedia(mediaId)` | Host takedown of an already-approved item |
| `subscribeToApprovedMedia(eventId)` | Realtime channel for the live wall |
| `downloadAllAsZip(eventId)` | Premium only — calls an Edge Function, returns a signed URL |

---

## 4. Feature A — Guest Upload & Gallery

**Component:** `photo-tab.component.ts`, added as a new tab on the existing guest-view page, alongside RSVP. Uses the guest's existing `eventId`/`guestId` link — no new auth.

- **Upload control**: file picker for photos always shown; video input only rendered when `event.is_premium` is true. Client-side validation before any network call: file type, size, and (for video) duration.
- Before allowing a photo upload, checks `getMediaCount(eventId, 'photo')` against the free-tier cap (30) when `!is_premium`; at cap, the control disables with: *"This event has reached its free photo limit. Ask your host to unlock more."*
- **Gallery grid**: shows all `approved` media for the event, with uploader `display_name` and optional caption. A guest's own `pending` uploads appear greyed out with a "waiting for host approval" badge, visible only to them.
- If the event is disabled (`is_enabled = false`), the upload control is hidden entirely — same behavior as the existing disabled-event guest fallback.

---

## 5. Feature B — Host Moderation & Gallery

**Component:** `photo-moderation.component.ts` + `photo-gallery.component.ts`, new "Photos" section per event in host-dashboard.

- **Moderation queue**: pending uploads with Approve / Reject actions. Approve flips `status` to `approved` (instantly visible in guest gallery + live wall). Reject deletes the storage object and row outright — no soft-delete state to manage.
- **Approved gallery**: browsable grid with a delete action for after-the-fact takedowns.
- **Download All (premium only)**: "Download ZIP" button, calls `downloadAllAsZip(eventId)`, which invokes an Edge Function that zips all approved objects and returns a signed download URL.

---

## 6. Feature C — Live Wall

**Component:** `wall.component.ts`, new public route `/wall/:eventId/:wallToken`.

- No login. Token validated against the event's stored `wall_token`; mismatch or missing → generic not-found page (never reveals whether the event exists).
- Subscribes via Supabase Realtime to `event_media` filtered to `status = 'approved'` for the matching event, rendering an auto-rotating slideshow (photos + premium videos).
- Displays only the media and the uploader's `display_name` — no other guest data.

---

## 7. Error Handling

- Free-tier photo cap reached → upload control disables proactively; never a failed upload after the fact.
- Video attempted on a free event → the video input simply isn't rendered.
- Oversized or over-duration file → rejected client-side before any network call, with an inline message.
- Host disables the event → upload control hides immediately.
- Live wall with an invalid/missing token → generic not-found page.
- Cleanup job partial failure (e.g. storage delete succeeds, row delete fails, or vice versa) is logged, not retried in a loop — reconciled on the next scheduled run.

---

## 8. Testing

- **Unit:** tier-based cap/limit checks (photo count, video allowance, file size/duration validation), retention-window date math.
- **Component:** guest photo tab states (empty / uploading / at-cap / own-pending-badge / gallery); host moderation actions (approve / reject / delete); premium-only UI branches (video input, download-all button).
- **RLS policy tests:** guest can insert only under their own path; guest cannot read another guest's pending row; anon wall route can only read approved rows for the matching event; host can read/update/delete only their own events' media.
- **Manual E2E pass before merge:** upload → pending → approve → appears in gallery + wall; reject → gone; hit free cap; toggle `is_premium` and confirm video input + download-all unlock; run the cleanup job against a backdated test event and confirm deletion.

---

## 9. Out of Scope (deferred)

- The manual bank-transfer payment/package-builder system that will eventually set `is_premium` (separate future spec).
- AI-generated recap videos/highlight reels from uploaded media.
- Guest reactions/comments on individual photos.
- Automatic NSFW/content moderation (moderation is fully manual via host approval for v1).
