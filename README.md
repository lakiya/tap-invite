# TapInvite

A digital event invitation platform. Hosts create events and send personalized invitations via magic link — guests tap the link, land on a themed invite page, and RSVP in one step.

Built with Angular 22, Supabase (auth + database), and Resend (email).

---

## Features

- **5 invitation templates** — default minimal, soft floral, flip card, wedding book, invitation booklet
- **Host dashboard** — create events, manage guests, track RSVPs, bulk upload via CSV/Excel
- **Magic link auth** — guests authenticate with a single email link, no password required
- **Super admin panel** — enable/disable events, edit event data, dispatch magic links manually, hard delete with cascade
- **RSVP stats** — live attendance counts and meal preference breakdowns

---

## Prerequisites

- Node.js 20+
- Angular CLI 22 (`npm install -g @angular/cli`)
- A [Supabase](https://supabase.com) project
- A [Resend](https://resend.com) account with a verified sender domain

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` with your Supabase and Resend credentials (see comments in `.env.example`).

Angular environment files (`src/environments/environment.ts` and `environment.prod.ts`) are generated automatically from `.env` when you run `npm start` or `npm run build`. Do not create or edit them manually.

### 3. Set up the database

Apply the schema via the Supabase SQL editor or CLI. The schema includes:

- `profiles` table with `user_role` ENUM (`host`, `guest`, `super_admin`)
- `events` table with `is_enabled` flag
- RLS policies for role-based access
- Trigger to auto-create a profile on sign-up

Bootstrap a super admin by setting `role = 'super_admin'` for your account in the `profiles` table:

```sql
UPDATE profiles SET role = 'super_admin' WHERE email = '<your-email>';
```

---

## Development

```bash
npm start          # serves at http://localhost:4200
npm run build      # production build → dist/
npm test           # unit tests via Vitest
```

---

## Deployment

Set the four environment variables (`SUPABASE_URL`, `SUPABASE_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`) in your hosting platform (Vercel, Railway, etc.). The `prebuild` hook runs `scripts/set-env.js` automatically during deployment to generate the environment files from those variables.
