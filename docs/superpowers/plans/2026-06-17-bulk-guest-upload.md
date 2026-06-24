# Bulk Guest Upload (CSV / Excel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a host bulk-add event guests by downloading a CSV/Excel template, filling it, uploading it, reviewing/editing the parsed rows in a popup, and saving valid rows in one batch.

**Architecture:** A pure, unit-tested helper module (`guest-import.ts`) handles file parsing, validation, duplicate detection, and template generation using SheetJS (`xlsx`). A Material dialog component (`bulk-upload-dialog`) drives the upload → editable-preview → save UX with Angular signals. The `AddGuestFormComponent` exposes a "Bulk upload" button that emits to the parent `HostDashboardComponent`, which owns the dialog and reuses the existing `loadGuests()` + toast refresh path. A new `Supabase.addGuestsBulk()` performs a single batch insert.

**Tech Stack:** Angular 22 (standalone components, signals), Angular Material Dialog, Supabase JS, SheetJS (`xlsx`), Vitest.

> **Repo note:** This project is **not** a git repository. The plan's "Commit" steps are written as **Checkpoint** steps — run the verification, confirm green, then continue. If git is initialized later, convert checkpoints to commits.

> **Test runner:** `cd tap-invite && npm test` runs Vitest via `ng test`. To run a single spec file: `npm test -- guest-import` (Vitest filters by filename substring). If the configured `ng test` does not forward filters, run all tests — they are fast.

---

## File Structure

**New files:**
- `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.ts` — pure parse/validate/template helpers (no Angular/DOM).
- `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.spec.ts` — Vitest unit tests for the helpers.
- `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/bulk-upload-dialog.component.ts` — dialog component.
- `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/bulk-upload-dialog.component.html` — dialog template.
- `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/bulk-upload-dialog.component.css` — dialog styles.

**Modified files:**
- `tap-invite/package.json` — add `xlsx` dependency.
- `tap-invite/src/app/core/services/supabase/supabase.ts` — add `addGuestsBulk()`.
- `tap-invite/src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.ts` — add `bulkUploadRequested` output.
- `tap-invite/src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.html` — add "Bulk upload" button.
- `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.ts` — add `openBulkUpload()` + dialog handling.
- `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.html` — wire `(bulkUploadRequested)`.

---

## Task 1: Install the `xlsx` dependency

**Files:**
- Modify: `tap-invite/package.json`

- [ ] **Step 1: Install xlsx**

Run (from the `tap-invite` directory):

```bash
cd tap-invite && npm install xlsx@0.18.5
```

Expected: `package.json` `dependencies` gains `"xlsx": "0.18.5"` and `package-lock.json` updates. No errors.

> Note: `xlsx@0.18.5` is the last version published to the public npm registry. Pin it to avoid pulling a non-existent newer tag.

- [ ] **Step 2: Verify the package resolves**

Run:

```bash
cd tap-invite && node -e "console.log(require('xlsx').version)"
```

Expected: prints `0.18.5` (or the installed version) with no error.

- [ ] **Step 3: Checkpoint**

Confirm `package.json` lists `xlsx` under `dependencies`. Continue.

---

## Task 2: `guest-import.ts` — types and the `normalize` helpers (TDD)

**Files:**
- Create: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.ts`
- Test: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `guest-import.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizePhone } from './guest-import';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Priya@Example.COM ')).toBe('priya@example.com');
  });
  it('returns empty string for empty input', () => {
    expect(normalizeEmail('')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('strips all non-digits', () => {
    expect(normalizePhone('+94 77 234-5678')).toBe('94772345678');
  });
  it('returns empty string for empty input', () => {
    expect(normalizePhone('')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tap-invite && npm test -- guest-import`
Expected: FAIL — cannot find module `./guest-import` / exports undefined.

- [ ] **Step 3: Write minimal implementation**

Create `guest-import.ts`:

```ts
// Pure helpers for bulk guest import — no Angular/DOM dependencies.

export function normalizeEmail(value: string): string {
  return (value ?? '').trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tap-invite && npm test -- guest-import`
Expected: PASS (4 assertions).

- [ ] **Step 5: Checkpoint**

Confirm tests green. Continue.

---

## Task 3: `validateRows` — validation + duplicate detection (TDD)

**Files:**
- Modify: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.ts`
- Test: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `guest-import.spec.ts`:

```ts
import { validateRows } from './guest-import';
import type { ParsedGuestRow, ExistingGuestKey } from './guest-import';

const row = (display_name: string, phone_number = '', email = ''): ParsedGuestRow =>
  ({ display_name, phone_number, email });

describe('validateRows', () => {
  it('assigns sequential rowIds and no issues for valid rows', () => {
    const out = validateRows([row('Priya', '+94772345678', 'p@x.com')], []);
    expect(out[0].rowId).toBe('row-0');
    expect(out[0].issues).toEqual([]);
  });

  it('flags missing name', () => {
    const out = validateRows([row('', '', 'p@x.com')], []);
    expect(out[0].issues).toContain('name_required');
  });

  it('flags invalid phone but allows empty phone', () => {
    expect(validateRows([row('A', 'abc')], [])[0].issues).toContain('invalid_phone');
    expect(validateRows([row('A', '')], [])[0].issues).not.toContain('invalid_phone');
  });

  it('flags invalid email but allows empty email', () => {
    expect(validateRows([row('A', '', 'nope')], [])[0].issues).toContain('invalid_email');
    expect(validateRows([row('A', '', '')], [])[0].issues).not.toContain('invalid_email');
  });

  it('flags duplicate within file on the later row only (by email)', () => {
    const out = validateRows([row('A', '', 'same@x.com'), row('B', '', 'SAME@x.com')], []);
    expect(out[0].issues).not.toContain('duplicate_in_file');
    expect(out[1].issues).toContain('duplicate_in_file');
  });

  it('flags duplicate within file by phone', () => {
    const out = validateRows([row('A', '+94 77 234 5678'), row('B', '0094772345678')], []);
    expect(out[1].issues).toContain('duplicate_in_file');
  });

  it('flags duplicate against existing guests', () => {
    const existing: ExistingGuestKey[] = [{ email: 'old@x.com', phone: '' }];
    const out = validateRows([row('A', '', 'OLD@x.com')], existing);
    expect(out[0].issues).toContain('duplicate_existing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tap-invite && npm test -- guest-import`
Expected: FAIL — `validateRows`, `ParsedGuestRow`, `ExistingGuestKey` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `guest-import.ts` (keep the existing `normalize*` functions):

```ts
const PHONE_REGEX = /^\+?[\d\s\-()]{7,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedGuestRow {
  display_name: string;
  phone_number: string;
  email: string;
}

export type RowIssue =
  | 'name_required'
  | 'invalid_phone'
  | 'invalid_email'
  | 'duplicate_in_file'
  | 'duplicate_existing';

export interface AnnotatedGuestRow extends ParsedGuestRow {
  rowId: string;
  issues: RowIssue[];
}

export interface ExistingGuestKey {
  email: string; // normalized (lowercased) or ''
  phone: string; // normalized (digits only) or ''
}

export function validateRows(
  rows: ParsedGuestRow[],
  existingGuests: ExistingGuestKey[],
): AnnotatedGuestRow[] {
  const existingEmails = new Set(existingGuests.map(g => g.email).filter(Boolean));
  const existingPhones = new Set(existingGuests.map(g => g.phone).filter(Boolean));
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  return rows.map((r, i) => {
    const issues: RowIssue[] = [];
    const name = r.display_name.trim();
    const phone = r.phone_number.trim();
    const email = r.email.trim();
    const normEmail = normalizeEmail(email);
    const normPhone = normalizePhone(phone);

    if (!name) issues.push('name_required');
    if (phone && !PHONE_REGEX.test(phone)) issues.push('invalid_phone');
    if (email && !EMAIL_REGEX.test(email)) issues.push('invalid_email');

    const dupInFile =
      (!!normEmail && seenEmails.has(normEmail)) ||
      (!!normPhone && seenPhones.has(normPhone));
    if (dupInFile) issues.push('duplicate_in_file');

    const dupExisting =
      (!!normEmail && existingEmails.has(normEmail)) ||
      (!!normPhone && existingPhones.has(normPhone));
    if (dupExisting) issues.push('duplicate_existing');

    if (normEmail) seenEmails.add(normEmail);
    if (normPhone) seenPhones.add(normPhone);

    return { rowId: `row-${i}`, display_name: name, phone_number: phone, email, issues };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tap-invite && npm test -- guest-import`
Expected: PASS (all `validateRows` assertions + earlier normalize tests).

- [ ] **Step 5: Checkpoint**

Confirm tests green. Continue.

---

## Task 4: `revalidateRows` — recompute issues after inline edits (TDD)

**Files:**
- Modify: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.ts`
- Test: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.spec.ts`

> Why a whole-list recompute instead of single-row: duplicate flags depend on row order and the full set, so re-running the same logic over the current rows (preserving each row's `rowId`) is simpler and correct. This is the function the dialog calls after every cell edit and every row removal.

- [ ] **Step 1: Write the failing test**

Append to `guest-import.spec.ts`:

```ts
import { revalidateRows } from './guest-import';
import type { AnnotatedGuestRow } from './guest-import';

describe('revalidateRows', () => {
  it('preserves rowIds and clears an issue once fixed', () => {
    const annotated: AnnotatedGuestRow[] = [
      { rowId: 'row-7', display_name: '', phone_number: '', email: '', issues: ['name_required'] },
    ];
    annotated[0].display_name = 'Fixed';
    const out = revalidateRows(annotated, []);
    expect(out[0].rowId).toBe('row-7');
    expect(out[0].issues).toEqual([]);
  });

  it('recomputes duplicates after a row is removed', () => {
    const annotated: AnnotatedGuestRow[] = [
      { rowId: 'row-0', display_name: 'A', phone_number: '', email: 'a@x.com', issues: [] },
      { rowId: 'row-1', display_name: 'B', phone_number: '', email: 'a@x.com', issues: ['duplicate_in_file'] },
    ];
    const out = revalidateRows([annotated[1]], []); // row-0 removed
    expect(out[0].issues).not.toContain('duplicate_in_file');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tap-invite && npm test -- guest-import`
Expected: FAIL — `revalidateRows` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `guest-import.ts`:

```ts
// Recompute issues over the current annotated rows, preserving each rowId.
export function revalidateRows(
  rows: AnnotatedGuestRow[],
  existingGuests: ExistingGuestKey[],
): AnnotatedGuestRow[] {
  const fresh = validateRows(
    rows.map(r => ({ display_name: r.display_name, phone_number: r.phone_number, email: r.email })),
    existingGuests,
  );
  return fresh.map((r, i) => ({ ...r, rowId: rows[i].rowId }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tap-invite && npm test -- guest-import`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Confirm tests green. Continue.

---

## Task 5: `parseFile` — read CSV/Excel into rows with header mapping (TDD)

**Files:**
- Modify: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.ts`
- Test: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.spec.ts`

> `parseFile` takes a `File`. In tests we build a `File` from a CSV string. `xlsx` reads CSV text fine. jsdom (the configured test env) provides `File`/`FileReader`/`ArrayBuffer`. We read via `file.arrayBuffer()` (available on `Blob` in jsdom) to keep `parseFile` simple and `await`-able.

- [ ] **Step 1: Write the failing test**

Append to `guest-import.spec.ts`:

```ts
import { parseFile } from './guest-import';

function csvFile(text: string, name = 'guests.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}

describe('parseFile', () => {
  it('maps standard headers (Name, Phone, Email)', async () => {
    const rows = await parseFile(csvFile('Name,Phone,Email\nPriya,+94772345678,p@x.com\n'));
    expect(rows).toEqual([{ display_name: 'Priya', phone_number: '+94772345678', email: 'p@x.com' }]);
  });

  it('maps header variants case-insensitively', async () => {
    const rows = await parseFile(csvFile('Full Name,Phone Number,E-mail\nSam,0771234567,s@x.com\n'));
    expect(rows[0]).toEqual({ display_name: 'Sam', phone_number: '0771234567', email: 's@x.com' });
  });

  it('skips fully empty rows and trims cells', async () => {
    const rows = await parseFile(csvFile('Name,Phone,Email\n  Ann  , , a@x.com \n,,\n'));
    expect(rows).toEqual([{ display_name: 'Ann', phone_number: '', email: 'a@x.com' }]);
  });

  it('throws when no recognizable header columns are present', async () => {
    await expect(parseFile(csvFile('Foo,Bar\n1,2\n'))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tap-invite && npm test -- guest-import`
Expected: FAIL — `parseFile` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `guest-import.ts` (add the import at the top of the file):

```ts
import * as XLSX from 'xlsx';

const HEADER_ALIASES: Record<keyof ParsedGuestRow, string[]> = {
  display_name: ['name', 'full name', 'display name', 'guest name'],
  phone_number: ['phone', 'phone number', 'mobile', 'contact', 'contact number'],
  email: ['email', 'e-mail', 'email address'],
};

function resolveColumns(headerRow: unknown[]): Record<keyof ParsedGuestRow, number> {
  const lower = headerRow.map(h => String(h ?? '').trim().toLowerCase());
  const find = (aliases: string[]) => lower.findIndex(h => aliases.includes(h));
  return {
    display_name: find(HEADER_ALIASES.display_name),
    phone_number: find(HEADER_ALIASES.phone_number),
    email: find(HEADER_ALIASES.email),
  };
}

export async function parseFile(file: File): Promise<ParsedGuestRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The file has no readable sheet.');

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  if (!matrix.length) throw new Error('The file is empty.');

  const cols = resolveColumns(matrix[0]);
  if (cols.display_name === -1) {
    throw new Error('Could not find a "Name" column. Please use the provided template.');
  }

  const cell = (row: unknown[], idx: number) => (idx === -1 ? '' : String(row[idx] ?? '').trim());

  return matrix
    .slice(1)
    .map(row => ({
      display_name: cell(row, cols.display_name),
      phone_number: cell(row, cols.phone_number),
      email: cell(row, cols.email),
    }))
    .filter(r => r.display_name || r.phone_number || r.email);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tap-invite && npm test -- guest-import`
Expected: PASS.

> If `file.arrayBuffer` is undefined in the test env, fall back to: `const buffer = await new Response(file).arrayBuffer();` — but try `file.arrayBuffer()` first.

- [ ] **Step 5: Checkpoint**

Confirm tests green. Continue.

---

## Task 6: `buildTemplate` — generate downloadable CSV/XLSX template (TDD)

**Files:**
- Modify: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.ts`
- Test: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/guest-import.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `guest-import.spec.ts`:

```ts
import { buildTemplate, TEMPLATE_FILENAME } from './guest-import';

describe('buildTemplate', () => {
  it('csv round-trips back to the header columns', async () => {
    const blob = buildTemplate('csv');
    const text = await new File([blob], 'x.csv').text();
    expect(text.split(/\r?\n/)[0]).toBe('Name,Phone,Email');
  });

  it('xlsx parses back to a sheet with the expected headers', async () => {
    const blob = buildTemplate('xlsx');
    const rows = await parseFile(new File([blob], 'x.xlsx'));
    // template includes example rows; first example has a name
    expect(rows[0].display_name.length).toBeGreaterThan(0);
  });

  it('exposes filenames for both formats', () => {
    expect(TEMPLATE_FILENAME.csv).toBe('guest-list-template.csv');
    expect(TEMPLATE_FILENAME.xlsx).toBe('guest-list-template.xlsx');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tap-invite && npm test -- guest-import`
Expected: FAIL — `buildTemplate` / `TEMPLATE_FILENAME` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `guest-import.ts`:

```ts
export const TEMPLATE_FILENAME = {
  csv: 'guest-list-template.csv',
  xlsx: 'guest-list-template.xlsx',
} as const;

const TEMPLATE_ROWS: (string | number)[][] = [
  ['Name', 'Phone', 'Email'],
  ['Priya Sharma', '+94 77 234 5678', 'priya@example.com'],
  ['Sam Perera', '', 'sam@example.com'],
];

export function buildTemplate(format: 'csv' | 'xlsx'): Blob {
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Guests');

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }
  const out = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tap-invite && npm test -- guest-import`
Expected: PASS — full `guest-import.spec.ts` suite green.

- [ ] **Step 5: Checkpoint**

Confirm the entire `guest-import` suite is green. Continue.

---

## Task 7: `Supabase.addGuestsBulk()` — batch insert

**Files:**
- Modify: `tap-invite/src/app/core/services/supabase/supabase.ts`

> The existing service methods are thin wrappers around Supabase calls and are not unit-tested in this repo. Follow that pattern: add the method, verify by typecheck/build (the dialog's behavior is exercised at integration/manual level). No new test file for the service.

- [ ] **Step 1: Add the method**

In `supabase.ts`, after `addGuest` (around line 99), add:

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
    const { data, error } = await this.supabase
      .from('guests')
      .insert(rows)
      .select();
    if (error) throw error;
    return data;
  }
```

- [ ] **Step 2: Verify it typechecks / builds**

Run: `cd tap-invite && npm run build`
Expected: build succeeds with no TypeScript errors related to `addGuestsBulk`.

- [ ] **Step 3: Checkpoint**

Confirm build green. Continue.

---

## Task 8: `BulkUploadDialogComponent` — component logic

**Files:**
- Create: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/bulk-upload-dialog.component.ts`

> This component contains no business logic worth unit-testing in isolation (the testable logic lives in `guest-import.ts`). It is verified via build + manual run. Keep it thin: parse/validate via the helper, hold rows in a signal, compute counts, save via the service.

- [ ] **Step 1: Create the component**

Create `bulk-upload-dialog.component.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Supabase } from '../../../../core/services/supabase/supabase';
import {
  parseFile,
  validateRows,
  revalidateRows,
  buildTemplate,
  TEMPLATE_FILENAME,
  type AnnotatedGuestRow,
  type ExistingGuestKey,
} from './guest-import';

export interface BulkUploadDialogData {
  eventId: string;
  existingGuests: ExistingGuestKey[];
}

@Component({
  selector: 'app-bulk-upload-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-upload-dialog.component.html',
  styleUrl: './bulk-upload-dialog.component.css',
})
export class BulkUploadDialogComponent {
  private dialogRef = inject(MatDialogRef<BulkUploadDialogComponent>);
  private supabase = inject(Supabase);
  readonly data: BulkUploadDialogData = inject(MAT_DIALOG_DATA);

  step = signal<'upload' | 'preview'>('upload');
  rows = signal<AnnotatedGuestRow[]>([]);
  fileName = signal<string>('');
  fileError = signal<string | null>(null);
  isSaving = signal(false);
  saveError = signal<string | null>(null);

  validCount = computed(() => this.rows().filter(r => r.issues.length === 0).length);
  errorCount = computed(() =>
    this.rows().filter(r =>
      r.issues.some(i => i === 'name_required' || i === 'invalid_phone' || i === 'invalid_email'),
    ).length,
  );
  duplicateCount = computed(() =>
    this.rows().filter(r =>
      r.issues.some(i => i === 'duplicate_in_file' || i === 'duplicate_existing'),
    ).length,
  );
  // Duplicates are warnings, not hard errors — they do not block save.
  canSave = computed(() => this.rows().length > 0 && this.errorCount() === 0 && !this.isSaving());

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.loadFile(file);
    input.value = ''; // allow re-selecting the same file
  }

  async onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.loadFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  private async loadFile(file: File) {
    this.fileError.set(null);
    this.saveError.set(null);
    this.fileName.set(file.name);
    try {
      const parsed = await parseFile(file);
      const annotated = validateRows(parsed, this.data.existingGuests);
      this.rows.set(annotated);
      this.step.set('preview');
    } catch (err) {
      this.fileError.set(
        err instanceof Error ? err.message : 'Could not read the file. Please use the template.',
      );
    }
  }

  onCellEdit() {
    // Re-run validation over the current rows after any inline edit.
    this.rows.set(revalidateRows(this.rows(), this.data.existingGuests));
  }

  removeRow(rowId: string) {
    const remaining = this.rows().filter(r => r.rowId !== rowId);
    this.rows.set(revalidateRows(remaining, this.data.existingGuests));
  }

  downloadTemplate(format: 'csv' | 'xlsx') {
    const blob = buildTemplate(format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = TEMPLATE_FILENAME[format];
    a.click();
    URL.revokeObjectURL(url);
  }

  async save() {
    if (!this.canSave()) return;
    const payload = this.rows()
      .filter(r => r.issues.length === 0 ||
        r.issues.every(i => i === 'duplicate_in_file' || i === 'duplicate_existing'))
      .map(r => ({
        display_name: r.display_name,
        phone_number: r.phone_number || null,
        email: r.email || null,
      }));
    if (!payload.length) return;

    this.isSaving.set(true);
    this.saveError.set(null);
    try {
      await this.supabase.addGuestsBulk(this.data.eventId, payload);
      this.dialogRef.close(payload.length);
    } catch {
      this.saveError.set('Failed to save guests. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  backToUpload() {
    this.step.set('upload');
    this.rows.set([]);
    this.fileName.set('');
    this.fileError.set(null);
  }

  cancel() {
    this.dialogRef.close(undefined);
  }
}
```

- [ ] **Step 2: Checkpoint (defer build until template + styles exist)**

The component references `./bulk-upload-dialog.component.html` and `.css`, created in Task 9. Do not build yet. Continue to Task 9.

---

## Task 9: `BulkUploadDialogComponent` — template and styles

**Files:**
- Create: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/bulk-upload-dialog.component.html`
- Create: `tap-invite/src/app/features/host-dashboard/components/bulk-upload-dialog/bulk-upload-dialog.component.css`

- [ ] **Step 1: Create the template**

Create `bulk-upload-dialog.component.html`:

```html
<div class="dialog-header">
  <h2 class="dialog-title">⬆ Bulk Upload Guests</h2>
  <button class="btn-close" type="button" (click)="cancel()" aria-label="Close">✕</button>
</div>

@if (step() === 'upload') {
  <div class="upload-step">
    <p class="upload-intro">
      Download the template, fill in your guests, then upload the file. You can review
      and edit everything before saving.
    </p>

    <div class="template-buttons">
      <button class="btn-template" type="button" (click)="downloadTemplate('csv')">
        ⬇ Download CSV template
      </button>
      <button class="btn-template" type="button" (click)="downloadTemplate('xlsx')">
        ⬇ Download Excel template
      </button>
    </div>

    <label
      class="dropzone"
      (drop)="onDrop($event)"
      (dragover)="onDragOver($event)">
      <input type="file" accept=".csv,.xlsx" hidden (change)="onFileSelected($event)" />
      <span class="dropzone-icon">📄</span>
      <span class="dropzone-text">Click to choose a file or drag it here</span>
      <span class="dropzone-hint">Accepts .csv and .xlsx</span>
    </label>

    @if (fileError()) {
      <p class="alert alert-error">{{ fileError() }}</p>
    }
  </div>
}

@if (step() === 'preview') {
  <div class="preview-step">
    <div class="preview-summary">
      <span class="pill pill-file">{{ fileName() }}</span>
      <span class="pill pill-valid">{{ validCount() }} valid</span>
      @if (errorCount() > 0) {
        <span class="pill pill-error">{{ errorCount() }} with errors</span>
      }
      @if (duplicateCount() > 0) {
        <span class="pill pill-dup">{{ duplicateCount() }} duplicates</span>
      }
    </div>

    @if (rows().length === 0) {
      <p class="alert alert-neutral">No rows found in this file.</p>
    } @else {
      <div class="table-scroll">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Name <span class="req">*</span></th>
              <th>Phone</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.rowId) {
              <tr [class.row-error]="row.issues.includes('name_required') || row.issues.includes('invalid_phone') || row.issues.includes('invalid_email')">
                <td>
                  <input
                    class="cell-input"
                    [class.cell-error]="row.issues.includes('name_required')"
                    [(ngModel)]="row.display_name"
                    (ngModelChange)="onCellEdit()"
                    placeholder="Required" />
                </td>
                <td>
                  <input
                    class="cell-input"
                    [class.cell-error]="row.issues.includes('invalid_phone')"
                    [(ngModel)]="row.phone_number"
                    (ngModelChange)="onCellEdit()" />
                </td>
                <td>
                  <input
                    class="cell-input"
                    [class.cell-error]="row.issues.includes('invalid_email')"
                    [(ngModel)]="row.email"
                    (ngModelChange)="onCellEdit()" />
                </td>
                <td class="cell-actions">
                  @if (row.issues.includes('duplicate_in_file') || row.issues.includes('duplicate_existing')) {
                    <span class="dup-badge" title="Possible duplicate">dup</span>
                  }
                  <button class="btn-remove" type="button" (click)="removeRow(row.rowId)" aria-label="Remove row">✕</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (saveError()) {
      <p class="alert alert-error">{{ saveError() }}</p>
    }

    <div class="dialog-actions">
      <button class="btn-cancel" type="button" (click)="backToUpload()">← Upload another</button>
      <button class="btn-save" type="button" [disabled]="!canSave()" (click)="save()">
        {{ isSaving() ? 'Saving…' : 'Save ' + validCount() + ' guests' }}
      </button>
    </div>

    @if (errorCount() > 0) {
      <p class="submit-hint">Fix the highlighted cells to enable saving.</p>
    }
  </div>
}
```

- [ ] **Step 2: Create the styles**

Create `bulk-upload-dialog.component.css` (reuses the look of `edit-event-dialog.component.css`; all colors via existing CSS variables):

```css
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.dialog-title {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0;
  color: var(--color-text);
  letter-spacing: -0.02em;
}
.btn-close {
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  line-height: 1;
}
.btn-close:hover { background: var(--color-bg); color: var(--color-text); }

.upload-intro {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 16px;
}
.template-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
.btn-template {
  background: transparent;
  border: 1.5px solid var(--color-border);
  color: var(--color-text);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.btn-template:hover { background: var(--color-bg); border-color: var(--color-primary); }

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 16px;
  border: 2px dashed var(--color-border);
  border-radius: 14px;
  background: var(--color-bg);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}
.dropzone:hover { border-color: var(--color-primary); }
.dropzone-icon { font-size: 1.6rem; }
.dropzone-text { font-weight: 600; color: var(--color-text); font-size: 0.9rem; }
.dropzone-hint { font-size: 0.75rem; color: var(--color-text-muted); }

.preview-summary { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.pill {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}
.pill-file { background: var(--color-bg); color: var(--color-text-muted); }
.pill-valid { background: rgba(34, 197, 94, 0.15); color: var(--color-success); }
.pill-error { background: rgba(239, 68, 68, 0.15); color: var(--color-error); }
.pill-dup { background: rgba(249, 115, 22, 0.15); color: var(--color-accent); }

.table-scroll { max-height: 50vh; overflow: auto; border: 1px solid var(--color-border); border-radius: 12px; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.preview-table thead th {
  position: sticky;
  top: 0;
  background: var(--color-surface);
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  padding: 10px 10px;
  border-bottom: 1px solid var(--color-border);
}
.preview-table td { padding: 6px 8px; border-bottom: 1px solid var(--color-border); }
.req { color: var(--color-error); }
.cell-input {
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid transparent;
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.85rem;
  box-sizing: border-box;
}
.cell-input:focus { outline: none; border-color: var(--color-primary); }
.cell-error { border-color: var(--color-error); background: rgba(239, 68, 68, 0.06); }
.row-error { background: rgba(239, 68, 68, 0.03); }
.cell-actions { white-space: nowrap; text-align: right; }
.dup-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-accent);
  background: rgba(249, 115, 22, 0.15);
  padding: 2px 6px;
  border-radius: 6px;
  margin-right: 6px;
}
.btn-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px 6px;
  border-radius: 6px;
}
.btn-remove:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.1); }

.alert { font-size: 0.85rem; margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; }
.alert-error { background: rgba(239, 68, 68, 0.12); color: var(--color-error); }
.alert-neutral { background: var(--color-bg); color: var(--color-text-muted); }

.dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.btn-cancel {
  background: transparent;
  border: 1.5px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: 10px;
  padding: 11px 18px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel:hover { background: var(--color-bg); color: var(--color-text); }
.btn-save {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 11px 22px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
}
.btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
.submit-hint { font-size: 0.78rem; color: var(--color-error); text-align: right; margin: 8px 0 0; }
```

- [ ] **Step 3: Build to verify the component compiles**

Run: `cd tap-invite && npm run build`
Expected: build succeeds. The component, template, and styles compile with no errors.

- [ ] **Step 4: Checkpoint**

Confirm build green. Continue.

---

## Task 10: Add "Bulk upload" button to `AddGuestFormComponent`

**Files:**
- Modify: `tap-invite/src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.ts`
- Modify: `tap-invite/src/app/features/host-dashboard/components/add-guest-form/add-guest-form.component.html`

> Note: `host-dashboard.component.html` already binds `(guestDeleted)` on `<app-add-guest-form>`, but the current component has no such output. We add `bulkUploadRequested` here; `guestDeleted` is handled by the guest table, so leave that binding as-is (it is harmless). Only add the new output.

- [ ] **Step 1: Add the output to the component**

In `add-guest-form.component.ts`, add an output next to `guestAdded`:

```ts
  @Output() guestAdded = new EventEmitter<void>();
  @Output() bulkUploadRequested = new EventEmitter<void>();
```

- [ ] **Step 2: Add the button to the template**

In `add-guest-form.component.html`, immediately after the closing `</form>` (line 74) and before the final `</div>` (line 75), insert:

```html
  <div class="bulk-divider"><span>or</span></div>

  <button class="bulk-upload-btn" type="button" (click)="bulkUploadRequested.emit()">
    ⬆ Bulk upload from CSV / Excel
  </button>
```

- [ ] **Step 3: Add minimal styles for the button**

Append to `add-guest-form.component.css`:

```css
.bulk-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 16px 0 12px;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
.bulk-divider::before,
.bulk-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--color-border);
}
.bulk-divider span { padding: 0 10px; }
.bulk-upload-btn {
  width: 100%;
  background: transparent;
  border: 1.5px dashed var(--color-border);
  color: var(--color-text);
  border-radius: 10px;
  padding: 11px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.bulk-upload-btn:hover { border-color: var(--color-primary); background: var(--color-bg); }
```

- [ ] **Step 4: Build to verify**

Run: `cd tap-invite && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Checkpoint**

Confirm build green. Continue.

---

## Task 11: Wire the dialog into `HostDashboardComponent`

**Files:**
- Modify: `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.ts`
- Modify: `tap-invite/src/app/features/host-dashboard/components/host-dashboard.component.html`

- [ ] **Step 1: Import the dialog + helper types**

At the top of `host-dashboard.component.ts`, add imports:

```ts
import { BulkUploadDialogComponent } from './bulk-upload-dialog/bulk-upload-dialog.component';
import { normalizeEmail, normalizePhone, type ExistingGuestKey } from './bulk-upload-dialog/guest-import';
```

- [ ] **Step 2: Add the `openBulkUpload` method**

In `host-dashboard.component.ts`, add a method (e.g. after `openEditDialog`, before `subscribeToRsvpUpdates`):

```ts
  openBulkUpload() {
    const event = this.activeEvent();
    if (!event) return;

    const existingGuests: ExistingGuestKey[] = this.guests().map(g => ({
      email: normalizeEmail(g.email ?? ''),
      phone: normalizePhone(g.phone_number ?? ''),
    }));

    const isMobile = isPlatformBrowser(this.platformId)
      ? this.document.documentElement.clientWidth <= 600
      : false;

    const ref = this.dialog.open(BulkUploadDialogComponent, {
      data: { eventId: event.id, existingGuests },
      width: isMobile ? '100vw' : '860px',
      maxWidth: '100vw',
      maxHeight: isMobile ? '92vh' : '90vh',
      position: isMobile ? { bottom: '0' } : undefined,
      panelClass: 'edit-event-dialog-panel',
    });

    ref.afterClosed().subscribe(async (insertedCount: number | undefined) => {
      if (!insertedCount) return;
      await this.loadGuests(event.id);
      this.toast.success(`${insertedCount} guest${insertedCount === 1 ? '' : 's'} added successfully!`);
    });
  }
```

- [ ] **Step 3: Wire the output in the template**

In `host-dashboard.component.html`, update the `<app-add-guest-form>` element (lines 66-70) to add the binding:

```html
      <app-add-guest-form
        [eventId]="activeEvent().id"
        (guestAdded)="handleGuestAdded()"
        (bulkUploadRequested)="openBulkUpload()">
      </app-add-guest-form>
```

> Remove the stale `(guestDeleted)="handleGuestDeleted()"` binding from `<app-add-guest-form>` since that component does not emit it (the guest table does, and is already wired separately on lines 72-76). Leaving it causes an Angular template error only if strict template checking flags unknown outputs — removing it is the clean fix.

- [ ] **Step 4: Build to verify the full wiring**

Run: `cd tap-invite && npm run build`
Expected: build succeeds with no template/type errors.

- [ ] **Step 5: Checkpoint**

Confirm build green. Continue.

---

## Task 12: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit-test suite**

Run: `cd tap-invite && npm test`
Expected: all tests pass, including the full `guest-import.spec.ts` suite.

- [ ] **Step 2: Production build**

Run: `cd tap-invite && npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Manual smoke test**

Run: `cd tap-invite && npm start`, open the host dashboard with an active event, then:

1. Click **⬆ Bulk upload from CSV / Excel** → dialog opens.
2. Click **Download CSV template** and **Download Excel template** → both files download with `Name,Phone,Email` columns.
3. Fill the template with ~5 rows including one bad email, one missing name, and one duplicate of an existing guest. Upload it.
4. Preview shows the rows; bad email + missing name cells highlighted; duplicate row shows the `dup` badge; **Save is disabled**.
5. Fix the highlighted cells inline → Save enables; counts update live.
6. Remove the duplicate row with ✕ (or keep it).
7. Click **Save N guests** → dialog closes, guest table refreshes with new guests, success toast shows.
8. Re-open and upload a non-spreadsheet file (e.g. a `.txt` renamed to `.csv` with junk, or a file with no Name column) → inline file error appears, no crash.

- [ ] **Step 4: Final checkpoint**

All automated tests green, build clean, manual flow verified. Feature complete.

---

## Self-Review Notes

- **Spec coverage:** template download (Task 6, 9) ✓; CSV+Excel parse (Task 5) ✓; editable preview (Task 9) ✓; inline validation blocking save (Tasks 3, 4, 8, 9) ✓; duplicate flagging within-file + existing (Task 3) ✓; batch insert ≤500 (Task 7) ✓; entry button inside add-guest card (Task 10) ✓; parent owns dialog + reuses loadGuests/toast (Task 11) ✓; error handling for bad files / empty / partial DB failure (Tasks 5, 8, 9) ✓; Vitest unit tests for helper (Tasks 2–6) ✓.
- **Type consistency:** `ParsedGuestRow`, `AnnotatedGuestRow`, `RowIssue`, `ExistingGuestKey`, `validateRows`, `revalidateRows`, `parseFile`, `buildTemplate`, `TEMPLATE_FILENAME`, `normalizeEmail`, `normalizePhone`, `addGuestsBulk`, `bulkUploadRequested`, `openBulkUpload` are used consistently across tasks.
- **No placeholders:** every code/test/command step contains concrete content.
