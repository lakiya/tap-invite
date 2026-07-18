# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout — read this first

This repository contains **two copies** of the same Angular app:

- **`tap-invite/`** — the real, actively-developed application. All recent feature work (invitation-booklet template, wedding-book template, event-public page, super admin command center, etc.) lives here. **Always `cd tap-invite` before running any command** (`npm`, `ng`, `npx vitest`, etc.) — the root-level `package.json`/`angular.json` are for the stale copy.
- **repo root (`src/`, `package.json`, `angular.json`, …)** — an older, stale duplicate that is missing templates and features present in `tap-invite/`. Do not edit it; treat it as dead weight until someone decides to delete it.

The one thing that lives only at the **repo root**, not inside `tap-invite/`, is design documentation: `docs/superpowers/plans/*.md` and `docs/superpowers/specs/*.md` contain the plan/spec for every feature built so far (dated filenames, newest last). Check there for the rationale and design behind a feature before changing it.

⚠️ **`.env` at the repo root is committed to git** (contains `SUPABASE_KEY` and `RESEND_API_KEY`). Do not add to this — do not commit `tap-invite/.env` or any other secrets file. This is a pre-existing issue the user is aware of; don't try to "fix" it (rewrite history, rotate keys) without being asked.

## Commands

Run all of these from `tap-invite/`:

```bash
npm install        # install dependencies
npm start          # ng serve — dev server at http://localhost:4200
npm run build      # ng build — production build to dist/
npm test           # ng test — runs Vitest unit tests
npx vitest run path/to/file.spec.ts   # run a single test file
npx tsc --noEmit   # typecheck without emitting
```

There is no separate lint script configured; `.prettierrc` (printWidth 100, single quotes, Angular parser for `.html`) defines formatting conventions but Prettier isn't wired into an npm script — run `npx prettier --write <file>` directly if needed.

Environment setup: copy `.env.example` (repo root) to `.env`, filling in `SUPABASE_URL`, `SUPABASE_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`. Angular's `src/environments/environment.ts` / `environment.prod.ts` are generated from `.env` by `scripts/set-env.js`. Note: unlike the root copy, `tap-invite/package.json` does **not** wire this into `prestart`/`prebuild` hooks — run `node scripts/set-env.js` manually inside `tap-invite/` after editing `.env` if the environment files need regenerating.

Supabase edge functions live in `tap-invite/supabase/functions/` (`send-invite-email`, `send-magic-link`) and are deployed independently via the Supabase CLI — they are not part of the Angular build.

## Architecture

Angular 22, standalone components (no NgModules), signals for state, SSR enabled (`src/server.ts`, `main.server.ts`, `app.config.server.ts`). Supabase provides auth + Postgres; Resend sends transactional email through Supabase edge functions.

### Roles and routing (`src/app/app.routes.ts`)

Three user-facing surfaces gated by role, all lazy-loaded:

- `/` `landing`, `/login`, `/auth/callback` — public, magic-link auth (no password).
- `/dashboard` — host dashboard, behind `authGuard` (any authenticated user).
- `/admin` — super admin command center, behind `adminGuard` (requires `profiles.role === 'super_admin'`, checked via `ProfilesService.getMyProfile`).
- `/w/:eventId/:guestId` — the actual guest invitation (magic-link destination); loads event + guest + rsvp rows and blocks cross-event access by filtering on both ids together.
- `/e/:eventId` — a public, guest-less read-only view of an event (no RSVP).

Guards (`core/guards/*.guard.ts`) call `Supabase.getCurrentUser()` and redirect via `router.createUrlTree(...)` rather than injecting `Router.navigate` — keep that pattern for new guards.

### Data access

`core/services/supabase/supabase.ts` (`Supabase` service) is the single wrapper around the Supabase client and holds essentially all query/mutation methods (events, guests, rsvps, edge function invocations for magic-link/email). `features/admin/admin.service.ts` (`AdminService`) duplicates a parallel set of admin-scoped queries (bypassing RLS-friendly host scoping) rather than reusing `Supabase` — follow that existing split (host/guest-facing queries in `Supabase`, admin-only queries in `AdminService`) rather than merging them.

`APP_ENV` (`core/tokens/app-env.ts`) is an injection token carrying `{ supabaseUrl, supabaseKey }`, seeded from `environment.ts` on the server and transferred to the client via Angular's `TransferState` (see `app.config.ts`) so SSR and browser share one config source without re-reading env vars client-side.

### Template system (`features/templates/`)

Invitations render through a pluggable template system — this is the part most likely to need reading multiple files to understand:

- `template.types.ts` defines `TemplateManifest` (`id`, `label`, `thumbnail`, `tags`, `load: () => Promise<Type<TemplateComponent>>`) and `TemplateContext` (event + guest + rsvp state + `onRsvpChange` callback) — the contract every template component receives via a single `context` input signal.
- Each template is a self-contained folder (`default-minimal/`, `soft-floral/`, `flip-card/`, `invitation-booklet/`, `wedding-book/`) with its own `*.manifest.ts` (metadata + lazy `load()`) and `*.template.ts` (+ `.css`) implementing `TemplateComponent`.
- `template-registry.ts` aggregates all manifests into `TEMPLATE_REGISTRY` and exposes `getManifest(id)`.
- `components/template-renderer/template-renderer.component.ts` resolves a manifest by `context().event.template_id`, lazy-loads the component via `NgComponentOutlet`, and re-resolves whenever `template_id` changes (via an `effect`) — this is the mount point used by both the guest view and the template gallery preview.

Adding a new template means: create the folder with manifest + template component, register it in `template-registry.ts`, and implement `TemplateComponent` (accept `context: input.required<TemplateContext>()`).

### Feature module shape

Each `features/*` folder is routed as its own lazy-loaded standalone component tree with a `components/` subfolder for children (e.g. `host-dashboard/components/{add-guest-form, bulk-upload-dialog, guest-table, rsvp-stats-bar, event-share-panel, edit-event-dialog}`). Bulk guest import (`bulk-upload-dialog/guest-import.ts`) parses CSV/Excel via `xlsx`. Cross-cutting UI concerns (`ToastService`, `ThemeService`) live under `core/services/` and are consumed from `shared/components/`.
