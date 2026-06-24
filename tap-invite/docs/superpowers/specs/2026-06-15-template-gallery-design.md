# Template Gallery Design

**Date:** 2026-06-15  
**Status:** Approved

## Overview

Hosts can choose an invitation template when creating an event and change it later via an edit dialog. Guests see their invitation rendered by the selected template. The architecture uses a plugin/manifest pattern that scales to 50+ templates, multi-page layouts, animations, and audio in future iterations.

---

## 1. Data Model

### `events` table — new column

```sql
ALTER TABLE events
  ADD COLUMN template_id VARCHAR NOT NULL DEFAULT 'default-minimal';
```

- `template_id` stores the template identifier string (e.g. `'default-minimal'`, `'soft-floral'`).
- `createEvent()` requires no change — the DB default applies automatically.
- `getEventDetails()` requires no change — it already selects `*`.
- A new `updateEvent(eventId, changes)` method covers both field edits and template swaps.

---

## 2. Plugin / Manifest Architecture

Every template is a self-contained folder. No shared HTML structure is forced. Future templates can have multiple pages, flip animations, audio, or any other behaviour.

### Folder structure

```
src/app/features/templates/
├── template.types.ts
├── template-registry.ts
├── default-minimal/
│   ├── default-minimal.template.ts
│   ├── default-minimal.manifest.ts
│   └── default-minimal.template.css
└── soft-floral/
    ├── soft-floral.template.ts
    ├── soft-floral.manifest.ts
    └── soft-floral.template.css
```

### `template.types.ts`

```typescript
export interface TemplateManifest {
  id: string;
  label: string;
  /**
   * Inline SVG data URI used as <img src> in the gallery.
   * Initial templates use a hand-authored SVG data URI directly in the manifest.
   * Future templates should generate a screenshot and reference it as a path.
   */
  thumbnail: string;
  tags: string[];              // e.g. ['minimal'], ['multi-page','audio']
  load: () => Promise<Type<TemplateComponent>>;
}

/** Every template component must implement this interface. */
export interface TemplateComponent {
  context: InputSignal<TemplateContext>;
}

export interface TemplateContext {
  event: EventData;
  guest: GuestData;
  rsvpStatus: string;
  onRsvpChange: (status: string, dietary?: string, count?: number) => void;
}
```

### `template-registry.ts`

```typescript
import { defaultMinimalManifest } from './default-minimal/default-minimal.manifest';
import { softFloralManifest }     from './soft-floral/soft-floral.manifest';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [
  defaultMinimalManifest,
  softFloralManifest,
];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
```

Adding a new template = new folder + one line in `TEMPLATE_REGISTRY`. No other files change.

---

## 3. Templates

### Template A — `default-minimal` (existing design)

The existing `guest-view` inline card is extracted verbatim into `default-minimal.template.ts`. Same HTML, same CSS, same Lottie animation. The guest-view component is slimmed down to just use `TemplateRendererComponent`.

### Template B — `soft-floral` (new)

- **Palette:** warm blush `#fdf6f0`, peach gradient `#f9e4d4 → #f0c4b0`, terracotta text `#5c2d0e`
- **Typography:** Georgia / serif for headings and greeting; italic accent labels
- **Decorative elements:** 🌸 emoji dividers, dashed borders, floral header band
- **Layout:** same single-page card structure as default-minimal; all differences are CSS-only
- **RSVP buttons:** styled to match (warm tones, italic labels like "Delighted to Attend")

Both templates are single-page. Multi-page/audio templates are out of scope for this iteration.

---

## 4. New Shared Components

### `TemplateRendererComponent`

**Location:** `src/app/features/templates/components/template-renderer/`

- Input: `context: TemplateContext` (signal)
- Resolves the manifest via `getManifest(context.event.template_id)`
- Calls `manifest.load()` to get the component class, then renders it with `NgComponentOutlet`
- Shows a spinner while loading
- The loaded component must implement `TemplateComponent` (i.e. have an `input.required<TemplateContext>('context')` signal input). `TemplateRendererComponent` passes `TemplateContext` via `NgComponentOutlet`'s `inputs` map.

### `TemplateGalleryComponent`

**Location:** `src/app/features/templates/components/template-gallery/`

- Input: `selectedId: string` (signal)
- Output: `templateSelected` event emitting `string`
- Renders a card grid from `TEMPLATE_REGISTRY` — thumbnail + label + selected indicator
- Designed for 50+ cards: CSS grid with `repeat(auto-fill, minmax(140px, 1fr))`
- Thumbnails are SVG data URIs authored directly in each manifest for the initial two templates. The gallery renders them with `<img [src]="manifest.thumbnail">`. Future templates provide a screenshot path instead.

---

## 5. Host Dashboard Changes

### State machine

| State | Trigger | What shows |
|-------|---------|------------|
| No event | initial | `EventFormComponent` (unchanged) |
| Event created, no template confirmed | after `createEvent()` succeeds | Template picker section above guest list |
| Template confirmed | host clicks "Confirm Template" | Normal dashboard (event strip + add-guest + table) |
| Edit dialog open | host clicks "Edit" on event strip | `MatDialog` with edit form |

### Template picker section (post-creation step)

- Appears between the event strip and the guest table after event creation
- Pre-selects `'default-minimal'`
- Embeds `TemplateGalleryComponent`
- "Confirm Template →" button calls `updateEvent(eventId, { template_id })` then hides the section
- Skippable: if the host dismisses without confirming, `'default-minimal'` remains (already the DB default)

### Event strip

- Shows active template label: `🟢 Live · [Event Title]  •  [Template Label]`
- "✏ Edit" button opens `MatDialog`

### Edit dialog

- **Fields:** Title (editable text input), Date (read-only display), Location (editable text input)
- **Template section:** `TemplateGalleryComponent` embedded inline
- **Save:** calls `updateEvent(eventId, { title, location_text, template_id })`
- **Cancel:** closes dialog, no changes saved
- Date field has a lock icon and disabled styling to make immutability obvious

---

## 6. Guest View Changes

`GuestViewComponent` currently renders the invitation card inline. After this change:

- The inline card HTML/CSS is removed from `guest-view`
- A `TemplateRendererComponent` is inserted in its place, receiving a `TemplateContext` built from the loaded event + guest data
- Loading and error states remain in `guest-view` (they are not template-specific)

---

## 7. Supabase Service Changes

### New method

```typescript
async updateEvent(
  eventId: string,
  changes: { title?: string; location_text?: string; template_id?: string }
): Promise<void>
```

Calls `.update(changes).eq('id', eventId)`. Throws on error.

### No other changes required

`createEvent()` and `getEventDetails()` are unchanged.

---

## 8. Files Summary

### New files

| File | Purpose |
|------|---------|
| `features/templates/template.types.ts` | `TemplateManifest`, `TemplateContext` interfaces |
| `features/templates/template-registry.ts` | Registry array + `getManifest()` helper |
| `features/templates/default-minimal/default-minimal.manifest.ts` | Manifest for default template |
| `features/templates/default-minimal/default-minimal.template.ts` | Component (extracted from guest-view) |
| `features/templates/default-minimal/default-minimal.template.css` | Styles (moved from guest-view) |
| `features/templates/soft-floral/soft-floral.manifest.ts` | Manifest for floral template |
| `features/templates/soft-floral/soft-floral.template.ts` | Floral invitation component |
| `features/templates/soft-floral/soft-floral.template.css` | Floral styles |
| `features/templates/components/template-renderer/template-renderer.component.ts` | Dynamic template loader |
| `features/templates/components/template-gallery/template-gallery.component.ts` | Gallery grid picker |
| `features/templates/components/template-gallery/template-gallery.component.html` | Gallery template |
| `features/templates/components/template-gallery/template-gallery.component.css` | Gallery styles |

### Modified files

| File | Change |
|------|--------|
| `core/services/supabase/supabase.ts` | Add `updateEvent()` |
| `features/guest-view/components/guest-view.component.ts` | Replace inline card with `TemplateRendererComponent` |
| `features/guest-view/components/guest-view.component.html` | Same — remove card HTML, add renderer |
| `features/guest-view/components/guest-view.component.css` | Remove card styles (moved to default-minimal) |
| `features/host-dashboard/components/host-dashboard.component.ts` | Add template-picker state, edit dialog logic |
| `features/host-dashboard/components/host-dashboard.component.html` | Add picker section, Edit button on strip |

### Database migration

```sql
ALTER TABLE events
  ADD COLUMN template_id VARCHAR NOT NULL DEFAULT 'default-minimal';
```

---

## 9. Out of Scope (this iteration)

- Multi-page / book-style / foldable templates
- Audio or advanced animation per-template
- Template preview in guest view before confirming
- Screenshot generation for gallery thumbnails
- Template tagging / filtering in gallery
- More than 2 templates
