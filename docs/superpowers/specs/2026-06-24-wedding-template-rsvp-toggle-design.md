# Design: Wedding Book Template + RSVP Visibility Toggle

**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

Two features are added together:

1. **Wedding Book Template** — a new 4th invitation template styled for weddings, with a book-flip animation across 4 sides (2 pages).
2. **RSVP Visibility Toggle** — an event-level setting that controls whether the Accept / Decline section is rendered in any invitation template.

---

## Feature 1: Wedding Book Template

### Template Identity

| Field | Value |
|---|---|
| ID | `wedding-book` |
| Label | `Wedding Book` |
| Tags | `['wedding', 'elegant', 'book']` |

### File Structure

```
tap-invite/src/app/features/templates/wedding-book/
├── wedding-book.manifest.ts
├── wedding-book.template.ts
└── wedding-book.template.css
```

Registered as the 4th entry in `template-registry.ts`.

### Navigation Model — 3-State Machine

The component holds a `signal<'cover' | 'inside' | 'back'>` with the following transitions:

```
[cover] --tap cover--> [inside] --tap "RSVP →"--> [back]
                          ^                           |
                          └───── tap "← Back" ────────┘
   cover ← tap "← Close" ┘
```

### CSS 3D Flip Mechanics

- Each state transition uses CSS `rotateY` on a `preserve-3d` container (same pattern as the existing `flip-card` template).
- `cover → inside`: cover panel rotates `rotateY(-180deg)`; inside spread face rotates from `rotateY(180deg)` to `0deg`.
- `inside → back`: inside spread rotates out `rotateY(-180deg)`; back/RSVP face rotates in from `rotateY(180deg)` to `0deg`.
- Transitions use `transition: transform 0.7s ease-in-out`.
- Each face uses `backface-visibility: hidden` so the reverse side is invisible during rotation.

### Content Per Side

| Side | State | Content |
|---|---|---|
| 1 — Front Cover | `cover` | Gold floral corner ornaments (CSS/Unicode), "You are invited to celebrate", couple names (`event.title`) in large serif, formatted date, "Tap to open" hint with pulse animation |
| 2 — Inside Left | `inside` | "Ceremony" heading, date + time, venue (`event.location_text`), Google Maps link (if present) |
| 3 — Inside Right | `inside` | Additional details (`event.notes`) as styled free-text; if `notes` is empty, shows a decorative floral flourish only |
| 4 — Back / RSVP | `back` | RSVP buttons (conditionally rendered — see Feature 2), closing message "We look forward to celebrating with you" |

### Visual Style

| Property | Value |
|---|---|
| Background | `#fffaf4` (ivory) |
| Primary accent | `#c9a84c` (gold) |
| Text (dark) | `#3a2e1e` (warm dark brown) |
| Text (muted) | `#7a6a52` |
| Font | `Playfair Display` (Google Fonts, serif) |
| Decorative elements | Unicode ornaments: `✦ ❧ ◆ —`; thin gold `border` lines |
| No external image dependencies | All decoration is CSS + Unicode |

### Thumbnail

An SVG data URI in `wedding-book.manifest.ts` depicting the ivory/gold book cover — used in the template gallery grid.

---

## Feature 2: RSVP Visibility Toggle

### Database Migration

Two new columns on the `events` table:

| Column | Type | Default | Nullable | Purpose |
|---|---|---|---|---|
| `notes` | `text` | `null` | yes | Free-text additional details (dress code, reception info, hashtag, etc.) displayed on Side 3 of the wedding template; available to all templates |
| `show_rsvp` | `boolean` | `true` | no | When `false`, all templates hide the RSVP Accept / Decline section for this event |

### Type Changes — `EventData`

```ts
// template.types.ts
export interface EventData {
  id: string;
  host_id: string;
  title: string;
  event_date: string;
  location_text: string;
  template_id: string;
  google_maps_url?: string | null;
  notes?: string | null;       // NEW
  show_rsvp: boolean;          // NEW (defaults to true)
}
```

`TemplateContext` is unchanged — all templates already read `context().event`, so they inherit `show_rsvp` and `notes` automatically.

### Edit Event Dialog Changes

**New `notes` field:**
- Textarea (not single-line input), optional.
- Positioned between the Google Maps URL field and the template gallery section.
- Label: "Additional Details"; placeholder: "Dress code, reception info, hashtag, etc."

**New `show_rsvp` toggle:**
- Material slide toggle or styled checkbox.
- Positioned below the template gallery, above the Save / Cancel buttons.
- Label: "Show Accept / Decline section"
- Default: on (`true`).

**`EditDialogResult` additions:**
```ts
notes: string | null;
show_rsvp: boolean;
```

### Supabase Service Changes

`updateEvent()` signature extended to accept `notes` and `show_rsvp`:

```ts
async updateEvent(
  eventId: string,
  changes: {
    title?: string;
    location_text?: string;
    template_id?: string;
    google_maps_url?: string | null;
    notes?: string | null;       // NEW
    show_rsvp?: boolean;         // NEW
  }
): Promise<void>
```

### Template RSVP Guard

Every template (including the new wedding-book) wraps its RSVP section:

```html
@if (context().event.show_rsvp !== false) {
  <app-rsvp-buttons ...></app-rsvp-buttons>
}
```

Using `!== false` (not `=== true`) so existing events that don't yet have the column (returning `null`) still show RSVP by default.

---

## Affected Files

| File | Change |
|---|---|
| `template.types.ts` | Add `notes`, `show_rsvp` to `EventData` |
| `template-registry.ts` | Register `weddingBookManifest` |
| `templates/wedding-book/` | New folder — manifest, component, CSS |
| `templates/default-minimal/default-minimal.template.ts` | Wrap RSVP with `show_rsvp` guard |
| `templates/soft-floral/soft-floral.template.ts` | Wrap RSVP with `show_rsvp` guard |
| `templates/flip-card/flip-card.template.ts` | Wrap RSVP with `show_rsvp` guard |
| `edit-event-dialog.component.ts` | Add `notes`, `show_rsvp` form controls + result |
| `edit-event-dialog.component.html` | Add notes textarea + show_rsvp toggle UI |
| `supabase.ts` | Extend `updateEvent()` to include `notes`, `show_rsvp` |
| Supabase DB | Migration: add `notes text`, `show_rsvp boolean DEFAULT true` to `events` |

---

## Out of Scope

- Ceremony-specific fields (dress code, reception venue/time) as separate DB columns — handled via free-text `notes` field.
- Any changes to guest data model or RSVP logic.
- Changes to existing template visual designs.
