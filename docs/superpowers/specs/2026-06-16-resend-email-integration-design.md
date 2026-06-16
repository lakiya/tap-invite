# Resend Email Integration — Design Spec
**Date:** 2026-06-16
**Project:** TapInvite
**Author:** Product Owner

---

## Overview

Replace Supabase's built-in OTP email sending with Resend for all transactional emails. Eliminates the 1-per-hour magic link rate limit by using the Supabase Admin API (`auth.admin.generateLink()`) server-side inside an Edge Function. Standardises all email delivery through Resend.

---

## 1. Motivation

`signInWithOtp()` is rate-limited to one email per address per hour by Supabase. The Admin API generates links with no rate limit — but requires the service role key, which must never reach the frontend. A Supabase Edge Function is the secure intermediary.

---

## 2. Architecture

Two Edge Functions handle all outbound email:

| Function | Trigger | Purpose |
|---|---|---|
| `send-magic-link` | Login page + admin magic link panel | Generate sign-in link via Admin API, send via Resend |
| `send-invite-email` | Host sends guest invitation | Send branded invitation email via Resend |

**Angular change:** Only `supabase.ts` changes — `signInWithMagicLink()` calls the Edge Function instead of `signInWithOtp()`. All callers (login page, admin panel) are untouched.

---

## 3. `send-magic-link` Edge Function

**Path:** `supabase/functions/send-magic-link/index.ts`

**Request body:** `{ email: string, redirectTo: string }`

**Flow:**
1. Validate `email` and `redirectTo` — return 400 if missing
2. Call `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })` using service role key — creates user if not exists, generates one-time link, no rate limit
3. Send via Resend: subject "Your TapInvite sign-in link", HTML + plain-text with Sign In button
4. Return `{ success: true }`

**Error responses:**
| Status | Cause |
|---|---|
| 400 | Missing params or Admin API failure |
| 502 | Resend delivery failure |
| 500 | Unexpected error |

**Email:**
- Subject: `Your TapInvite sign-in link`
- HTML: heading + "Click to sign in, expires in 24 hours" + Sign In button + raw URL fallback
- Plain text: `Sign in to TapInvite: {magicLink}`

---

## 4. `send-invite-email` Edge Function (rewrite)

**Path:** `supabase/functions/send-invite-email/index.ts`

**Request body:** `{ guestId: string }` — identical to current interface, no frontend changes

**Flow:**
1. Validate `guestId` — return 400 if missing
2. Fetch guest (`display_name`, `email`, `event_id`) — return 404 if not found, 400 if no email
3. Fetch event (`title`, `event_date`, `location_text`)
4. Build URL: `${SITE_URL}/w/${event_id}/${guest_id}`
5. Send via Resend: subject "You're invited to {title}", HTML + plain-text with View Invitation button

**Email:**
- Subject: `You're invited to {event.title}`
- HTML: guest name, event title/date/venue, View Invitation button + raw URL fallback
- Plain text: `You're invited to {title} on {date} at {venue}. View invitation: {url}`

---

## 5. Angular Change

**File:** `src/app/core/services/supabase/supabase.ts`

Replace `signInWithMagicLink()` body only:

```typescript
async signInWithMagicLink(email: string, redirectTo: string): Promise<void> {
  const { error } = await this.supabase.functions.invoke('send-magic-link', {
    body: { email, redirectTo }
  });
  if (error) throw error;
}
```

No other Angular files change.

---

## 6. Supabase Secrets Required

Set at: Supabase Dashboard → Edge Functions → Manage secrets (or via CLI)

| Secret | Value | Source |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Supabase → Settings → API → `service_role` |
| `FROM_EMAIL` | `onboarding@resend.dev` | `.env` (strip surrounding quotes/spaces) |
| `SITE_URL` | App base URL | `http://localhost:4200` for dev; production URL for prod |

> `SUPABASE_URL` is automatically injected into all Edge Functions by Supabase — no need to set it manually.

---

## 7. Out of Scope

- Custom sender domain (switch when a domain is verified in Resend)
- Email templates stored in DB
- Email open/click tracking
- Retry logic for Resend failures
