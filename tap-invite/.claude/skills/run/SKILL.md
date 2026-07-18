---
name: run
description: Use whenever asked to run, start, serve, build, test, or verify the TapInvite Angular app — "start the dev server", "run the app", "check if this change works", "run the tests", "build it". Also use when a change needs verifying in the browser before it's called done, since most routes sit behind Supabase magic-link auth and can't be reached with a plain login form fill.
---

# Running and verifying TapInvite

## Always work from `tap-invite/`, not the repo root

This repo has a stale duplicate of the app at the repo root (old `src/`, `package.json`, `angular.json`). The real app — the one with current features and the one every recent commit touches — lives in `tap-invite/`. If your shell isn't already there, `cd tap-invite` before running any `npm`/`ng`/`npx` command. Commands run from the repo root will use the wrong `package.json` and silently exercise the stale copy.

## First-time setup

1. `npm install` (only needed once, or after a dependency change).
2. Make sure `tap-invite/.env` exists with `SUPABASE_URL`, `SUPABASE_KEY`, `RESEND_API_KEY`, `FROM_EMAIL` — see the repo-root `.env.example` for the variable names. This file is never committed (by design), so it won't already be there on a fresh checkout.
3. Run `node scripts/set-env.js` to generate `src/environments/environment.ts` / `environment.prod.ts` from `.env`. Unlike the root copy of the project, `tap-invite/package.json` does **not** wire this into a `prestart`/`prebuild` hook, so it won't happen automatically — re-run it by hand whenever `.env` changes.

## Commands

```bash
npm start                              # ng serve — http://localhost:4200, live reload
npm run build                          # ng build — production build to dist/
npm test                               # ng test — Vitest unit tests, all files
npx vitest run path/to/file.spec.ts    # a single test file
npx tsc --noEmit                       # typecheck only
```

## Verifying a change in the browser

Most of the app sits behind one of two guards, and both matter for how you verify:

- **`/`, `/login`, `/w/:eventId/:guestId`, `/e/:eventId`** — no auth required. Fine to hit directly with a browser tool or `curl`.
- **`/dashboard`** (host) and **`/admin`** (super admin) — behind `authGuard` / `adminGuard`. There is no password login: auth is a Supabase magic link emailed to the user, so you cannot script your way past it with a form fill.

To verify anything behind a guard without a human clicking through email each time, reuse the project's existing session-capture pattern:

1. `node playwright-login.mjs` once — opens a real browser, waits for a human to complete the magic-link flow, then saves the authenticated session to `playwright-auth.json`.
2. Any later Playwright script can load `playwright-auth.json` as `storageState` and navigate straight to `/admin` or `/dashboard` already authenticated — see `e2e-verify-steps5-8.mjs` for the pattern (check `existsSync('playwright-auth.json')` first and tell the user to re-run step 1 if it's missing or the session expired).

If `playwright-auth.json` doesn't exist yet and you can't get a human to click the magic link right now, verify the unauthenticated routes and say plainly that the guarded routes are unverified rather than guessing.
