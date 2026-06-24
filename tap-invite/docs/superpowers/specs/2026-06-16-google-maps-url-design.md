# Google Maps URL Field Design

## Problem

The `events` table has a `google_maps_url` column and all three invitation templates already render a "View on Google Maps →" link when the value is present. However, the event creation form and the edit event dialog have no input for this field, so hosts cannot set it.

## Goal

Add an optional plain-text "Google Maps URL" field to the event creation form and the edit event dialog, wiring it through to the Supabase insert and update calls.

## Scope

5 files. No new components, services, or DB migrations needed.

## Data Flow

### Create
1. `event-form.component.ts` — `fields.googleMapsUrl: ''` (empty string default)
2. `event-form.component.html` — text input bound to `fields.googleMapsUrl`
3. `supabase.createEvent(hostId, title, date, location, googleMapsUrl?)` — inserts `google_maps_url` column; empty string coerced to `null`

### Edit
1. `edit-event-dialog.component.ts` — `FormControl` pre-populated from `data.event.google_maps_url ?? ''`; `EditDialogResult` gains `google_maps_url: string`
2. `edit-event-dialog.component.html` — text input after Location field
3. `supabase.updateEvent()` changes type gains `google_maps_url?: string | null`; host-dashboard passes the value through

### Display
All three templates (`default-minimal`, `soft-floral`, `flip-card`) already render the link when `google_maps_url` is set. No template changes needed.

## File Changes

| File | Change |
|---|---|
| `src/app/core/services/supabase/supabase.ts` | `createEvent()` gains optional `googleMapsUrl?: string` param; empty string coerced to `null` before insert. `updateEvent()` changes type gains `google_maps_url?: string \| null`. |
| `src/app/features/host-dashboard/components/event-form/event-form.component.ts` | `fields` object gains `googleMapsUrl: ''`. `handleSubmit()` passes `fields.googleMapsUrl \|\| null` to `createEvent()`. |
| `src/app/features/host-dashboard/components/event-form/event-form.component.html` | Text input after Location field. Label: "Google Maps URL". Placeholder: `https://maps.google.com/...`. Not required. |
| `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts` | `EditDialogResult` gains `google_maps_url: string`. `FormGroup` gains `google_maps_url: new FormControl(data.event.google_maps_url ?? '')`. `save()` includes `google_maps_url: this.form.value.google_maps_url ?? ''`. |
| `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html` | Text input after Location field, `formControlName="google_maps_url"`. |
| `src/app/features/host-dashboard/components/host-dashboard.component.ts` | After edit dialog closes, pass `result.google_maps_url` to `supabase.updateEvent()`. |

## Validation

None. Plain free text. The field is optional — if left empty it is stored as `null` and the template link is not rendered.

## Empty String Handling

Both paths coerce `''` → `null` before writing to the DB so that templates treat an empty value as absent.

## No Tests Required

The `supabase.ts` service methods are integration-boundary wrappers with no branch logic to unit-test. The form components use Angular's built-in binding — no custom logic warranting a new spec.
