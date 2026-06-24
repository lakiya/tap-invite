# Wedding Book Template + RSVP Visibility Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-sided ivory-and-gold wedding invitation template with a 3-state book-flip animation, plus an event-level toggle that hides the Accept/Decline RSVP section across all invitation templates.

**Architecture:** The RSVP toggle adds `show_rsvp` and `notes` columns to the Supabase `events` table; the Angular `EventData` interface and edit-event-dialog are extended to carry and persist them. All three existing templates get a guard around their RSVP section. The new `wedding-book` template is a standalone Angular component with three CSS-driven 3D states (`cover`, `inside`, `back`) using `rotateY` transforms on individually animated faces sharing a single `perspective` context; it is registered in the template registry using the existing manifest + lazy-load pattern.

**Tech Stack:** Angular 17+ (standalone components, signals, `@if`/`@else` control flow), Supabase PostgreSQL, CSS 3D transforms, Google Fonts (Playfair Display).

## Global Constraints

- All templates implement `TemplateComponent` from `template.types.ts` with `context = input.required<TemplateContext>()`
- Manifests export a `TemplateManifest` object matching the interface in `template.types.ts`
- Template thumbnails are SVG data URIs (160×213 px) inlined in the manifest, using `%23` for `#`
- `show_rsvp` guard uses `context().event.show_rsvp !== false` (not `=== true`) to default-show for any null row from old DB records
- The `notes` field in `EventData` is `string | null | undefined`; templates treat falsy as empty
- No new npm packages
- CSS class prefixes: `wb-` for all wedding-book styles
- Edit dialog new styles use existing `var(--color-*)` design tokens
- Working directory for all commands: `D:\POC\Developments\TapInvite\tap-invite`

---

### Task 1: Database Migration

**Files:**
- No Angular files — SQL run manually in Supabase dashboard

**Interfaces:**
- Produces: `notes text` and `show_rsvp boolean NOT NULL DEFAULT true` columns on `events` table — picked up automatically by `select('*')` in the existing service

- [ ] **Step 1: Open Supabase SQL editor**

Navigate to your Supabase project → SQL Editor → New Query.

- [ ] **Step 2: Run migration**

```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS show_rsvp boolean NOT NULL DEFAULT true;
```

- [ ] **Step 3: Verify columns exist**

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('notes', 'show_rsvp');
```

Expected: two rows — `notes text nullable`, `show_rsvp boolean default true not nullable`.

---

### Task 2: Extend `EventData` Type and `updateEvent` Service

**Files:**
- Modify: `src/app/features/templates/template.types.ts`
- Modify: `src/app/core/services/supabase/supabase.ts`

**Interfaces:**
- Consumes: DB columns from Task 1
- Produces: `EventData.notes?: string | null`, `EventData.show_rsvp: boolean` — consumed by all templates and the edit dialog; extended `updateEvent()` changes type — consumed by Task 3 (via host-dashboard spread)

- [ ] **Step 1: Update `EventData` in `template.types.ts`**

Replace the `EventData` interface (keep everything else in the file unchanged):

```typescript
export interface EventData {
  id: string;
  host_id: string;
  title: string;
  event_date: string;
  location_text: string;
  template_id: string;
  google_maps_url?: string | null;
  notes?: string | null;
  show_rsvp: boolean;
}
```

- [ ] **Step 2: Extend `updateEvent` in `supabase.ts`**

Replace the `updateEvent` method (the full method, lines 134–143):

```typescript
async updateEvent(
  eventId: string,
  changes: {
    title?: string;
    location_text?: string;
    template_id?: string;
    google_maps_url?: string | null;
    notes?: string | null;
    show_rsvp?: boolean;
  }
): Promise<void> {
  const { error } = await this.supabase
    .from('events')
    .update(changes)
    .eq('id', eventId);
  if (error) throw error;
}
```

- [ ] **Step 3: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/templates/template.types.ts src/app/core/services/supabase/supabase.ts
git commit -m "feat: extend EventData and updateEvent with notes and show_rsvp fields"
```

---

### Task 3: Update Edit Event Dialog

**Files:**
- Modify: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts`
- Modify: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html`
- Modify: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.css`

**Interfaces:**
- Consumes: `EventData.notes`, `EventData.show_rsvp` from Task 2
- Produces: `EditDialogResult.notes: string | null`, `EditDialogResult.show_rsvp: boolean` — the host-dashboard spreads `EditDialogResult` directly into `updateEvent()`, so no host-dashboard changes are needed

- [ ] **Step 1: Replace `edit-event-dialog.component.ts`**

```typescript
// src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TemplateGalleryComponent } from '../../../../features/templates/components/template-gallery/template-gallery.component';
import { EventData } from '../../../../features/templates/template.types';

export interface EditDialogData {
  event: EventData;
}

export interface EditDialogResult {
  title: string;
  location_text: string;
  template_id: string;
  google_maps_url: string | null;
  notes: string | null;
  show_rsvp: boolean;
}

@Component({
  selector: 'app-edit-event-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, TemplateGalleryComponent],
  templateUrl: './edit-event-dialog.component.html',
  styleUrl: './edit-event-dialog.component.css'
})
export class EditEventDialogComponent {
  private dialogRef = inject(MatDialogRef<EditEventDialogComponent>);
  readonly data: EditDialogData = inject(MAT_DIALOG_DATA);

  form = new FormGroup({
    title:           new FormControl(this.data.event.title,                  Validators.required),
    location_text:   new FormControl(this.data.event.location_text ?? ''),
    google_maps_url: new FormControl(this.data.event.google_maps_url ?? ''),
    notes:           new FormControl(this.data.event.notes ?? ''),
    show_rsvp:       new FormControl(this.data.event.show_rsvp ?? true),
  });

  selectedTemplateId = signal(this.data.event.template_id ?? 'default-minimal');

  save(): void {
    if (this.form.invalid) return;
    const result: EditDialogResult = {
      title:           this.form.value.title!,
      location_text:   this.form.value.location_text ?? '',
      template_id:     this.selectedTemplateId(),
      google_maps_url: this.form.value.google_maps_url || null,
      notes:           this.form.value.notes || null,
      show_rsvp:       this.form.value.show_rsvp ?? true,
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
```

- [ ] **Step 2: Replace `edit-event-dialog.component.html`**

```html
<div class="dialog-header">
  <h2 class="dialog-title">Edit Event</h2>
  <button class="btn-close" (click)="cancel()" type="button" aria-label="Close">✕</button>
</div>

<form [formGroup]="form" (ngSubmit)="save()">

  <div class="field">
    <label for="edit-title">Event Title</label>
    <input id="edit-title" formControlName="title" type="text" placeholder="Event name" />
  </div>

  <div class="field field-locked">
    <label>Date <span class="lock-hint">(cannot be changed)</span></label>
    <input
      type="text"
      [value]="data.event.event_date | date:'EEEE, MMMM d, y · h:mm a'"
      readonly
      disabled />
  </div>

  <div class="field">
    <label for="edit-location">Location</label>
    <input id="edit-location" formControlName="location_text" type="text" placeholder="Venue or address" />
  </div>

  <div class="field">
    <label for="edit-maps-url">Google Maps URL</label>
    <input id="edit-maps-url" formControlName="google_maps_url" type="text" placeholder="https://maps.google.com/..." />
  </div>

  <div class="field">
    <label for="edit-notes">Additional Details</label>
    <textarea
      id="edit-notes"
      formControlName="notes"
      placeholder="Dress code, reception info, hashtag, etc."
      rows="3">
    </textarea>
  </div>

  <div class="template-section">
    <p class="template-label">Invitation Template</p>
    <app-template-gallery
      [selectedId]="selectedTemplateId()"
      (templateSelected)="selectedTemplateId.set($event)">
    </app-template-gallery>
  </div>

  <div class="toggle-field">
    <label class="toggle-label">
      <input type="checkbox" formControlName="show_rsvp" class="toggle-input" />
      <span class="toggle-track">
        <span class="toggle-thumb"></span>
      </span>
      <span>Show Accept / Decline section</span>
    </label>
  </div>

  <div class="dialog-actions">
    <button type="button" class="btn-cancel" (click)="cancel()">Cancel</button>
    <button type="submit" class="btn-save" [disabled]="form.invalid">Save Changes</button>
  </div>

</form>
```

- [ ] **Step 3: Append to `edit-event-dialog.component.css`**

Add these rules at the end of the existing file:

```css
.field textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
}

.toggle-field {
  margin-bottom: 20px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text);
  user-select: none;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  position: relative;
  width: 40px;
  height: 22px;
  background: var(--color-border);
  border-radius: 11px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-input:checked + .toggle-track {
  background: var(--color-primary);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  pointer-events: none;
}

.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(18px);
}
```

- [ ] **Step 4: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Manually verify dialog**

Start the app (`npm start`), open Edit Event. Confirm:
- "Additional Details" textarea appears between Maps URL and template gallery
- "Show Accept / Decline section" toggle appears below the gallery, default on
- Saving persists without errors; reopen dialog confirms saved values

- [ ] **Step 6: Commit**

```bash
git add src/app/features/host-dashboard/components/edit-event-dialog/
git commit -m "feat: add notes textarea and show_rsvp toggle to edit event dialog"
```

---

### Task 4: Guard RSVP Section in Existing Templates

**Files:**
- Modify: `src/app/features/templates/default-minimal/default-minimal.template.ts`
- Modify: `src/app/features/templates/soft-floral/soft-floral.template.ts`
- Modify: `src/app/features/templates/flip-card/flip-card.template.ts`

**Interfaces:**
- Consumes: `EventData.show_rsvp` from Task 2
- Produces: All three templates conditionally render their RSVP section

- [ ] **Step 1: Update default-minimal template**

In `default-minimal.template.ts`, replace the divider + RSVP block (the section starting with `<div class="divider"></div>`):

Old:
```html
        <div class="divider"></div>
        <app-rsvp-buttons
          [status]="context().rsvpStatus"
          (rsvpChange)="context().onRsvpChange($event)">
        </app-rsvp-buttons>
        @if (context().rsvpError) {
          <p class="rsvp-error">{{ context().rsvpError }}</p>
        }
```

New:
```html
        @if (context().event.show_rsvp !== false) {
          <div class="divider"></div>
          <app-rsvp-buttons
            [status]="context().rsvpStatus"
            (rsvpChange)="context().onRsvpChange($event)">
          </app-rsvp-buttons>
          @if (context().rsvpError) {
            <p class="rsvp-error">{{ context().rsvpError }}</p>
          }
        }
```

- [ ] **Step 2: Update soft-floral template**

In `soft-floral.template.ts`, replace the sf-divider + RSVP block:

Old:
```html
        <div class="sf-divider">🌸 🌿 🌸</div>
        <app-rsvp-buttons
          [status]="context().rsvpStatus"
          (rsvpChange)="context().onRsvpChange($event)">
        </app-rsvp-buttons>
        @if (context().rsvpError) {
          <p class="sf-rsvp-error">{{ context().rsvpError }}</p>
        }
```

New:
```html
        @if (context().event.show_rsvp !== false) {
          <div class="sf-divider">🌸 🌿 🌸</div>
          <app-rsvp-buttons
            [status]="context().rsvpStatus"
            (rsvpChange)="context().onRsvpChange($event)">
          </app-rsvp-buttons>
          @if (context().rsvpError) {
            <p class="sf-rsvp-error">{{ context().rsvpError }}</p>
          }
        }
```

- [ ] **Step 3: Update flip-card template**

In `flip-card.template.ts`, wrap the `fc-rsvp-box` div (the `<!-- RSVP box -->` comment block):

Old:
```html
              <!-- RSVP box -->
              <div class="fc-rsvp-box">
                <p class="fc-rsvp-heading">
                  <span class="fc-rsvp-ornament">◆</span>
                  Will you join us?
                  <span class="fc-rsvp-ornament">◆</span>
                </p>
                <app-rsvp-buttons
                  [status]="context().rsvpStatus"
                  (rsvpChange)="context().onRsvpChange($event)">
                </app-rsvp-buttons>
                @if (context().rsvpError) {
                  <p class="fc-rsvp-error">{{ context().rsvpError }}</p>
                }
              </div>
```

New:
```html
              <!-- RSVP box -->
              @if (context().event.show_rsvp !== false) {
                <div class="fc-rsvp-box">
                  <p class="fc-rsvp-heading">
                    <span class="fc-rsvp-ornament">◆</span>
                    Will you join us?
                    <span class="fc-rsvp-ornament">◆</span>
                  </p>
                  <app-rsvp-buttons
                    [status]="context().rsvpStatus"
                    (rsvpChange)="context().onRsvpChange($event)">
                  </app-rsvp-buttons>
                  @if (context().rsvpError) {
                    <p class="fc-rsvp-error">{{ context().rsvpError }}</p>
                  }
                </div>
              }
```

- [ ] **Step 4: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Manually verify RSVP toggle**

With the app running: set `show_rsvp = false` via Edit Event → Save → open a guest invitation for that event. Confirm RSVP buttons and divider are absent for all three existing templates. Toggle back on → buttons reappear.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/templates/default-minimal/default-minimal.template.ts src/app/features/templates/soft-floral/soft-floral.template.ts src/app/features/templates/flip-card/flip-card.template.ts
git commit -m "feat: hide RSVP section in all templates when event show_rsvp is false"
```

---

### Task 5: Create Wedding Book Template

**Files:**
- Create: `src/app/features/templates/wedding-book/wedding-book.manifest.ts`
- Create: `src/app/features/templates/wedding-book/wedding-book.template.ts`
- Create: `src/app/features/templates/wedding-book/wedding-book.template.css`

**Interfaces:**
- Consumes: `TemplateContext`, `TemplateComponent`, `TemplateManifest` from `template.types.ts`; `RsvpButtonsComponent`; `EventData.notes`, `EventData.show_rsvp` from Task 2
- Produces: `WeddingBookTemplateComponent` (implements `TemplateComponent`); `weddingBookManifest` (implements `TemplateManifest`) — consumed by Task 6

- [ ] **Step 1: Create `wedding-book.manifest.ts`**

```typescript
import { TemplateManifest } from '../template.types';

export const weddingBookManifest: TemplateManifest = {
  id: 'wedding-book',
  label: 'Wedding Book',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="213"><rect width="160" height="213" fill="%23fffaf4" rx="6"/><rect x="10" y="10" width="140" height="193" fill="none" stroke="%23c9a84c" stroke-width="0.7" rx="4" opacity="0.35"/><rect x="10" y="10" width="16" height="1.5" fill="%23c9a84c" opacity="0.6"/><rect x="10" y="10" width="1.5" height="16" fill="%23c9a84c" opacity="0.6"/><rect x="134" y="10" width="16" height="1.5" fill="%23c9a84c" opacity="0.6"/><rect x="148.5" y="10" width="1.5" height="16" fill="%23c9a84c" opacity="0.6"/><rect x="10" y="211.5" width="16" height="1.5" fill="%23c9a84c" opacity="0.6"/><rect x="10" y="187" width="1.5" height="16" fill="%23c9a84c" opacity="0.6"/><rect x="134" y="211.5" width="16" height="1.5" fill="%23c9a84c" opacity="0.6"/><rect x="148.5" y="187" width="1.5" height="16" fill="%23c9a84c" opacity="0.6"/><ellipse cx="80" cy="72" rx="18" ry="20" fill="%23c9a84c" opacity="0.08"/><ellipse cx="80" cy="72" rx="10" ry="12" fill="%23c9a84c" opacity="0.15"/><rect x="76" y="68" width="8" height="8" fill="%23c9a84c" opacity="0.5" transform="rotate(45 80 72)"/><line x1="36" y1="102" x2="124" y2="102" stroke="%23c9a84c" stroke-width="0.8" opacity="0.5"/><rect x="24" y="111" width="112" height="7" rx="3.5" fill="%233a2e1e" opacity="0.45"/><rect x="36" y="124" width="88" height="5.5" rx="2.75" fill="%233a2e1e" opacity="0.3"/><line x1="36" y1="138" x2="124" y2="138" stroke="%23c9a84c" stroke-width="0.8" opacity="0.5"/><rect x="44" y="146" width="72" height="5" rx="2.5" fill="%237a6a52" opacity="0.45"/><circle cx="67" cy="168" r="3" fill="%23c9a84c" opacity="0.4"/><rect x="74" y="165" width="38" height="4" rx="2" fill="%237a6a52" opacity="0.3"/></svg>`,
  tags: ['wedding', 'elegant', 'book'],
  load: () =>
    import('./wedding-book.template').then(m => m.WeddingBookTemplateComponent),
};
```

- [ ] **Step 2: Create `wedding-book.template.ts`**

```typescript
import { Component, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

type BookState = 'cover' | 'inside' | 'back';

@Component({
  selector: 'app-wedding-book-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `
    <div class="wb-page">
      <div [class]="'wb-book wb-state-' + state()">

        <!-- Side 1: Cover -->
        <div class="wb-face wb-cover" (click)="toInside()">
          <div class="wb-corner wb-corner-tl">✦</div>
          <div class="wb-corner wb-corner-tr">✦</div>
          <div class="wb-corner wb-corner-bl">✦</div>
          <div class="wb-corner wb-corner-br">✦</div>
          <div class="wb-cover-content">
            <p class="wb-ornament">❧</p>
            <p class="wb-invite-line">You are invited to celebrate</p>
            <div class="wb-divider-gold"></div>
            <h1 class="wb-couple-names">{{ context().event.title }}</h1>
            <div class="wb-divider-gold"></div>
            <p class="wb-cover-date">{{ context().event.event_date | date:'MMMM d, y' }}</p>
            <p class="wb-tap-hint">
              <span class="wb-pulse"></span>
              Tap to open
            </p>
          </div>
        </div>

        <!-- Sides 2 + 3: Inside spread -->
        <div class="wb-face wb-inside">
          <div class="wb-inside-left">
            <p class="wb-section-ornament">◆</p>
            <p class="wb-section-label">Ceremony</p>
            <div class="wb-inside-divider"></div>
            <div class="wb-detail-row">
              <p class="wb-detail-label">Date &amp; Time</p>
              <p class="wb-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
              <p class="wb-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
            </div>
            <div class="wb-detail-row">
              <p class="wb-detail-label">Venue</p>
              <p class="wb-detail-primary">{{ context().event.location_text }}</p>
              @if (context().event.google_maps_url) {
                <a [href]="context().event.google_maps_url"
                   target="_blank" rel="noopener noreferrer"
                   class="wb-map-link">View on Maps →</a>
              }
            </div>
            <button class="wb-nav-btn" (click)="toCover()" type="button">← Close</button>
          </div>
          <div class="wb-spine"></div>
          <div class="wb-inside-right">
            <p class="wb-section-ornament">◆</p>
            <p class="wb-section-label">Additional Details</p>
            <div class="wb-inside-divider"></div>
            @if (context().event.notes) {
              <p class="wb-notes-text">{{ context().event.notes }}</p>
            } @else {
              <p class="wb-notes-empty">❧</p>
            }
            <button class="wb-rsvp-btn" (click)="toBack()" type="button">RSVP →</button>
          </div>
        </div>

        <!-- Side 4: Back / RSVP -->
        <div class="wb-face wb-back">
          <p class="wb-ornament">❧</p>
          <p class="wb-back-heading">Will you join us?</p>
          <div class="wb-divider-gold"></div>
          @if (context().event.show_rsvp !== false) {
            <div class="wb-rsvp-area">
              <app-rsvp-buttons
                [status]="context().rsvpStatus"
                (rsvpChange)="context().onRsvpChange($event)">
              </app-rsvp-buttons>
              @if (context().rsvpError) {
                <p class="wb-rsvp-error">{{ context().rsvpError }}</p>
              }
            </div>
          }
          <div class="wb-divider-gold"></div>
          <p class="wb-closing">We look forward to celebrating with you.</p>
          <button class="wb-back-nav" (click)="toInside()" type="button">← Back</button>
        </div>

      </div>
    </div>
  `,
  styleUrl: './wedding-book.template.css'
})
export class WeddingBookTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
  state = signal<BookState>('cover');

  toInside(): void { this.state.set('inside'); }
  toBack():   void { this.state.set('back');   }
  toCover():  void { this.state.set('cover');  }
}
```

- [ ] **Step 3: Create `wedding-book.template.css`**

```css
/* ══════════════════════════════════════════════════════
   Wedding Book — ivory & gold book-flip invitation
   ══════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap');

.wb-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #f5ede0 0%, #ede0cf 50%, #e8d8c0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  font-family: 'Playfair Display', Georgia, serif;
}

/* ── Book container (perspective context) ── */
.wb-book {
  position: relative;
  width: 100%;
  max-width: 420px;
  height: min(640px, 86vh);
  perspective: 1400px;
}

/* ── Shared face rules ── */
.wb-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 32px 72px rgba(100, 70, 20, 0.22),
    0 0 0 1px rgba(201, 168, 76, 0.18);
  transition: transform 0.75s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ═══════════════════════════════════════
   SIDE 1 — Cover
   ═══════════════════════════════════════ */
.wb-cover {
  background: #fffaf4;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transform: rotateY(0deg);
}

.wb-cover::before {
  content: '';
  position: absolute;
  inset: 14px;
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 8px;
  pointer-events: none;
}

.wb-corner {
  position: absolute;
  color: #c9a84c;
  font-size: 0.75rem;
  opacity: 0.5;
}
.wb-corner-tl { top: 18px;    left: 22px;  }
.wb-corner-tr { top: 18px;    right: 22px; }
.wb-corner-bl { bottom: 18px; left: 22px;  }
.wb-corner-br { bottom: 18px; right: 22px; }

.wb-cover-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 36px;
}

.wb-ornament {
  color: #c9a84c;
  font-size: 1.4rem;
  margin: 0 0 14px;
  line-height: 1;
}

.wb-invite-line {
  color: #7a6a52;
  font-size: 0.72rem;
  font-style: italic;
  letter-spacing: 0.12em;
  margin: 0 0 14px;
}

.wb-divider-gold {
  width: 80px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #c9a84c, transparent);
  margin: 0 auto 18px;
}

.wb-couple-names {
  color: #3a2e1e;
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 0 0 18px;
  letter-spacing: -0.01em;
}

.wb-cover-date {
  color: #7a6a52;
  font-size: 0.82rem;
  font-style: italic;
  letter-spacing: 0.06em;
  margin: 0 0 28px;
}

.wb-tap-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(58, 46, 30, 0.38);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-style: normal;
}

.wb-pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(201, 168, 76, 0.7);
  animation: wbPulse 2.4s ease infinite;
  flex-shrink: 0;
}

@keyframes wbPulse {
  0%, 100% { opacity: 1;   transform: scale(1);    box-shadow: 0 0 0 0   rgba(201, 168, 76, 0.5); }
  60%       { opacity: 0.7; transform: scale(1.3);  box-shadow: 0 0 0 6px rgba(201, 168, 76, 0);   }
}

/* ═══════════════════════════════════════
   SIDES 2 + 3 — Inside spread
   ═══════════════════════════════════════ */
.wb-inside {
  background: #fffaf4;
  display: flex;
  transform: rotateY(180deg);
}

.wb-inside-left,
.wb-inside-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 20px 24px;
  overflow-y: auto;
}

.wb-spine {
  width: 2px;
  background: linear-gradient(180deg, transparent 5%, #c9a84c 30%, #c9a84c 70%, transparent 95%);
  opacity: 0.3;
  flex-shrink: 0;
  align-self: stretch;
  margin: 20px 0;
}

.wb-section-ornament {
  color: #c9a84c;
  font-size: 0.45rem;
  text-align: center;
  margin: 0 0 5px;
}

.wb-section-label {
  color: #c9a84c;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-align: center;
  margin: 0 0 10px;
  font-style: normal;
}

.wb-inside-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201, 168, 76, 0.4), transparent);
  margin: 0 0 16px;
}

.wb-detail-row {
  margin-bottom: 16px;
}

.wb-detail-label {
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #c9a84c;
  margin: 0 0 3px;
  font-style: normal;
}

.wb-detail-primary {
  font-size: 0.8rem;
  color: #3a2e1e;
  margin: 0 0 2px;
  line-height: 1.4;
}

.wb-detail-secondary {
  font-size: 0.72rem;
  color: #7a6a52;
  font-style: italic;
  margin: 0;
}

.wb-map-link {
  display: inline-block;
  margin-top: 4px;
  font-size: 0.68rem;
  color: #c9a84c;
  text-decoration: none;
  font-style: normal;
  font-weight: 600;
}
.wb-map-link:hover { text-decoration: underline; }

.wb-notes-text {
  color: #3a2e1e;
  font-size: 0.8rem;
  font-style: italic;
  line-height: 1.7;
  margin: 0;
  flex: 1;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.wb-notes-empty {
  color: rgba(201, 168, 76, 0.35);
  font-size: 1.6rem;
  text-align: center;
  margin: auto;
  flex: 1;
}

.wb-nav-btn {
  margin-top: auto;
  background: none;
  border: none;
  color: rgba(122, 106, 82, 0.6);
  font-size: 0.66rem;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 8px 0 0;
  text-align: left;
  transition: color 0.2s;
}
.wb-nav-btn:hover { color: #c9a84c; }

.wb-rsvp-btn {
  margin-top: auto;
  background: none;
  border: 1px solid rgba(201, 168, 76, 0.4);
  color: #c9a84c;
  font-size: 0.66rem;
  font-weight: 700;
  font-family: inherit;
  letter-spacing: 0.12em;
  cursor: pointer;
  padding: 7px 12px;
  border-radius: 6px;
  align-self: flex-end;
  transition: background 0.2s;
}
.wb-rsvp-btn:hover { background: rgba(201, 168, 76, 0.08); }

/* ═══════════════════════════════════════
   SIDE 4 — Back / RSVP
   ═══════════════════════════════════════ */
.wb-back {
  background: #fffaf4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  text-align: center;
  transform: rotateY(180deg);
}

.wb-back::before {
  content: '';
  position: absolute;
  inset: 14px;
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 8px;
  pointer-events: none;
}

.wb-back-heading {
  color: #3a2e1e;
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0 0 14px;
  line-height: 1.3;
}

.wb-rsvp-area {
  width: 100%;
  margin: 6px 0 14px;
  --color-primary:      #c9a84c;
  --color-primary-dark: #a8843a;
  --color-text:         #3a2e1e;
  --color-text-muted:   #7a6a52;
  --color-border:       rgba(201, 168, 76, 0.35);
  --color-error:        #e05050;
}

.wb-rsvp-error {
  font-size: 0.78rem;
  color: #e05050;
  margin: 10px 0 0;
  font-style: italic;
}

.wb-closing {
  color: #7a6a52;
  font-size: 0.8rem;
  font-style: italic;
  line-height: 1.6;
  margin: 0;
}

.wb-back-nav {
  position: absolute;
  bottom: 22px;
  left: 26px;
  background: none;
  border: none;
  color: rgba(122, 106, 82, 0.6);
  font-size: 0.66rem;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}
.wb-back-nav:hover { color: #c9a84c; }

/* ═══════════════════════════════════════
   State-driven 3D transforms
   ═══════════════════════════════════════ */
.wb-state-cover .wb-cover  { transform: rotateY(0deg);    }
.wb-state-cover .wb-inside { transform: rotateY(180deg);  }
.wb-state-cover .wb-back   { transform: rotateY(180deg);  }

.wb-state-inside .wb-cover  { transform: rotateY(-180deg); }
.wb-state-inside .wb-inside { transform: rotateY(0deg);    }
.wb-state-inside .wb-back   { transform: rotateY(180deg);  }

.wb-state-back .wb-cover  { transform: rotateY(-180deg); }
.wb-state-back .wb-inside { transform: rotateY(-180deg); }
.wb-state-back .wb-back   { transform: rotateY(0deg);    }

/* ═══════════════════════════════════════
   Mobile
   ═══════════════════════════════════════ */
@media (max-width: 600px) {
  .wb-page {
    padding: 0;
    align-items: flex-start;
  }
  .wb-book {
    max-width: 100%;
    height: 100dvh;
  }
  .wb-face {
    border-radius: 0;
    box-shadow: none;
  }
  .wb-cover-content { padding: 36px 28px; }
  .wb-couple-names  { font-size: 1.45rem; }
  .wb-inside-left,
  .wb-inside-right  { padding: 22px 14px 18px; }
  .wb-back          { padding: 32px 24px; }
}
```

- [ ] **Step 4: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/templates/wedding-book/
git commit -m "feat: add Wedding Book template with ivory-gold 3-state book-flip animation"
```

---

### Task 6: Register Wedding Book in Template Registry

**Files:**
- Modify: `src/app/features/templates/template-registry.ts`

**Interfaces:**
- Consumes: `weddingBookManifest` from Task 5
- Produces: `wedding-book` appears as 4th entry in `TEMPLATE_REGISTRY` — consumed by `getManifest()`, template gallery, and template renderer

- [ ] **Step 1: Replace `template-registry.ts`**

```typescript
// src/app/features/templates/template-registry.ts
import { TemplateManifest } from './template.types';
import { defaultMinimalManifest } from './default-minimal/default-minimal.manifest';
import { softFloralManifest }     from './soft-floral/soft-floral.manifest';
import { flipCardManifest }        from './flip-card/flip-card.manifest';
import { weddingBookManifest }     from './wedding-book/wedding-book.manifest';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [
  defaultMinimalManifest,
  softFloralManifest,
  flipCardManifest,
  weddingBookManifest,
];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
```

- [ ] **Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Manually verify end-to-end**

Start the app (`npm start`) and verify:
1. Edit Event dialog → Template gallery shows "Wedding Book" as 4th option with ivory/gold thumbnail
2. Select "Wedding Book" → save → open a guest invitation link
3. Guest view shows ivory cover with couple's name (event title) and gold "Tap to open" hint
4. Tap cover → smooth `rotateY` flip reveals inside spread (Ceremony left, Additional Details right)
5. Tap "RSVP →" → flips to RSVP / closing page
6. Tap "← Back" → returns to inside; "← Close" → returns to cover
7. Set `show_rsvp = false` in Edit Event → RSVP buttons absent on Side 4 (closing message still shows)

- [ ] **Step 4: Commit**

```bash
git add src/app/features/templates/template-registry.ts
git commit -m "feat: register Wedding Book in template registry"
```
