# Bulk Guest Upload (CSV / Excel) — Design Spec

**Date:** 2026-06-17
**Feature area:** Host Dashboard → Event Guest List
**Status:** Approved for planning

## 1. Summary

Add the ability for a host to add many guests at once by uploading a CSV or
Excel (`.xlsx`) file. The flow is:

1. Host opens a **Bulk upload** dialog from the guest-add card.
2. Host downloads a formatted template (`.csv` or `.xlsx`).
3. Host fills the template and uploads it.
4. System parses the file, validates every row, flags duplicates, and shows the
   data in an **editable preview table** inside the dialog.
5. Host edits any rows inline (errors block save), removes unwanted/duplicate
   rows, then saves.
6. Valid guests are inserted in a single batch. After save, behavior matches the
   existing single-add flow (reload guest list + success toast).

## 2. Decisions (locked)

| Topic | Decision |
|-------|----------|
| File formats | CSV **and** Excel (`.xlsx`). Single library: SheetJS (`xlsx`). |
| Template download | Both `.csv` and `.xlsx` offered. |
| Invalid rows | Inline-editable; **Save is blocked while any row has an error**. |
| Duplicates | Flagged in preview (within-file + against existing event guests); host decides per row. |
| Scale | Up to ~500 guests per upload. Single batch insert; full (non-virtualized) preview table. |
| Entry point | Button **inside** the existing `AddGuestFormComponent` card (not a separate card). |

## 3. Tech context

- **Framework:** Angular 22 standalone components, signals.
- **Backend:** Supabase (`guests` table).
- **Dialogs:** Angular Material Dialog (`MatDialog`), responsive mobile-sheet /
  desktop-modal pattern as in `HostDashboardComponent.openEditDialog()`.
- **Styling:** custom CSS variables + existing class conventions
  (`.ag-card`, field/label/input, `.badge`, etc.). No Tailwind.
- **Validation regexes** (reuse verbatim from `add-guest-form.component.ts`):
  - `PHONE_REGEX = /^\+?[\d\s\-()]{7,15}$/`
  - `EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`

## 4. Guest data shape

The `guests` table rows used here:

```ts
{
  event_id: string;       // FK to events
  display_name: string;   // required
  phone_number: string | null;
  email: string | null;
}
```

(`id`, `created_at` are managed by Supabase. `rsvps` is joined on read only.)

## 5. Components & modules

### 5.1 `guest-import.ts` (pure helper module)

Location: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.ts`

No Angular/DOM dependencies (except the `xlsx` lib) so it is unit-testable in
isolation. Exports:

- **Types**
  ```ts
  export interface ParsedGuestRow {
    display_name: string;
    phone_number: string;
    email: string;
  }

  export type RowIssue = 'name_required' | 'invalid_phone' | 'invalid_email'
                       | 'duplicate_in_file' | 'duplicate_existing';

  export interface AnnotatedGuestRow extends ParsedGuestRow {
    rowId: string;            // stable client id for tracking edits
    issues: RowIssue[];       // validation + duplicate flags
  }
  ```

- **`parseFile(file: File): Promise<ParsedGuestRow[]>`**
  - Reads the file via `FileReader` (array buffer), uses
    `XLSX.read(...)` → first sheet → `XLSX.utils.sheet_to_json(..., { header: 1 })`
    or `sheet_to_json` with header detection.
  - Header mapping is **case-insensitive** and tolerant of common variants:
    - name: `name`, `full name`, `display name`, `guest name`
    - phone: `phone`, `phone number`, `mobile`, `contact`
    - email: `email`, `e-mail`, `email address`
  - Trims all cell values. Skips fully-empty rows.
  - Throws a typed error for unreadable / unsupported files (caught by dialog).

- **`validateRows(rows: ParsedGuestRow[], existingGuests: ExistingGuestKey[]): AnnotatedGuestRow[]`**
  - Assigns a `rowId` (sequential, e.g. `row-0`, `row-1` — no `Math.random`).
  - Per row, computes `issues`:
    - `name_required` if `display_name` empty.
    - `invalid_phone` if phone non-empty and fails `PHONE_REGEX`.
    - `invalid_email` if email non-empty and fails `EMAIL_REGEX`.
    - `duplicate_in_file` if an earlier row shares the same normalized email OR
      phone (case-insensitive email; digits-only phone).
    - `duplicate_existing` if it matches an existing guest's email or phone.
  - `existingGuests` is a pre-normalized key list passed in by the dialog
    (`{ email, phone }` lowercased / digit-normalized), so the helper stays pure.

- **`buildTemplate(format: 'csv' | 'xlsx'): Blob`**
  - Columns: `Name`, `Phone`, `Email` + 1–2 example rows.
  - Uses `XLSX.utils.aoa_to_sheet` → `XLSX.write` to the requested type.

- **Re-validation helper** for inline edits: `revalidateRow(row, allRows, existing)`
  recomputes a single row's `issues` after a cell edit (used by the dialog on
  each change so highlights and the save-enabled state stay live).

### 5.2 `bulk-upload-dialog.component` (Material dialog)

Location: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/`
Files: `.ts`, `.html`, `.css`.

- **Dialog data in:** `{ eventId: string; existingGuests: ExistingGuestKey[] }`.
- **Dialog result out:** `number` (count of guests inserted) on success, or
  `undefined` on cancel — so the host dashboard can refresh + toast.
- **State (signals):**
  - `step: 'upload' | 'preview'`
  - `rows: AnnotatedGuestRow[]`
  - `fileError: string | null`
  - `isSaving: boolean`
- **Computed:**
  - `validCount`, `errorCount`, `duplicateCount`
  - `canSave = rows.length > 0 && errorCount === 0` (rows with only duplicate
    flags are still saveable — duplicates are a warning, not a hard error, but
    the host removes them manually if undesired).
- **Behavior:**
  - **Step 1 (upload):** two template-download buttons; a drop-zone + hidden
    `<input type="file" accept=".csv,.xlsx">`. On file selected →
    `parseFile` → `validateRows` → switch to preview. Parse failure → set
    `fileError`, stay on step 1.
  - **Step 2 (preview):** editable table. Each editable cell is an `<input>`
    bound to the row; on `input`/`blur`, call `revalidateRow` for that row
    (and re-run cross-row duplicate detection). Invalid cells get an
    `.cell-error` class + tooltip/inline message; duplicate rows get a badge.
    A remove (✕) button per row deletes it from `rows`. Footer shows the
    counts and Cancel / Save.
  - **Save:** filter out rows the host removed (already gone) and any with hard
    errors (guarded by `canSave`); map to insert payloads; call
    `supabase.addGuestsBulk`. On success `dialogRef.close(insertedCount)`. On
    failure → toast/inline error, keep dialog open (no data loss).

### 5.3 `AddGuestFormComponent` change

Add a **Bulk upload** button to the card template. Inject `MatDialog`. On click,
open `BulkUploadDialogComponent` with the responsive sizing logic (copy the
mobile/desktop branch from `HostDashboardComponent.openEditDialog`). It needs
`existingGuests` to pass into the dialog — add an `@Input() existingGuests` (the
current `guests()` list, normalized) supplied by the parent, OR emit an event so
the parent opens the dialog. **Chosen approach:** the parent
(`HostDashboardComponent`) owns the dialog (it already owns `MatDialog`, the
guest list, and the post-save refresh). `AddGuestFormComponent` emits a new
`(bulkUploadRequested)` output; the dashboard opens the dialog and handles the
result. This keeps data flow consistent with the existing
`guestAdded`/`guestDeleted` event pattern.

### 5.4 `HostDashboardComponent` change

- Add `openBulkUpload()` that builds the normalized `existingGuests` key list
  from `this.guests()`, opens `BulkUploadDialogComponent` (responsive sizing),
  and on a numeric result: `await this.loadGuests(...)` + success toast
  (`"<n> guests added successfully!"`).
- Wire `(bulkUploadRequested)="openBulkUpload()"` on `<app-add-guest-form>`.

### 5.5 `Supabase` service change

Add:

```ts
async addGuestsBulk(
  eventId: string,
  guests: Array<{ display_name: string; phone_number?: string | null; email?: string | null }>
) {
  const rows = guests.map(g => ({
    event_id: eventId,
    display_name: g.display_name,
    phone_number: g.phone_number || null,
    email: g.email || null,
  }));
  const { data, error } = await this.supabase.from('guests').insert(rows).select();
  if (error) throw error;
  return data;
}
```

## 6. Data flow

```
File picked
  → guest-import.parseFile(file)            (xlsx → rows)
  → guest-import.validateRows(rows, existing) (annotate issues + dupes)
  → dialog preview (signals)  ⇄  inline edits → revalidateRow
  → Save: rows.filter(no hard errors)
  → Supabase.addGuestsBulk(eventId, payload)  (single batch insert)
  → dialogRef.close(count)
  → HostDashboard.loadGuests() + toast        (same as single-add)
```

## 7. Error handling

| Situation | Handling |
|-----------|----------|
| Unreadable / wrong format file | `parseFile` throws typed error → dialog shows `fileError`, stays on upload step. |
| File parses to 0 rows | Preview shows "No rows found." message; Save disabled. |
| Row-level validation errors | Cell highlighted + message; Save disabled until cleared. |
| Duplicate rows | Badge shown; host removes manually; does NOT block save. |
| Batch insert fails | Toast/inline error; dialog stays open, rows preserved. |

## 8. Dependencies

- Add `xlsx` (SheetJS) to `package.json`. No other new deps.

## 9. Testing (Vitest)

Unit tests for `guest-import.ts`:

- Header mapping: exact + variant + case-insensitive headers map correctly.
- Valid rows produce no issues.
- Missing name → `name_required`.
- Bad phone / bad email → respective issue; empty phone/email → no issue.
- Duplicate within file → `duplicate_in_file` on the later row only.
- Duplicate vs existing guests → `duplicate_existing`.
- Empty / whitespace-only rows skipped.
- `buildTemplate('csv')` and `buildTemplate('xlsx')` produce a parseable file
  with the expected header columns.

Component-level: lightweight test that `canSave` is false with an error row and
true once cleared (if practical within existing test setup).

## 10. Out of scope (YAGNI)

- Server-side parsing / Edge Function for import (client-side is sufficient at
  ~500 rows).
- Column re-mapping UI (auto header mapping covers the template + common variants).
- Virtualized/paginated preview (not needed at ~500 rows).
- Auto-sending invitations on import (host uses existing per-guest send flow).
- Updating/merging existing guests (duplicates are flagged, not merged).

## 11. File checklist

**New:**
- `bulk-upload-dialog/bulk-upload-dialog.component.ts|html|css`
- `bulk-upload-dialog/guest-import.ts`
- `bulk-upload-dialog/guest-import.spec.ts`

**Modified:**
- `core/services/supabase/supabase.ts` (`addGuestsBulk`)
- `add-guest-form/add-guest-form.component.ts|html` (Bulk upload button + output)
- `host-dashboard.component.ts|html` (`openBulkUpload`, wiring)
- `package.json` (`xlsx`)

> Note: this project is not a git repository, so the spec is saved to disk but
> not committed.
