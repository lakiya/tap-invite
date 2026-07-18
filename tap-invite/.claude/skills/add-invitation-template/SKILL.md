---
name: add-invitation-template
description: Use when asked to add a new invitation template/theme/design to TapInvite (e.g. "add a new template called X", "create a birthday-themed invitation design", "make a new RSVP page style"). Five templates already follow this exact folder + manifest + registry pattern (default-minimal, soft-floral, flip-card, invitation-booklet, wedding-book) — follow it rather than inventing a new structure.
---

# Adding an invitation template

Templates are the pluggable, lazy-loaded components that render a guest's invitation at `/w/:eventId/:guestId`. Each one is a self-contained folder under `src/app/features/templates/`. Look at `soft-floral/` as the simplest complete reference while you work — it has the fewest moving parts.

## 1. Create the folder

`src/app/features/templates/<template-id>/` (kebab-case id, e.g. `birthday-confetti`) containing:

- `<template-id>.manifest.ts`
- `<template-id>.template.ts`
- `<template-id>.template.css`

## 2. Implement the template component

The component must implement `TemplateComponent` from `../template.types.ts`: a single `context = input.required<TemplateContext>()`. `TemplateContext` gives you everything the template can show or do — read `template.types.ts` for the exact shape, but at a glance:

- `context().event` — title, date, location, `google_maps_url`, `show_rsvp`, `notes`.
- `context().guest` — display name.
- `context().rsvpStatus` / `context().rsvpError` — current RSVP state and any save error to display.
- `context().onRsvpChange(status)` — call this from an `<app-rsvp-buttons>` (`(rsvpChange)="context().onRsvpChange($event)"`) to persist an RSVP. Only render the RSVP buttons when `context().event.show_rsvp !== false` — some events disable RSVP collection entirely.

Keep the component standalone, with its own scoped CSS file — templates don't share styles with each other or with the shell.

## 3. Write the manifest

```ts
export const myTemplateManifest: TemplateManifest = {
  id: 'my-template',
  label: 'Human-Readable Name',
  thumbnail: `data:image/svg+xml,...`,  // small inline SVG gallery preview, ~160x213
  tags: ['tag1', 'tag2'],
  load: () => import('./my-template.template').then(m => m.MyTemplateComponent),
};
```

The `thumbnail` is a hand-built inline SVG data URI (see any existing manifest for the style — flat rectangles standing in for header/text/buttons, not a real screenshot) shown in the template gallery (`components/template-gallery/`) before the template itself is ever loaded. `tags` are freeform descriptive labels (styles like `'floral'`, `'romantic'`, `'minimal'`) — there's no fixed taxonomy to match.

## 4. Register it

Add the manifest to `TEMPLATE_REGISTRY` in `template-registry.ts` (import + push into the array). This is the only wiring step — the gallery and the guest-view renderer both read off this array, nothing else needs to reference the new template by name.

## 5. Verify

Templates aren't unit-tested individually in most cases (check whether the template you're modeling after has a `.spec.ts` — `invitation-booklet` does, most others don't). To see it render for real: use the `run` skill to start the dev server, open the template gallery (host dashboard → edit event → template picker) or set an event's `template_id` directly via Supabase, then load `/w/:eventId/:guestId` for that event.
