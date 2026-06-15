# Template Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plugin/manifest template system where hosts pick an invitation template after creating an event, and guests see their invitation rendered by the selected template.

**Architecture:** Each template is an isolated standalone Angular component registered in a central manifest registry. The host dashboard gains a post-creation picker step and an edit dialog. The guest view delegates rendering to a `TemplateRendererComponent` that lazy-loads the correct template via `NgComponentOutlet`.

**Tech Stack:** Angular 22 (standalone, signals, `input()`, `output()`, `effect()`), Angular Material `MatDialog`, `NgComponentOutlet` with `ngComponentOutletInputs`, Vitest + Angular TestBed, Supabase JS client.

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/app/features/templates/template.types.ts` | `RsvpStatus`, `EventData`, `GuestData`, `TemplateContext`, `TemplateComponent`, `TemplateManifest` |
| `src/app/features/templates/template-registry.ts` | `TEMPLATE_REGISTRY` array + `getManifest()` helper |
| `src/app/features/templates/default-minimal/default-minimal.manifest.ts` | Manifest for the default template |
| `src/app/features/templates/default-minimal/default-minimal.template.ts` | Invitation card extracted from guest-view |
| `src/app/features/templates/default-minimal/default-minimal.template.css` | Card styles moved from guest-view |
| `src/app/features/templates/soft-floral/soft-floral.manifest.ts` | Manifest for the floral template |
| `src/app/features/templates/soft-floral/soft-floral.template.ts` | Soft Floral invitation component |
| `src/app/features/templates/soft-floral/soft-floral.template.css` | Floral styles |
| `src/app/features/templates/components/template-renderer/template-renderer.component.ts` | Lazy-loads and renders the active template |
| `src/app/features/templates/components/template-renderer/template-renderer.component.css` | Spinner styles |
| `src/app/features/templates/components/template-renderer/template-renderer.component.spec.ts` | Tests |
| `src/app/features/templates/components/template-gallery/template-gallery.component.ts` | Grid picker from registry |
| `src/app/features/templates/components/template-gallery/template-gallery.component.html` | Gallery grid template |
| `src/app/features/templates/components/template-gallery/template-gallery.component.css` | Gallery styles |
| `src/app/features/templates/components/template-gallery/template-gallery.component.spec.ts` | Tests |
| `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts` | MatDialog edit form (title, location, template) |
| `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html` | Edit dialog template |
| `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.css` | Edit dialog styles |

### Modified files
| File | Change |
|------|--------|
| `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts` | Import `RsvpStatus` from `template.types` instead of defining it locally |
| `src/app/features/guest-view/components/guest-view.component.ts` | Replace inline card with `TemplateRendererComponent`; use types from `template.types` |
| `src/app/features/guest-view/components/guest-view.component.html` | Replace card markup with `<app-template-renderer>` |
| `src/app/features/guest-view/components/guest-view.component.css` | Remove card styles (moved to `default-minimal.template.css`) |
| `src/app/core/services/supabase/supabase.ts` | Add `updateEvent()` method |
| `src/app/core/services/supabase/supabase.spec.ts` | Add `updateEvent()` test |
| `src/app/features/host-dashboard/components/host-dashboard.component.ts` | Add `showTemplatePicker`, `selectedTemplateId`, `confirmTemplate()`, `openEditDialog()` |
| `src/app/features/host-dashboard/components/host-dashboard.component.html` | Add picker section + Edit button on strip |

---

## Task 1: Database Migration

**Files:**
- Supabase dashboard SQL editor (no project file)

- [ ] **Step 1: Run the migration in Supabase**

Open the Supabase dashboard → SQL Editor and run:

```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS template_id VARCHAR NOT NULL DEFAULT 'default-minimal';
```

- [ ] **Step 2: Verify**

In the Supabase Table Editor, open `events`. Confirm the `template_id` column exists with default `'default-minimal'`. Existing rows should already show the default value.

- [ ] **Step 3: Commit note**

```bash
git commit --allow-empty -m "chore: add template_id column to events table (migration run in Supabase dashboard)"
```

---

## Task 2: Template Types

**Files:**
- Create: `src/app/features/templates/template.types.ts`
- Modify: `src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts`

- [ ] **Step 1: Create `template.types.ts`**

```typescript
// src/app/features/templates/template.types.ts
import { InputSignal, Type } from '@angular/core';

export type RsvpStatus = 'Pending' | 'Accepted' | 'Declined' | 'Tentative';

export interface EventData {
  id: string;
  host_id: string;
  title: string;
  event_date: string;
  location_text: string;
  template_id: string;
  google_maps_url?: string | null;
}

export interface GuestData {
  id: string;
  event_id: string;
  display_name: string;
  phone_number?: string | null;
  email?: string | null;
}

export interface TemplateContext {
  event: EventData;
  guest: GuestData;
  rsvpStatus: RsvpStatus;
  rsvpError: string | null;
  onRsvpChange: (status: RsvpStatus) => void;
}

export interface TemplateComponent {
  context: InputSignal<TemplateContext>;
}

export interface TemplateManifest {
  id: string;
  label: string;
  /** SVG data URI for gallery thumbnail. */
  thumbnail: string;
  tags: string[];
  load: () => Promise<Type<TemplateComponent>>;
}
```

- [ ] **Step 2: Update `rsvp-buttons.component.ts` to import `RsvpStatus` from the new types file**

Replace the entire file with:

```typescript
// src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RsvpStatus } from '../../../../features/templates/template.types';

export { RsvpStatus };

@Component({
  selector: 'app-rsvp-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rsvp-buttons.component.html',
  styleUrls: ['./rsvp-buttons.component.css']
})
export class RsvpButtonsComponent {
  @Input() status: RsvpStatus = 'Pending';
  @Output() rsvpChange = new EventEmitter<RsvpStatus>();
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/templates/template.types.ts src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts
git commit -m "feat: add template types and move RsvpStatus to shared types"
```

---

## Task 3: Template Registry Stub

**Files:**
- Create: `src/app/features/templates/template-registry.ts`

- [ ] **Step 1: Create empty registry**

```typescript
// src/app/features/templates/template-registry.ts
import { TemplateManifest } from './template.types';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/templates/template-registry.ts
git commit -m "feat: add empty template registry with getManifest helper"
```

---

## Task 4: Supabase `updateEvent()`

**Files:**
- Modify: `src/app/core/services/supabase/supabase.ts`
- Modify: `src/app/core/services/supabase/supabase.spec.ts`

- [ ] **Step 1: Write the failing test**

Open `src/app/core/services/supabase/supabase.spec.ts`. Add inside the `describe('Supabase', ...)` block:

```typescript
describe('updateEvent', () => {
  it('calls update with the provided changes and matches on id', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq    = vi.fn().mockResolvedValue({ error: null });
    const mockFrom  = vi.fn().mockReturnValue({ update: mockUpdate, eq: mockEq });
    vi.spyOn(service.client, 'from').mockImplementation(mockFrom as any);

    await service.updateEvent('event-123', { title: 'New Title', template_id: 'soft-floral' });

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(mockUpdate).toHaveBeenCalledWith({ title: 'New Title', template_id: 'soft-floral' });
    expect(mockEq).toHaveBeenCalledWith('id', 'event-123');
  });

  it('throws when supabase returns an error', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq    = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
    vi.spyOn(service.client, 'from').mockReturnValue({ update: mockUpdate, eq: mockEq } as any);

    await expect(service.updateEvent('event-123', { title: 'x' })).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd tap-invite && npx ng test --include="**/supabase.spec.ts" 2>&1 | tail -20
```

Expected: FAIL — `service.updateEvent is not a function`.

- [ ] **Step 3: Implement `updateEvent` in `supabase.ts`**

Add this method at the end of the `Supabase` class (before the closing `}`):

```typescript
async updateEvent(
  eventId: string,
  changes: { title?: string; location_text?: string; template_id?: string }
): Promise<void> {
  const { error } = await this.supabase
    .from('events')
    .update(changes)
    .eq('id', eventId);
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx ng test --include="**/supabase.spec.ts" 2>&1 | tail -20
```

Expected: PASS — 4 tests (2 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/supabase/supabase.ts src/app/core/services/supabase/supabase.spec.ts
git commit -m "feat: add updateEvent method to Supabase service"
```

---

## Task 5: Default-Minimal Template

**Files:**
- Create: `src/app/features/templates/default-minimal/default-minimal.template.ts`
- Create: `src/app/features/templates/default-minimal/default-minimal.template.css`
- Create: `src/app/features/templates/default-minimal/default-minimal.manifest.ts`
- Modify: `src/app/features/templates/template-registry.ts`

- [ ] **Step 1: Create `default-minimal.template.css`**

Copy all card-related rules from `guest-view.component.css`. The rules to move are everything **except** `.guest-page`, `.status-wrap`, `.spinner`, `@keyframes spin`, `.status-text`, `.status-wrap.error`, `.err-icon`, `.status-wrap h2`, `.status-wrap p`, `.back-home`:

```css
/* src/app/features/templates/default-minimal/default-minimal.template.css */
.invitation-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 24px;
  max-width: 440px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.1);
}

.card-band {
  background: linear-gradient(135deg, var(--color-band-from), var(--color-band-to));
  padding: 28px 28px 24px;
}

[data-theme="dark"] .card-band {
  border-bottom: 1px solid var(--color-primary);
}

.event-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: 99px;
  margin-bottom: 12px;
}

.greeting {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin: 0;
}

.card-body { padding: 28px; }

.animation-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.event-name {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text);
  text-align: center;
  margin: 0 0 24px;
  letter-spacing: -0.02em;
}

.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.detail-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.detail-primary {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 2px;
}

.detail-secondary {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.map-link {
  font-size: 0.78rem;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}

.map-link:hover { text-decoration: underline; }

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 24px 0;
}

.rsvp-error {
  font-size: 0.82rem;
  color: var(--color-error);
  text-align: center;
  margin: 12px 0 0;
}

.fade-up { animation: fadeUp 0.4s ease; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Create `default-minimal.template.ts`**

```typescript
// src/app/features/templates/default-minimal/default-minimal.template.ts
import { Component, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { RsvpButtonsComponent } from '../../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

@Component({
  selector: 'app-default-minimal-template',
  standalone: true,
  imports: [CommonModule, DatePipe, LottieComponent, RsvpButtonsComponent],
  template: `
    <div class="invitation-card fade-up">
      <div class="card-band">
        <span class="event-badge">You're Invited</span>
        <p class="greeting">Dear {{ context().guest.display_name }},</p>
      </div>
      <div class="card-body">
        <div class="animation-wrap">
          <ng-lottie [options]="lottieOptions" width="160px" height="160px"></ng-lottie>
        </div>
        <h1 class="event-name">{{ context().event.title }}</h1>
        <div class="detail-rows">
          <div class="detail-row">
            <span class="detail-icon">📅</span>
            <div>
              <p class="detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
              <p class="detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-icon">📍</span>
            <div>
              <p class="detail-primary">{{ context().event.location_text }}</p>
              @if (context().event.google_maps_url) {
                <a [href]="context().event.google_maps_url" target="_blank" class="map-link">
                  View on Google Maps →
                </a>
              }
            </div>
          </div>
        </div>
        <div class="divider"></div>
        <app-rsvp-buttons
          [status]="context().rsvpStatus"
          (rsvpChange)="context().onRsvpChange($event)">
        </app-rsvp-buttons>
        @if (context().rsvpError) {
          <p class="rsvp-error">{{ context().rsvpError }}</p>
        }
      </div>
    </div>
  `,
  styleUrl: './default-minimal.template.css'
})
export class DefaultMinimalTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();

  readonly lottieOptions: AnimationOptions = {
    path: 'assets/animations/celebration4.json',
    loop: true,
    autoplay: true,
  };
}
```

- [ ] **Step 3: Create `default-minimal.manifest.ts`**

```typescript
// src/app/features/templates/default-minimal/default-minimal.manifest.ts
import { TemplateManifest } from '../template.types';

export const defaultMinimalManifest: TemplateManifest = {
  id: 'default-minimal',
  label: 'Classic',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="%23f8fafc" rx="6"/><rect width="160" height="36" fill="%230ea5e9" rx="6"/><rect y="28" width="160" height="8" fill="%230ea5e9"/><rect x="10" y="44" width="90" height="6" rx="3" fill="%23e2e8f0"/><rect x="10" y="56" width="60" height="6" rx="3" fill="%23e2e8f0"/><rect x="10" y="72" width="60" height="16" rx="8" fill="%230ea5e9"/><rect x="78" y="72" width="50" height="16" rx="8" fill="%23e2e8f0"/></svg>`,
  tags: ['minimal', 'classic'],
  load: () =>
    import('./default-minimal.template').then(m => m.DefaultMinimalTemplateComponent),
};
```

- [ ] **Step 4: Register in `template-registry.ts`**

Replace the file contents:

```typescript
// src/app/features/templates/template-registry.ts
import { TemplateManifest } from './template.types';
import { defaultMinimalManifest } from './default-minimal/default-minimal.manifest';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [
  defaultMinimalManifest,
];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/templates/
git commit -m "feat: add default-minimal template component and manifest"
```

---

## Task 6: Soft-Floral Template

**Files:**
- Create: `src/app/features/templates/soft-floral/soft-floral.template.ts`
- Create: `src/app/features/templates/soft-floral/soft-floral.template.css`
- Create: `src/app/features/templates/soft-floral/soft-floral.manifest.ts`
- Modify: `src/app/features/templates/template-registry.ts`

- [ ] **Step 1: Create `soft-floral.template.css`**

```css
/* src/app/features/templates/soft-floral/soft-floral.template.css */
.sf-card {
  background: #fdf6f0;
  border: 1px solid #f0d9cc;
  border-radius: 24px;
  max-width: 440px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(139, 69, 19, 0.12);
  font-family: Georgia, 'Times New Roman', serif;
}

.sf-header {
  background: linear-gradient(135deg, #f9e4d4, #f0c4b0);
  padding: 24px 28px 20px;
  text-align: center;
  border-bottom: 2px solid #e8a87c;
}

.sf-floral-accent {
  font-size: 1.2rem;
  margin-bottom: 8px;
  letter-spacing: 0.3em;
}

.sf-subtitle {
  font-size: 0.78rem;
  color: #8b4513;
  font-style: italic;
  margin: 0 0 6px;
  letter-spacing: 0.05em;
}

.sf-greeting {
  font-size: 1.05rem;
  font-weight: 700;
  font-style: italic;
  color: #5c2d0e;
  margin: 0;
}

.sf-body {
  padding: 28px;
}

.sf-event-name {
  font-size: 1.4rem;
  font-weight: 700;
  font-style: italic;
  color: #5c2d0e;
  text-align: center;
  margin: 0 0 20px;
  letter-spacing: 0.02em;
}

.sf-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sf-detail-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sf-detail-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.sf-detail-primary {
  font-size: 0.88rem;
  font-weight: 600;
  color: #5c2d0e;
  margin: 0 0 2px;
}

.sf-detail-secondary {
  font-size: 0.78rem;
  color: #8b4513;
  margin: 0;
}

.sf-map-link {
  font-size: 0.75rem;
  color: #c47a3a;
  text-decoration: none;
  font-weight: 600;
}

.sf-map-link:hover { text-decoration: underline; }

.sf-divider {
  text-align: center;
  color: #e8a87c;
  font-size: 1.1rem;
  letter-spacing: 0.4em;
  margin: 20px 0;
  border-top: 1px dashed #f0d9cc;
  padding-top: 16px;
}

.sf-rsvp-error {
  font-size: 0.82rem;
  color: #c0392b;
  text-align: center;
  margin: 12px 0 0;
  font-style: italic;
}

.sf-fade-up { animation: sfFadeUp 0.4s ease; }

@keyframes sfFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Create `soft-floral.template.ts`**

```typescript
// src/app/features/templates/soft-floral/soft-floral.template.ts
import { Component, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

@Component({
  selector: 'app-soft-floral-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `
    <div class="sf-card sf-fade-up">
      <div class="sf-header">
        <div class="sf-floral-accent">🌸 🌿 🌸</div>
        <p class="sf-subtitle">Together with joy, we invite</p>
        <p class="sf-greeting">Dear {{ context().guest.display_name }},</p>
      </div>
      <div class="sf-body">
        <h1 class="sf-event-name">{{ context().event.title }}</h1>
        <div class="sf-details">
          <div class="sf-detail-row">
            <span class="sf-detail-icon">📅</span>
            <div>
              <p class="sf-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
              <p class="sf-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
            </div>
          </div>
          <div class="sf-detail-row">
            <span class="sf-detail-icon">📍</span>
            <div>
              <p class="sf-detail-primary">{{ context().event.location_text }}</p>
              @if (context().event.google_maps_url) {
                <a [href]="context().event.google_maps_url" target="_blank" class="sf-map-link">
                  View on Google Maps →
                </a>
              }
            </div>
          </div>
        </div>
        <div class="sf-divider">🌸 🌿 🌸</div>
        <app-rsvp-buttons
          [status]="context().rsvpStatus"
          (rsvpChange)="context().onRsvpChange($event)">
        </app-rsvp-buttons>
        @if (context().rsvpError) {
          <p class="sf-rsvp-error">{{ context().rsvpError }}</p>
        }
      </div>
    </div>
  `,
  styleUrl: './soft-floral.template.css'
})
export class SoftFloralTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
}
```

- [ ] **Step 3: Create `soft-floral.manifest.ts`**

```typescript
// src/app/features/templates/soft-floral/soft-floral.manifest.ts
import { TemplateManifest } from '../template.types';

export const softFloralManifest: TemplateManifest = {
  id: 'soft-floral',
  label: 'Soft Floral',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="%23fdf6f0" rx="6"/><rect width="160" height="36" fill="%23f0c4b0" rx="6"/><rect y="28" width="160" height="8" fill="%23f0c4b0"/><rect x="10" y="44" width="90" height="6" rx="3" fill="%23f0d9cc"/><rect x="10" y="56" width="60" height="6" rx="3" fill="%23f0d9cc"/><rect x="10" y="72" width="65" height="16" rx="8" fill="%23e8a87c"/><rect x="83" y="72" width="50" height="16" rx="8" fill="%23f0d9cc"/></svg>`,
  tags: ['floral', 'romantic'],
  load: () =>
    import('./soft-floral.template').then(m => m.SoftFloralTemplateComponent),
};
```

- [ ] **Step 4: Register in `template-registry.ts`**

```typescript
// src/app/features/templates/template-registry.ts
import { TemplateManifest } from './template.types';
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

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/templates/
git commit -m "feat: add soft-floral template and populate registry"
```

---

## Task 7: TemplateRendererComponent

**Files:**
- Create: `src/app/features/templates/components/template-renderer/template-renderer.component.ts`
- Create: `src/app/features/templates/components/template-renderer/template-renderer.component.css`
- Create: `src/app/features/templates/components/template-renderer/template-renderer.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/features/templates/components/template-renderer/template-renderer.component.spec.ts
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component, input, Type } from '@angular/core';
import { vi } from 'vitest';
import { TemplateRendererComponent } from './template-renderer.component';
import { TemplateContext, TemplateComponent } from '../../template.types';
import * as registry from '../../template-registry';

@Component({ selector: 'app-stub-tpl', standalone: true, template: '<div class="stub-tpl">stub</div>' })
class StubTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
}

const mockContext: TemplateContext = {
  event: {
    id: 'e1', host_id: 'h1', title: 'Test Event',
    event_date: '2025-07-12T18:00:00', location_text: 'Venue',
    template_id: 'default-minimal', google_maps_url: null,
  },
  guest: { id: 'g1', event_id: 'e1', display_name: 'Alice' },
  rsvpStatus: 'Pending',
  rsvpError: null,
  onRsvpChange: vi.fn(),
};

describe('TemplateRendererComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TemplateRendererComponent] });
  });

  it('shows spinner while template is loading', fakeAsync(() => {
    let resolve!: (v: Type<TemplateComponent>) => void;
    vi.spyOn(registry, 'getManifest').mockReturnValue({
      id: 'default-minimal', label: 'Classic', thumbnail: '', tags: [],
      load: () => new Promise(r => { resolve = r as any; }),
    });

    const fixture = TestBed.createComponent(TemplateRendererComponent);
    fixture.componentRef.setInput('context', mockContext);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tpl-spinner')).toBeTruthy();

    resolve(StubTemplateComponent as any);
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tpl-spinner')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.stub-tpl')).toBeTruthy();
  }));

  it('re-loads when template_id changes', fakeAsync(() => {
    const loadSpy = vi.fn().mockResolvedValue(StubTemplateComponent);
    vi.spyOn(registry, 'getManifest').mockReturnValue({
      id: 'default-minimal', label: 'Classic', thumbnail: '', tags: [],
      load: loadSpy,
    });

    const fixture = TestBed.createComponent(TemplateRendererComponent);
    fixture.componentRef.setInput('context', mockContext);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const updatedContext = { ...mockContext, event: { ...mockContext.event, template_id: 'soft-floral' } };
    fixture.componentRef.setInput('context', updatedContext);
    fixture.detectChanges();
    tick();

    expect(loadSpy).toHaveBeenCalledTimes(2);
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx ng test --include="**/template-renderer.component.spec.ts" 2>&1 | tail -20
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `template-renderer.component.css`**

```css
/* src/app/features/templates/components/template-renderer/template-renderer.component.css */
.tpl-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.tpl-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: tplSpin 0.8s linear infinite;
}

@keyframes tplSpin { to { transform: rotate(360deg); } }
```

- [ ] **Step 4: Create `template-renderer.component.ts`**

```typescript
// src/app/features/templates/components/template-renderer/template-renderer.component.ts
import { Component, computed, effect, input, signal, Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TemplateContext, TemplateComponent } from '../../template.types';
import { getManifest } from '../../template-registry';

@Component({
  selector: 'app-template-renderer',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `
    @if (!templateComp()) {
      <div class="tpl-loading">
        <div class="tpl-spinner"></div>
      </div>
    } @else {
      <ng-container
        [ngComponentOutlet]="templateComp()!"
        [ngComponentOutletInputs]="templateInputs()">
      </ng-container>
    }
  `,
  styleUrl: './template-renderer.component.css'
})
export class TemplateRendererComponent {
  context = input.required<TemplateContext>();

  templateComp  = signal<Type<TemplateComponent> | null>(null);
  templateInputs = computed(() => ({ context: this.context() }));

  private templateId = computed(() => this.context().event.template_id);

  constructor() {
    effect(() => {
      const id = this.templateId();
      this.templateComp.set(null);
      getManifest(id).load().then(comp => this.templateComp.set(comp));
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx ng test --include="**/template-renderer.component.spec.ts" 2>&1 | tail -20
```

Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/templates/components/template-renderer/
git commit -m "feat: add TemplateRendererComponent with lazy loading"
```

---

## Task 8: TemplateGalleryComponent

**Files:**
- Create: `src/app/features/templates/components/template-gallery/template-gallery.component.ts`
- Create: `src/app/features/templates/components/template-gallery/template-gallery.component.html`
- Create: `src/app/features/templates/components/template-gallery/template-gallery.component.css`
- Create: `src/app/features/templates/components/template-gallery/template-gallery.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/features/templates/components/template-gallery/template-gallery.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TemplateGalleryComponent } from './template-gallery.component';
import { TEMPLATE_REGISTRY } from '../../template-registry';

describe('TemplateGalleryComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TemplateGalleryComponent] });
  });

  it('renders a card for every registered template', () => {
    const fixture = TestBed.createComponent(TemplateGalleryComponent);
    fixture.componentRef.setInput('selectedId', 'default-minimal');
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.gallery-card');
    expect(cards.length).toBe(TEMPLATE_REGISTRY.length);
  });

  it('marks the selected template with the selected class', () => {
    const fixture = TestBed.createComponent(TemplateGalleryComponent);
    fixture.componentRef.setInput('selectedId', 'soft-floral');
    fixture.detectChanges();
    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.gallery-card');
    const selectedIndex = TEMPLATE_REGISTRY.findIndex(t => t.id === 'soft-floral');
    expect(cards[selectedIndex].classList.contains('selected')).toBe(true);
  });

  it('emits templateSelected with the id when a card is clicked', () => {
    const fixture = TestBed.createComponent(TemplateGalleryComponent);
    fixture.componentRef.setInput('selectedId', 'default-minimal');
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.templateSelected.subscribe((id: string) => emitted.push(id));
    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.gallery-card');
    const softFloralIndex = TEMPLATE_REGISTRY.findIndex(t => t.id === 'soft-floral');
    cards[softFloralIndex].click();
    expect(emitted).toEqual(['soft-floral']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx ng test --include="**/template-gallery.component.spec.ts" 2>&1 | tail -20
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `template-gallery.component.css`**

```css
/* src/app/features/templates/components/template-gallery/template-gallery.component.css */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.gallery-card {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.gallery-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
}

.gallery-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
}

.gallery-thumbnail {
  width: 100%;
  aspect-ratio: 8 / 5;
  overflow: hidden;
  background: var(--color-bg);
}

.gallery-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gallery-label {
  padding: 8px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gallery-check {
  color: var(--color-primary);
  font-weight: 700;
}
```

- [ ] **Step 4: Create `template-gallery.component.html`**

```html
<!-- src/app/features/templates/components/template-gallery/template-gallery.component.html -->
<div class="gallery-grid">
  @for (tpl of templates; track tpl.id) {
    <button
      class="gallery-card"
      [class.selected]="tpl.id === selectedId()"
      (click)="select(tpl.id)"
      type="button">
      <div class="gallery-thumbnail">
        <img [src]="tpl.thumbnail" [alt]="tpl.label" />
      </div>
      <div class="gallery-label">
        {{ tpl.label }}
        @if (tpl.id === selectedId()) {
          <span class="gallery-check">✓</span>
        }
      </div>
    </button>
  }
</div>
```

- [ ] **Step 5: Create `template-gallery.component.ts`**

```typescript
// src/app/features/templates/components/template-gallery/template-gallery.component.ts
import { Component, input, output } from '@angular/core';
import { TEMPLATE_REGISTRY } from '../../template-registry';

@Component({
  selector: 'app-template-gallery',
  standalone: true,
  templateUrl: './template-gallery.component.html',
  styleUrl:    './template-gallery.component.css'
})
export class TemplateGalleryComponent {
  selectedId       = input.required<string>();
  templateSelected = output<string>();

  readonly templates = TEMPLATE_REGISTRY;

  select(id: string): void {
    this.templateSelected.emit(id);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx ng test --include="**/template-gallery.component.spec.ts" 2>&1 | tail -20
```

Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/templates/components/template-gallery/
git commit -m "feat: add TemplateGalleryComponent"
```

---

## Task 9: Refactor Guest View

**Files:**
- Modify: `src/app/features/guest-view/components/guest-view.component.ts`
- Modify: `src/app/features/guest-view/components/guest-view.component.html`
- Modify: `src/app/features/guest-view/components/guest-view.component.css`

- [ ] **Step 1: Update `guest-view.component.ts`**

Replace the entire file:

```typescript
// src/app/features/guest-view/components/guest-view.component.ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Supabase } from '../../../core/services/supabase/supabase';
import { RsvpStatus } from './rsvp-buttons/rsvp-buttons.component';
import { EventData, GuestData, TemplateContext } from '../../../features/templates/template.types';
import { TemplateRendererComponent } from '../../../features/templates/components/template-renderer/template-renderer.component';

@Component({
  selector: 'app-guest-view',
  standalone: true,
  imports: [CommonModule, RouterModule, TemplateRendererComponent],
  templateUrl: './guest-view.component.html',
  styleUrls: ['./guest-view.component.css']
})
export class GuestViewComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private supabase = inject(Supabase);

  eventId    = signal<string | null>(null);
  guestId    = signal<string | null>(null);
  eventData  = signal<EventData | null>(null);
  guestData  = signal<GuestData | null>(null);
  rsvpStatus = signal<RsvpStatus>('Pending');
  isLoading  = signal(true);
  hasError   = signal(false);
  rsvpError  = signal<string | null>(null);

  templateContext = computed<TemplateContext | null>(() => {
    const event = this.eventData();
    const guest = this.guestData();
    if (!event || !guest) return null;
    return {
      event,
      guest,
      rsvpStatus: this.rsvpStatus(),
      rsvpError:  this.rsvpError(),
      onRsvpChange: (status: RsvpStatus) => this.handleRsvpChange(status),
    };
  });

  ngOnInit() {
    this.eventId.set(this.route.snapshot.paramMap.get('eventId'));
    this.guestId.set(this.route.snapshot.paramMap.get('guestId'));
    if (this.eventId() && this.guestId()) {
      this.loadInvitationData();
    } else {
      this.hasError.set(true);
      this.isLoading.set(false);
    }
  }

  async loadInvitationData() {
    try {
      this.isLoading.set(true);
      const [eventRes, guestRes, rsvpRes] = await Promise.all([
        this.supabase.client.from('events').select('*').eq('id', this.eventId()).single(),
        this.supabase.client.from('guests').select('*').eq('id', this.guestId()).single(),
        this.supabase.client.from('rsvps').select('*').eq('guest_id', this.guestId()).maybeSingle()
      ]);
      if (eventRes.error || guestRes.error) throw new Error('Invitation not found');
      this.eventData.set(eventRes.data as EventData);
      this.guestData.set(guestRes.data as GuestData);
      if (!rsvpRes.error && rsvpRes.data?.status) {
        this.rsvpStatus.set(rsvpRes.data.status as RsvpStatus);
      }
    } catch {
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleRsvpChange(status: RsvpStatus) {
    if (status === 'Pending') { this.rsvpStatus.set('Pending'); return; }
    const guestId = this.guestId();
    if (!guestId) return;
    this.rsvpError.set(null);
    try {
      await this.supabase.updateRsvpStatus(guestId, status);
      this.rsvpStatus.set(status);
    } catch {
      this.rsvpError.set('Failed to save your response. Please try again.');
    }
  }
}
```

- [ ] **Step 2: Update `guest-view.component.html`**

Replace the entire file:

```html
<!-- src/app/features/guest-view/components/guest-view.component.html -->
<main class="guest-page">

  @if (isLoading()) {
    <div class="status-wrap fade-in">
      <div class="spinner"></div>
      <p class="status-text">Preparing your invitation…</p>
    </div>
  }

  @else if (hasError()) {
    <div class="status-wrap error fade-in">
      <div class="err-icon">🔍</div>
      <h2>Invitation not found</h2>
      <p>Please verify the link with your host.</p>
      <a routerLink="/" class="back-home">← Back to home</a>
    </div>
  }

  @else if (templateContext()) {
    <app-template-renderer [context]="templateContext()!"></app-template-renderer>
  }

</main>
```

- [ ] **Step 3: Trim `guest-view.component.css`**

Remove all card-related rules that were moved to `default-minimal.template.css`. Keep only the page/status rules. Replace the entire file with:

```css
/* src/app/features/guest-view/components/guest-view.component.css */
.guest-page {
  min-height: 100vh;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.status-wrap {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 40px; height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.status-text { color: var(--color-text-muted); font-size: 0.875rem; }

.status-wrap.error { color: var(--color-text); }
.err-icon { font-size: 2.5rem; }
.status-wrap h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }
.status-wrap p  { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; }

.back-home {
  display: inline-block;
  margin-top: 16px;
  font-size: 0.83rem;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color 0.15s;
}
.back-home:hover { color: var(--color-primary); }

.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 4: Verify TypeScript compiles and the guest view route works**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors. Then run `npm start` and open a guest invitation URL to confirm the invitation still renders correctly.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/guest-view/components/guest-view.component.ts \
        src/app/features/guest-view/components/guest-view.component.html \
        src/app/features/guest-view/components/guest-view.component.css
git commit -m "feat: guest view delegates rendering to TemplateRendererComponent"
```

---

## Task 10: Host Dashboard — Template Picker Step

> ⚠️ **Tasks 10 and 11 must be implemented together before compiling.** Task 10's `host-dashboard.component.ts` imports `EditEventDialogComponent` from Task 11. The TypeScript compiler will fail until Task 11 files exist. Complete all steps in both tasks, then do the single commit at the end of Task 11.

**Files:**
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.ts`
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.html`
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.css`

- [ ] **Step 1: Update `host-dashboard.component.ts`**

Add the new signals and methods. Replace the entire file:

```typescript
// src/app/features/host-dashboard/components/host-dashboard.component.ts
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Supabase } from '../../../core/services/supabase/supabase';
import { ToastService } from '../../../core/services/toast/toast.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { EventFormComponent } from './event-form/event-form.component';
import { AddGuestFormComponent } from './add-guest-form/add-guest-form.component';
import { GuestTableComponent } from './guest-table/guest-table.component';
import { TemplateGalleryComponent } from '../../../features/templates/components/template-gallery/template-gallery.component';
import { EditEventDialogComponent, EditDialogResult } from './edit-event-dialog/edit-event-dialog.component';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    EventFormComponent,
    AddGuestFormComponent,
    GuestTableComponent,
    TemplateGalleryComponent,
  ],
  templateUrl: './host-dashboard.component.html',
  styleUrls: ['./host-dashboard.component.css']
})
export class HostDashboardComponent implements OnInit, OnDestroy {
  private supabase    = inject(Supabase);
  private router      = inject(Router);
  private platformId  = inject(PLATFORM_ID);
  private toast       = inject(ToastService);
  private dialog      = inject(MatDialog);

  userId             = signal<string | null>(null);
  isLoading          = signal(true);
  activeEvent        = signal<any>(null);
  guests             = signal<any[]>([]);
  showTemplatePicker = signal(false);
  selectedTemplateId = signal('default-minimal');
  isSavingTemplate   = signal(false);

  private realtimeChannel: ReturnType<typeof this.supabase.client.channel> | null = null;

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.userId.set(user.id);
    await this.fetchDashboardData(user.id);
  }

  async fetchDashboardData(userId: string) {
    try {
      const events = await this.supabase.getEventByHost(userId);
      if (events?.length) {
        this.activeEvent.set(events[0]);
        await this.loadGuests(events[0].id);
        this.subscribeToRsvpUpdates(events[0].id);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  handleEventCreated(event: any) {
    this.activeEvent.set(event);
    this.selectedTemplateId.set('default-minimal');
    this.showTemplatePicker.set(true);
  }

  async confirmTemplate() {
    const event = this.activeEvent();
    if (!event) return;
    this.isSavingTemplate.set(true);
    try {
      await this.supabase.updateEvent(event.id, { template_id: this.selectedTemplateId() });
      this.activeEvent.set({ ...event, template_id: this.selectedTemplateId() });
      this.showTemplatePicker.set(false);
      this.toast.success('Template saved!');
    } catch {
      this.toast.error('Could not save template. Please try again.');
    } finally {
      this.isSavingTemplate.set(false);
    }
  }

  openEditDialog() {
    const event = this.activeEvent();
    if (!event) return;
    const ref = this.dialog.open(EditEventDialogComponent, {
      data: { event },
      width: '440px',
      panelClass: 'edit-event-dialog-panel',
    });
    ref.afterClosed().subscribe(async (result: EditDialogResult | undefined) => {
      if (!result) return;
      try {
        await this.supabase.updateEvent(event.id, result);
        this.activeEvent.set({ ...event, ...result });
        this.toast.success('Event updated!');
      } catch {
        this.toast.error('Could not update event. Please try again.');
      }
    });
  }

  subscribeToRsvpUpdates(eventId: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.realtimeChannel = this.supabase.client
      .channel(`rsvps-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rsvps' },
        (payload) => {
          const changedGuestId =
            (payload.new as { guest_id?: string })?.guest_id ??
            (payload.old as { guest_id?: string })?.guest_id;
          if (changedGuestId && this.guests().some(g => g.id === changedGuestId)) {
            this.loadGuests(eventId);
          }
        }
      )
      .subscribe();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
  }

  async loadGuests(eventId: string) {
    const list = await this.supabase.getGuests(eventId);
    this.guests.set(list || []);
  }

  async handleGuestAdded() {
    await this.loadGuests(this.activeEvent().id);
    this.toast.success('Guest added successfully!');
  }

  async handleGuestDeleted() {
    await this.loadGuests(this.activeEvent().id);
    this.toast.success('Guest deleted successfully!');
  }

  async copyLink(guestId: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `${window.location.origin}/w/${this.activeEvent().id}/${guestId}`;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.info('Invitation link copied!');
    } catch {
      this.toast.error('Could not copy — please copy the link manually.');
    }
  }

  async sendEmailInvitation(guestId: string) {
    try {
      await this.supabase.sendEmailInvitation(guestId);
      this.toast.success('Invitation email sent!');
    } catch {
      this.toast.error('Failed to send email. The email service may not be set up yet.');
    }
  }

  async handleLogout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Update `host-dashboard.component.html`**

Replace the entire file:

```html
<!-- src/app/features/host-dashboard/components/host-dashboard.component.html -->
<app-header variant="dashboard" (logoutClick)="handleLogout()"></app-header>

<main class="dash-main">

  @if (isLoading()) {
    <div class="loading-wrap">
      <div class="spinner"></div>
      <p>Loading your dashboard…</p>
    </div>
  }

  @else if (!activeEvent()) {
    <app-event-form
      [hostId]="userId()!"
      (eventCreated)="handleEventCreated($event)">
    </app-event-form>
  }

  @else {
    <!-- Event strip -->
    <div class="event-strip">
      <div class="event-strip-inner">
        <div>
          <h1 class="event-title">{{ activeEvent().title }}</h1>
          <p class="event-meta">
            {{ activeEvent().event_date | date:'EEEE, MMM d · h:mm a' }}
            @if (activeEvent().location_text) {
              · {{ activeEvent().location_text }}
            }
            @if (activeEvent().template_id) {
              <span class="event-meta-template">· {{ activeEvent().template_id | titlecase }}</span>
            }
          </p>
        </div>
        <div class="event-strip-actions">
          <span class="live-badge">● Live</span>
          <button class="btn-edit" (click)="openEditDialog()" type="button">✏ Edit</button>
        </div>
      </div>
    </div>

    <!-- Template picker step (shown once after event creation) -->
    @if (showTemplatePicker()) {
      <section class="template-picker-step">
        <h2 class="picker-heading">✦ Choose your invitation template</h2>
        <p class="picker-sub">Pick how your invitation looks to guests. You can change this later.</p>
        <app-template-gallery
          [selectedId]="selectedTemplateId()"
          (templateSelected)="selectedTemplateId.set($event)">
        </app-template-gallery>
        <div class="picker-actions">
          <button
            class="btn-confirm"
            (click)="confirmTemplate()"
            [disabled]="isSavingTemplate()"
            type="button">
            {{ isSavingTemplate() ? 'Saving…' : 'Confirm Template →' }}
          </button>
        </div>
      </section>
    }

    <!-- Dashboard grid -->
    <div class="dash-grid">
      <app-add-guest-form
        [eventId]="activeEvent().id"
        (guestAdded)="handleGuestAdded()"
        (guestDeleted)="handleGuestDeleted()">
      </app-add-guest-form>

      <app-guest-table
        [guests]="guests()"
        (copyLink)="copyLink($event)"
        (sendEmail)="sendEmailInvitation($event)"
        (guestDeleted)="handleGuestDeleted()">
      </app-guest-table>
    </div>
  }

</main>
```

- [ ] **Step 3: Add new CSS to `host-dashboard.component.css`**

Append to the end of the existing file:

```css
.event-strip-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-edit {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-edit:hover {
  background: var(--color-primary);
  color: #fff;
}

.event-meta-template {
  color: var(--color-text-muted);
}

.template-picker-step {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.picker-heading {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 6px;
  color: var(--color-text);
}

.picker-sub {
  font-size: 0.83rem;
  color: var(--color-text-muted);
  margin: 0 0 16px;
}

.picker-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.btn-confirm {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: error about `EditEventDialogComponent` not existing yet — that's expected. It will be fixed in Task 11. Add a temporary stub import comment if needed, or proceed directly to Task 11.

- [ ] **Step 5: Commit after Task 11 completes (do not commit yet)**

---

## Task 11: Edit Event Dialog

**Files:**
- Create: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.ts`
- Create: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html`
- Create: `src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.css`

- [ ] **Step 1: Create `edit-event-dialog.component.css`**

```css
/* src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.css */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.dialog-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.9rem;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.field input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.field-locked input {
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.lock-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.template-section {
  margin-bottom: 20px;
}

.template-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 8px;
  padding: 9px 18px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-save {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 18px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Create `edit-event-dialog.component.html`**

```html
<!-- src/app/features/host-dashboard/components/edit-event-dialog/edit-event-dialog.component.html -->
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

- [ ] **Step 3: Create `edit-event-dialog.component.ts`**

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
    title:         new FormControl(this.data.event.title,         Validators.required),
    location_text: new FormControl(this.data.event.location_text ?? ''),
  });

  selectedTemplateId = signal(this.data.event.template_id ?? 'default-minimal');

  save(): void {
    if (this.form.invalid) return;
    const result: EditDialogResult = {
      title:         this.form.value.title!,
      location_text: this.form.value.location_text ?? '',
      template_id:   this.selectedTemplateId(),
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
```

- [ ] **Step 4: Add `provideAnimationsAsync` to `app.config.ts`**

Angular Material's `MatDialog` requires the animations provider. Open `src/app/app.config.ts` and add the import and provider:

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners, TransferState } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideLottieOptions } from 'ngx-lottie';
import { APP_ENV, APP_ENV_STATE_KEY, AppEnv } from './core/tokens/app-env';

const DEFAULT_ENV: AppEnv = { supabaseUrl: '', supabaseKey: '' };

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideAnimationsAsync(),
    provideLottieOptions({
      player: () => import('lottie-web'),
    }),
    {
      provide: APP_ENV,
      useFactory: (ts: TransferState): AppEnv => ts.get(APP_ENV_STATE_KEY, DEFAULT_ENV),
      deps: [TransferState],
    },
  ],
};
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Expected: no errors.

- [ ] **Step 6: Smoke-test the full flow**

Run `npm start`. Then:
1. Log in as a host
2. Create a new event — template picker section should appear
3. Select "Soft Floral" and click "Confirm Template"
4. The event strip should now show `· Soft-Floral` in the meta line
5. Click "✏ Edit" — dialog should open with the locked date and template picker
6. Change the template back to "Classic", save — strip updates
7. Open a guest invitation link — should render using the selected template

- [ ] **Step 6: Commit**

```bash
git add src/app/features/host-dashboard/components/edit-event-dialog/ \
        src/app/features/host-dashboard/components/host-dashboard.component.ts \
        src/app/features/host-dashboard/components/host-dashboard.component.html \
        src/app/features/host-dashboard/components/host-dashboard.component.css
git commit -m "feat: template picker step and edit event dialog in host dashboard"
```

---

## Final Verification

- [ ] Run the full test suite: `npx ng test 2>&1 | tail -30` — all tests pass
- [ ] Run `npm start`, create an event, select Soft Floral, open a guest invitation link — floral design renders
- [ ] Open the edit dialog, switch to Classic, open the guest link — classic design renders
- [ ] `npx tsc --noEmit -p tsconfig.app.json` — no TypeScript errors
