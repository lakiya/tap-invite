# Resend Email Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `signInWithOtp()` with an Edge Function that uses the Supabase Admin API + Resend, and rewrite `send-invite-email` to use Resend — eliminating the magic link rate limit and standardising all email delivery.

**Architecture:** Two Deno Edge Functions (`send-magic-link`, `send-invite-email`) use the Supabase service role key server-side to generate links or fetch data, then send emails via the Resend SDK. The Angular frontend only changes in one method — `signInWithMagicLink()` in `supabase.ts` — which now calls the Edge Function instead of `signInWithOtp()`.

**Tech Stack:** Supabase Edge Functions (Deno 2.x), Resend SDK (`npm:resend`), Angular 22, Supabase JS 2.x, Supabase CLI 2.106.0

---

## File Map

**Create:**
- `supabase/functions/send-magic-link/index.ts` — new Edge Function: generate magic link via Admin API + send via Resend
- `supabase/functions/send-invite-email/index.ts` — rewrite: same interface, swap email delivery to Resend

**Modify:**
- `src/app/core/services/supabase/supabase.ts` — replace `signInWithMagicLink()` to call Edge Function

**Manual steps (not code):**
- Add 4 secrets to Supabase: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FROM_EMAIL`, `SITE_URL`

---

### Task 1: Add Supabase Secrets (manual)

**Files:** None — done in Supabase Dashboard or CLI

- [ ] **Step 1: Get your service role key**

Go to Supabase Dashboard → Settings → API → copy the `service_role` key (it starts with `eyJ...`). Keep it secret — never commit it.

- [ ] **Step 2: Set secrets via Supabase CLI**

Get `RESEND_API_KEY` from `.env` — strip the trailing comma (the value ends with `...SBB BC,` — remove the `,`).
Get `FROM_EMAIL` from `.env` — strip the leading space and surrounding single quotes (use `onboarding@resend.dev`, not `'onboarding@resend.dev'`).

```bash
npx supabase secrets set RESEND_API_KEY=<value-from-env-without-trailing-comma> --project-ref vnvywgtrdywfvrlrdgwq
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-dashboard> --project-ref vnvywgtrdywfvrlrdgwq
npx supabase secrets set FROM_EMAIL=onboarding@resend.dev --project-ref vnvywgtrdywfvrlrdgwq
npx supabase secrets set SITE_URL=http://localhost:4200 --project-ref vnvywgtrdywfvrlrdgwq
```

- [ ] **Step 3: Verify secrets are set**

```bash
npx supabase secrets list --project-ref vnvywgtrdywfvrlrdgwq
```

Expected: output lists `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FROM_EMAIL`, `SITE_URL`.

---

### Task 2: `send-magic-link` Edge Function

**Files:**
- Create: `supabase/functions/send-magic-link/index.ts`

- [ ] **Step 1: Create the function file**

```typescript
// supabase/functions/send-magic-link/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, redirectTo } = await req.json()

    if (!email || !redirectTo) {
      return new Response(
        JSON.stringify({ error: 'email and redirectTo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const fromEmail = Deno.env.get('FROM_EMAIL')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo }
    })

    if (linkError || !data?.properties?.action_link) {
      return new Response(
        JSON.stringify({ error: linkError?.message ?? 'Failed to generate magic link' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const magicLink = data.properties.action_link

    const resend = new Resend(resendApiKey)
    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Your TapInvite sign-in link',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 8px;font-size:1.4rem;color:#1e293b;font-weight:800;">Sign in to TapInvite</h2>
            <p style="color:#64748b;margin:0 0 24px;font-size:0.9rem;">Click the button below to sign in. This link expires in 24 hours and can only be used once.</p>
            <a href="${magicLink}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">Sign In to TapInvite</a>
            <p style="color:#94a3b8;font-size:0.75rem;margin:24px 0 0;word-break:break-all;">Or copy this URL: ${magicLink}</p>
          </div>
        </div>
      `,
      text: `Sign in to TapInvite:\n\n${magicLink}\n\nThis link expires in 24 hours.`,
    })

    if (emailError) {
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy send-magic-link --project-ref vnvywgtrdywfvrlrdgwq
```

Expected output:
```
Deploying Function send-magic-link (script size: ...kB)
Done: send-magic-link
```

- [ ] **Step 3: Smoke test via curl**

```bash
curl -X POST https://vnvywgtrdywfvrlrdgwq.supabase.co/functions/v1/send-magic-link \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-anon-key>" \
  -d '{"email":"lakshikachirantha1@gmail.com","redirectTo":"http://localhost:4200/auth/callback"}'
```

Expected: `{"success":true}` and an email arrives in your inbox.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-magic-link/index.ts
git commit -m "feat: add send-magic-link Edge Function using Admin API + Resend"
```

---

### Task 3: Rewrite `send-invite-email` Edge Function

**Files:**
- Create: `supabase/functions/send-invite-email/index.ts`

- [ ] **Step 1: Create the function file**

```typescript
// supabase/functions/send-invite-email/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { guestId } = await req.json()

    if (!guestId) {
      return new Response(
        JSON.stringify({ error: 'guestId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const fromEmail = Deno.env.get('FROM_EMAIL')!
    const siteUrl = Deno.env.get('SITE_URL')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id, display_name, email, event_id')
      .eq('id', guestId)
      .single()

    if (guestError || !guest) {
      return new Response(
        JSON.stringify({ error: 'Guest not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!guest.email) {
      return new Response(
        JSON.stringify({ error: 'Guest has no email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, event_date, location_text')
      .eq('id', guest.event_id)
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const invitationUrl = `${siteUrl}/w/${guest.event_id}/${guest.id}`
    const eventDate = new Date(event.event_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

    const resend = new Resend(resendApiKey)
    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: guest.email,
      subject: `You're invited to ${event.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 4px;font-size:1.4rem;color:#1e293b;font-weight:800;">You're invited, ${guest.display_name}!</h2>
            <h3 style="margin:0 0 8px;font-size:1.1rem;color:#7c3aed;font-weight:700;">${event.title}</h3>
            <p style="color:#64748b;margin:0 0 4px;font-size:0.9rem;">📅 ${eventDate}</p>
            <p style="color:#64748b;margin:0 0 24px;font-size:0.9rem;">📍 ${event.location_text}</p>
            <a href="${invitationUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">View Invitation</a>
            <p style="color:#94a3b8;font-size:0.75rem;margin:24px 0 0;word-break:break-all;">Or copy: ${invitationUrl}</p>
          </div>
        </div>
      `,
      text: `You're invited to ${event.title}\n\n${eventDate}\n${event.location_text}\n\nView your invitation: ${invitationUrl}`,
    })

    if (emailError) {
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy send-invite-email --project-ref vnvywgtrdywfvrlrdgwq
```

Expected: `Done: send-invite-email`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-invite-email/index.ts
git commit -m "feat: rewrite send-invite-email Edge Function using Resend"
```

---

### Task 4: Update `supabase.ts` — swap `signInWithMagicLink`

**Files:**
- Modify: `src/app/core/services/supabase/supabase.ts`

- [ ] **Step 1: Replace the method body**

In `src/app/core/services/supabase/supabase.ts`, replace the `signInWithMagicLink` method (currently lines 44–51):

```typescript
async signInWithMagicLink(email: string, redirectTo: string): Promise<void> {
  const { error } = await this.supabase.functions.invoke('send-magic-link', {
    body: { email, redirectTo }
  });
  if (error) throw error;
}
```

The method signature is unchanged — all callers (login page, admin magic link panel) work without modification.

- [ ] **Step 2: Run tests**

```bash
npx ng test --watch=false
```

Expected: all existing tests pass (the method is mocked in all tests, so no test changes needed).

- [ ] **Step 3: Run build**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/supabase/supabase.ts
git commit -m "feat: route magic link requests through send-magic-link Edge Function"
```

---

### Task 5: E2E Verification

- [ ] **Step 1: Test login magic link (no rate limit)**

1. Go to `http://localhost:4200/login`
2. Enter `lakshikachirantha1@gmail.com` and click "Send Magic Link"
3. Expected: success state shown ("Check your inbox!")
4. Check inbox — email arrives from `onboarding@resend.dev` with subject "Your TapInvite sign-in link"
5. Click the link — lands on `/admin`
6. **Repeat within 1 minute** — click "Resend link" on the login page
7. Expected: second email arrives (no rate limit error)

- [ ] **Step 2: Test invite email**

1. Sign in as the host (any non-super-admin email)
2. Add a guest with a valid email address
3. Click "Send Invitation" (or equivalent button in the host dashboard)
4. Expected: email arrives with subject "You're invited to {event title}" and a working "View Invitation" link

- [ ] **Step 3: Test admin magic link panel**

1. Sign in as super admin → `/admin`
2. In the Magic Link panel, search for any user email
3. Click "Send Magic Email"
4. Expected: success toast + email arrives from Resend
