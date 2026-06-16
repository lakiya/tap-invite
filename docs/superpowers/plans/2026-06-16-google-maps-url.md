# Google Maps URL Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Google Maps URL text field to the event creation form and edit event dialog so hosts can link guests directly to the venue on Google Maps.

**Architecture:** `EventData.google_maps_url` already exists in the type and all 3 invitation templates already render it — only the UI entry points and service method signatures are missing. We add the field bottom-up: service layer first, then create form, then edit dialog. The host-dashboard already spreads the full `EditDialogResult` into `updateEvent()`, so it needs no changes.

**Tech Stack:** Angular 22 (signals, reactive forms, template-driven forms), Supabase JS client, Vitest

---

## Files Modified

| File | Change |
|---|---|
| `src/app/core/services/supabase/supabase.ts` | `createEvent()` gains optional `googleMapsUrl` param; `updateEvent()` changes type gains `google_maps_url` |
| `src/app/core/services/supabase/supabase.spec.ts` | New `createEvent` tests + new `updateEvent` test for `google_maps_url` |
| `src/app/features/host-dashboard/components/event-form/event-form.component.ts` | `fields` gains `googleMapsUrl`; passed to `createEvent()` |
| `src/app/features/host-dashboard/components/event-form/event-form.component.html` | Text input after Location |
| `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts` | `EditDialogResult` and `FormGroup` gain `google_maps_url`; `save()` includes it |
| `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html` | Text input after Location |

---

## Task 1: Update Supabase service and spec

**Files:**
- Modify: `src/app/core/services/supabase/supabase.ts:62-69` (createEvent) and `:110-119` (updateEvent)
- Modify: `src/app/core/services/supabase/supabase.spec.ts`

---

- [ ] **Step 1: Add `createEvent` tests**

Open `src/app/core/services/supabase/supabase.spec.ts`. After the closing `});` of the existing `describe('updateEvent', ...)` block (line 75), add:

```typescript
  describe('createEvent', () => {
    it('inserts event with google_maps_url when provided', async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null });
      vi.spyOn(service.client, 'from').mockReturnValue(
        { insert: mockInsert, select: mockSelect, single: mockSingle } as any
      );

      await service.createEvent('host-1', 'My Party', '2026-07-01', 'Colombo', 'https://maps.google.com/abc');

      expect(mockInsert).toHaveBeenCalledWith([{
        host_id: 'host-1',
        title: 'My Party',
        event_date: '2026-07-01',
        location_text: 'Colombo',
        google_maps_url: 'https://maps.google.com/abc',
      }]);
    });

    it('coerces empty googleMapsUrl to null', async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null });
      vi.spyOn(service.client, 'from').mockReturnValue(
        { insert: mockInsert, select: mockSelect, single: mockSingle } as any
      );

      await service.createEvent('host-1', 'My Party', '2026-07-01', 'Colombo', '');

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ google_maps_url: null })
      ]);
    });
  });
```

Also add one more test inside the existing `describe('updateEvent', ...)` block, after the `'throws when supabase returns an error'` test:

```typescript
    it('passes google_maps_url in changes when provided', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq    = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(service.client, 'from').mockReturnValue({ update: mockUpdate, eq: mockEq } as any);

      await service.updateEvent('event-123', { google_maps_url: 'https://maps.google.com/xyz' });

      expect(mockUpdate).toHaveBeenCalledWith({ google_maps_url: 'https://maps.google.com/xyz' });
    });
```

- [ ] **Step 2: Run tests — expect failures**

```
npx vitest run src/app/core/services/supabase/supabase.spec.ts
```

Expected: 3 new tests FAIL with type errors (method signatures not yet updated).

- [ ] **Step 3: Update `createEvent` in supabase.ts**

Replace the `createEvent` method (lines 62–69) in `src/app/core/services/supabase/supabase.ts`:

```typescript
  async createEvent(hostId: string, title: string, date: string, location: string, googleMapsUrl?: string | null) {
    const { data, error } = await this.supabase
      .from('events')
      .insert([{
        host_id: hostId,
        title,
        event_date: date,
        location_text: location,
        google_maps_url: googleMapsUrl || null,
      }])
      .select().single();
    if (error) throw error;
    return data;
  }
```

- [ ] **Step 4: Update `updateEvent` changes type in supabase.ts**

Replace the `updateEvent` method (lines 110–119) in `src/app/core/services/supabase/supabase.ts`:

```typescript
  async updateEvent(
    eventId: string,
    changes: { title?: string; location_text?: string; template_id?: string; google_maps_url?: string | null }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('events')
      .update(changes)
      .eq('id', eventId);
    if (error) throw error;
  }
```

- [ ] **Step 5: Run tests — expect all to pass**

```
npx vitest run src/app/core/services/supabase/supabase.spec.ts
```

Expected: all tests PASS including the 3 new ones.

- [ ] **Step 6: Run full test suite**

```
npx vitest run
```

Expected: all existing tests still PASS (no regressions).

- [ ] **Step 7: Commit**

```
git add src/app/core/services/supabase/supabase.ts src/app/core/services/supabase/supabase.spec.ts
git commit -m "feat: add google_maps_url to createEvent and updateEvent service methods"
```

---

## Task 2: Update event creation form

**Files:**
- Modify: `src/app/features/host-dashboard/components/event-form/event-form.component.ts`
- Modify: `src/app/features/host-dashboard/components/event-form/event-form.component.html`

---

- [ ] **Step 1: Add `googleMapsUrl` to the `fields` object and pass it to `createEvent`**

Replace the entire component class body in `src/app/features/host-dashboard/components/event-form/event-form.component.ts`:

```typescript
import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../../../core/services/supabase/supabase';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.css']
})
export class EventFormComponent {
  @Input() hostId!: string;
  @Output() eventCreated = new EventEmitter<any>();

  private supabase = inject(Supabase);

  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  fields = { title: '', date: '', location: '', googleMapsUrl: '' };

  async handleSubmit() {
    if (!this.fields.title.trim()) return;
    this.isSubmitting.set(true);
    this.submitError.set(null);
    try {
      const event = await this.supabase.createEvent(
        this.hostId,
        this.fields.title,
        this.fields.date,
        this.fields.location,
        this.fields.googleMapsUrl || null
      );
      this.eventCreated.emit(event);
    } catch {
      this.submitError.set('Failed to create event. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
```

- [ ] **Step 2: Add Google Maps URL input to the create form HTML**

In `src/app/features/host-dashboard/components/event-form/event-form.component.html`, add a new `field-group` block after the Location field group (after the closing `</div>` of the location field, before the `<button>`):

```html
    <div class="field-group">
      <label class="field-label">Google Maps URL</label>
      <input
        class="field-input"
        [(ngModel)]="fields.googleMapsUrl"
        name="googleMapsUrl"
        placeholder="https://maps.google.com/..."
      />
    </div>
```

The full updated template should look like:

```html
<div class="form-card">
  <p class="step-eyebrow">Step 1 of 1</p>
  <h2 class="form-title">Create Your Event</h2>
  <p class="form-sub">Fill in the details and launch your event in seconds.</p>

  <form (ngSubmit)="handleSubmit()">
    <div class="field-group">
      <label class="field-label">Event Name <span class="required">*</span></label>
      <input
        class="field-input"
        [(ngModel)]="fields.title"
        name="title"
        placeholder="e.g. Priya & Kamal's Wedding"
        required
      />
    </div>

    <div class="field-group">
      <label class="field-label">Date &amp; Time</label>
      <input
        class="field-input"
        type="datetime-local"
        [(ngModel)]="fields.date"
        name="date"
      />
    </div>

    <div class="field-group">
      <label class="field-label">Location</label>
      <input
        class="field-input"
        [(ngModel)]="fields.location"
        name="location"
        placeholder="e.g. The Grand Ballroom, Colombo"
      />
    </div>

    <div class="field-group">
      <label class="field-label">Google Maps URL</label>
      <input
        class="field-input"
        [(ngModel)]="fields.googleMapsUrl"
        name="googleMapsUrl"
        placeholder="https://maps.google.com/..."
      />
    </div>

    <button class="submit-btn" type="submit" [disabled]="isSubmitting() || !fields.title.trim()">
      {{ isSubmitting() ? 'Launching...' : '🚀 Launch Event' }}
    </button>

    @if (submitError()) {
      <p class="error-msg">{{ submitError() }}</p>
    }
  </form>
</div>
```

- [ ] **Step 3: Run full test suite**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```
git add src/app/features/host-dashboard/components/event-form/event-form.component.ts src/app/features/host-dashboard/components/event-form/event-form.component.html
git commit -m "feat: add Google Maps URL field to event creation form"
```

---

## Task 3: Update edit event dialog

**Files:**
- Modify: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts`
- Modify: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html`

No changes to `host-dashboard.component.ts` — it already passes the full `EditDialogResult` object to `supabase.updateEvent()`, so the new `google_maps_url` field flows through automatically once it's in the result.

---

- [ ] **Step 1: Update the edit dialog component**

Replace the entire contents of `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts`:

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
  });

  selectedTemplateId = signal(this.data.event.template_id ?? 'default-minimal');

  save(): void {
    if (this.form.invalid) return;
    const result: EditDialogResult = {
      title:           this.form.value.title!,
      location_text:   this.form.value.location_text ?? '',
      template_id:     this.selectedTemplateId(),
      google_maps_url: this.form.value.google_maps_url || null,
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
```

- [ ] **Step 2: Add Google Maps URL input to the edit dialog HTML**

In `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html`, add a new `field` div after the Location field (after `<input id="edit-location" ...>`'s closing `</div>`, before the `<div class="template-section">`):

```html
  <div class="field">
    <label for="edit-maps-url">Google Maps URL</label>
    <input id="edit-maps-url" formControlName="google_maps_url" type="text" placeholder="https://maps.google.com/..." />
  </div>
```

The full updated template:

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

  <div class="template-section">
    <p class="template-label">Invitation Template</p>
    <app-template-gallery
      [selectedId]="selectedTemplateId()"
      (templateSelected)="selectedTemplateId.set($event)">
    </app-template-gallery>
  </div>

  <div class="dialog-actions">
    <button type="button" class="btn-cancel" (click)="cancel()">Cancel</button>
    <button type="submit" class="btn-save" [disabled]="form.invalid">Save Changes</button>
  </div>

</form>
```

- [ ] **Step 3: Run full test suite**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```
git add src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html
git commit -m "feat: add Google Maps URL field to edit event dialog"
```

---

## Verify end-to-end

After all tasks are committed:

- [ ] Start the dev server: `npm start`
- [ ] Create a new event with a Google Maps URL pasted in — confirm the field saves
- [ ] Open the invitation link — confirm "View on Google Maps →" link appears and navigates correctly
- [ ] Open Edit Event dialog on an existing event — confirm Google Maps URL field is pre-populated (or empty for old events)
- [ ] Update the URL in the edit dialog, save — confirm the invitation link reflects the change
- [ ] Leave the Google Maps URL blank — confirm the invitation renders without any map link
