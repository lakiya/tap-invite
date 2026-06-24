# Invitation Booklet Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `invitation-booklet` Angular standalone template — a 5th template simulating a physical 2-page invitation booklet with Cover → Spread → Back Cover states, navigable by swipe and tap zones.

**Architecture:** Fixed 2-page-wide frame with left/right `<div>` pages each holding front and back faces (`backface-visibility: hidden`). A `state` signal drives per-state `rotateY()` CSS transforms. Tap zones and swipe gestures both call a single `navigate()` method. Tap zones and nav dots live in a `position: relative` wrapper that matches the book's max-width.

**Tech Stack:** Angular 17+ standalone components, Angular signals, CSS 3D transforms (`perspective`, `transform-style: preserve-3d`, `rotateY`, `backface-visibility`).

## Global Constraints

- Implements `TemplateComponent` interface: `context: InputSignal<TemplateContext>`
- Guest display name: `context().guest.display_name` (NOT `.name`)
- No external image assets — CSS gradients and Unicode ornaments only
- Google Fonts: Playfair Display (same import as wedding-book)
- Palette: primary `#c9a84c`, text `#3a2e1e`, muted `#7a6a52`, page bg `#fffdf8` / `#fffaf4`
- Mobile breakpoint ≤600px: full screen, remove shadows and border-radius
- All new files: `tap-invite/src/app/features/templates/invitation-booklet/`
- Registry: `tap-invite/src/app/features/templates/template-registry.ts`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `invitation-booklet/invitation-booklet.manifest.ts` | Manifest + lazy loader |
| Create | `invitation-booklet/invitation-booklet.template.ts` | Component — state, interactions, template markup |
| Create | `invitation-booklet/invitation-booklet.template.css` | All styles |
| Create | `invitation-booklet/invitation-booklet.template.spec.ts` | State machine unit tests |
| Modify | `template-registry.ts` | Append 5th entry |

---

### Task 1: Scaffold files and register template

**Files:**
- Create: `tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.manifest.ts`
- Create: `tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.ts`
- Create: `tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.css`
- Modify: `tap-invite/src/app/features/templates/template-registry.ts`

**Interfaces:**
- Produces: exported class `InvitationBookletTemplateComponent` implementing `TemplateComponent`
- Produces: exported const `invitationBookletManifest` of type `TemplateManifest`
- Produces: exported type `BookState = 'cover' | 'spread' | 'back'`
- Produces: public method `navigate(direction: 'forward' | 'backward'): void`

- [ ] **Step 1: Create the manifest**

```typescript
// tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.manifest.ts
import { TemplateManifest } from '../template.types';

export const invitationBookletManifest: TemplateManifest = {
  id: 'invitation-booklet',
  label: 'Invitation Booklet',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="213"><rect width="160" height="213" fill="%23fffaf4" rx="6"/><rect x="10" y="10" width="140" height="193" fill="none" stroke="%23c9a84c" stroke-width="0.7" rx="4" opacity="0.35"/><rect x="78" y="10" width="4" height="193" fill="%23c9a84c" opacity="0.25"/><rect x="24" y="70" width="50" height="6" rx="3" fill="%233a2e1e" opacity="0.4"/><rect x="24" y="82" width="36" height="4" rx="2" fill="%237a6a52" opacity="0.3"/><rect x="86" y="70" width="50" height="6" rx="3" fill="%233a2e1e" opacity="0.4"/><rect x="86" y="82" width="36" height="4" rx="2" fill="%237a6a52" opacity="0.3"/><circle cx="56" cy="175" r="3" fill="%23c9a84c" opacity="0.35"/><circle cx="80" cy="175" r="3" fill="%23c9a84c" opacity="0.7"/><circle cx="104" cy="175" r="3" fill="%23c9a84c" opacity="0.35"/></svg>`,
  tags: ['booklet', 'elegant', 'wedding'],
  load: () =>
    import('./invitation-booklet.template').then(m => m.InvitationBookletTemplateComponent),
};
```

- [ ] **Step 2: Create the shell component**

```typescript
// tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.ts
import { Component, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

export type BookState = 'cover' | 'spread' | 'back';

@Component({
  selector: 'app-invitation-booklet-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `<div class="ib-scene"><!-- pages added in Task 3 --></div>`,
  styleUrl: './invitation-booklet.template.css'
})
export class InvitationBookletTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
  state = signal<BookState>('cover');

  private dragStartX = 0;
  private dragStartY = 0;

  navigate(direction: 'forward' | 'backward'): void {
    const s = this.state();
    if (direction === 'forward') {
      if (s === 'cover')  this.state.set('spread');
      if (s === 'spread') this.state.set('back');
    } else {
      if (s === 'back')   this.state.set('spread');
      if (s === 'spread') this.state.set('cover');
    }
  }

  onDragStart(e: TouchEvent | MouseEvent): void {
    this.dragStartX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
    this.dragStartY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;
  }

  onDragEnd(e: TouchEvent | MouseEvent): void {
    const endX = e instanceof TouchEvent ? e.changedTouches[0].clientX : e.clientX;
    const endY = e instanceof TouchEvent ? e.changedTouches[0].clientY : e.clientY;
    const deltaX = endX - this.dragStartX;
    const deltaY = endY - this.dragStartY;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    this.navigate(deltaX < 0 ? 'forward' : 'backward');
  }
}
```

- [ ] **Step 3: Create an empty CSS file**

Create `tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.css` with content:
```css
/* Invitation Booklet styles — added in Tasks 5–7 */
```

- [ ] **Step 4: Register in template registry**

Replace the full content of `tap-invite/src/app/features/templates/template-registry.ts` with:

```typescript
import { TemplateManifest } from './template.types';
import { defaultMinimalManifest }     from './default-minimal/default-minimal.manifest';
import { softFloralManifest }         from './soft-floral/soft-floral.manifest';
import { flipCardManifest }           from './flip-card/flip-card.manifest';
import { weddingBookManifest }        from './wedding-book/wedding-book.manifest';
import { invitationBookletManifest }  from './invitation-booklet/invitation-booklet.manifest';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [
  defaultMinimalManifest,
  softFloralManifest,
  flipCardManifest,
  weddingBookManifest,
  invitationBookletManifest,
];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
```

- [ ] **Step 5: Verify build**

```bash
cd tap-invite && ng build --configuration development
```

Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add tap-invite/src/app/features/templates/invitation-booklet/ tap-invite/src/app/features/templates/template-registry.ts
git commit -m "feat: scaffold invitation-booklet template and register as 5th template"
```

---

### Task 2: State machine unit tests

**Files:**
- Create: `tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.spec.ts`

**Interfaces:**
- Consumes: `InvitationBookletTemplateComponent`, `BookState` from Task 1
- Consumes: `TemplateContext`, `RsvpStatus` from `../template.types`

- [ ] **Step 1: Write the tests**

```typescript
// tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.spec.ts
import { TestBed } from '@angular/core/testing';
import { InvitationBookletTemplateComponent } from './invitation-booklet.template';
import { TemplateContext, RsvpStatus } from '../template.types';

const mockContext: TemplateContext = {
  event: {
    id: '1', host_id: 'h1', title: 'Test Event',
    event_date: '2026-12-01T18:00:00',
    location_text: 'Test Venue', template_id: 'invitation-booklet',
    google_maps_url: null, notes: null, show_rsvp: true,
  },
  guest: { id: 'g1', event_id: '1', display_name: 'Jane Doe' },
  rsvpStatus: 'Pending' as RsvpStatus,
  rsvpError: null,
  onRsvpChange: () => {},
};

describe('InvitationBookletTemplateComponent – navigate()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [InvitationBookletTemplateComponent] });
  });

  function create() {
    const fixture = TestBed.createComponent(InvitationBookletTemplateComponent);
    fixture.componentRef.setInput('context', mockContext);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('starts in cover state', () => {
    expect(create().state()).toBe('cover');
  });

  it('cover + forward → spread', () => {
    const c = create(); c.navigate('forward');
    expect(c.state()).toBe('spread');
  });

  it('spread + forward → back', () => {
    const c = create(); c.navigate('forward'); c.navigate('forward');
    expect(c.state()).toBe('back');
  });

  it('back + forward → back (no-op)', () => {
    const c = create(); c.navigate('forward'); c.navigate('forward'); c.navigate('forward');
    expect(c.state()).toBe('back');
  });

  it('cover + backward → cover (no-op)', () => {
    const c = create(); c.navigate('backward');
    expect(c.state()).toBe('cover');
  });

  it('spread + backward → cover', () => {
    const c = create(); c.navigate('forward'); c.navigate('backward');
    expect(c.state()).toBe('cover');
  });

  it('back + backward → spread', () => {
    const c = create(); c.navigate('forward'); c.navigate('forward'); c.navigate('backward');
    expect(c.state()).toBe('spread');
  });
});
```

- [ ] **Step 2: Run tests — expect all 7 to pass**

```bash
cd tap-invite && ng test --include="**/invitation-booklet.template.spec.ts" --watch=false
```

Expected output: `7 specs, 0 failures`

- [ ] **Step 3: Commit**

```bash
git add tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.spec.ts
git commit -m "test: add state machine tests for invitation-booklet"
```

---

### Task 3: Full template markup (book structure + page content)

**Files:**
- Modify: `tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.ts`

**Interfaces:**
- Consumes: `state()`, `navigate()`, `onDragStart()`, `onDragEnd()` from Task 1
- Consumes: `context().event.title`, `.event_date`, `.location_text`, `.google_maps_url`, `.notes`, `.show_rsvp`
- Consumes: `context().guest.display_name`, `.rsvpStatus`, `.rsvpError`, `.onRsvpChange`

- [ ] **Step 1: Replace the shell template with the full markup**

Replace `template: \`...\`` in `invitation-booklet.template.ts` with:

```typescript
template: `
  <div class="ib-scene"
       (touchstart)="onDragStart($event)"
       (touchend)="onDragEnd($event)"
       (mousedown)="onDragStart($event)"
       (mouseup)="onDragEnd($event)">

    <div class="ib-wrapper">
      <div [class]="'ib-book ib-' + state()">

        <!-- LEFT PAGE: front = Page 2 (spread left), back = Page 4 (back cover) -->
        <div class="ib-page ib-page-left">

          <!-- Front face — Page 2: When & Where -->
          <div class="ib-face ib-face-front ib-side-2">
            <div class="ib-inner-content">
              <p class="ib-section-ornament">◆</p>
              <p class="ib-section-label">When &amp; Where</p>
              <div class="ib-gold-rule"></div>
              <div class="ib-detail-block">
                <p class="ib-detail-label">Date &amp; Time</p>
                <p class="ib-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
                <p class="ib-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
              </div>
              <div class="ib-detail-block">
                <p class="ib-detail-label">Venue</p>
                <p class="ib-detail-primary">{{ context().event.location_text }}</p>
                @if (context().event.google_maps_url) {
                  <a [href]="context().event.google_maps_url"
                     target="_blank" rel="noopener noreferrer"
                     class="ib-map-link">View on Google Maps →</a>
                }
              </div>
              @if (context().event.notes) {
                <div class="ib-detail-block">
                  <p class="ib-detail-label">Notes</p>
                  <p class="ib-notes-text">{{ context().event.notes }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Back face — Page 4: Back Cover -->
          <div class="ib-face ib-face-back ib-side-4">
            <div class="ib-corner ib-tl">✦</div>
            <div class="ib-corner ib-tr">✦</div>
            <div class="ib-corner ib-bl">✦</div>
            <div class="ib-corner ib-br">✦</div>
            <div class="ib-s4-content">
              <p class="ib-s4-ornament">❧</p>
              <div class="ib-gold-rule"></div>
              <p class="ib-s4-message">We look forward<br>to celebrating<br>with you.</p>
              <div class="ib-gold-rule"></div>
              <p class="ib-s4-closing">With love ♡</p>
            </div>
          </div>

        </div>

        <!-- SPINE -->
        <div class="ib-spine"></div>

        <!-- RIGHT PAGE: front = Page 1 (cover), back = Page 3 (spread right) -->
        <div class="ib-page ib-page-right">

          <!-- Front face — Page 1: Cover -->
          <div class="ib-face ib-face-front ib-side-1">
            <div class="ib-corner ib-tl">✦</div>
            <div class="ib-corner ib-tr">✦</div>
            <div class="ib-corner ib-bl">✦</div>
            <div class="ib-corner ib-br">✦</div>
            <div class="ib-s1-content">
              <p class="ib-ornament">❧</p>
              <p class="ib-invite-line">You are cordially invited</p>
              <div class="ib-gold-rule"></div>
              <h1 class="ib-title">{{ context().event.title }}</h1>
              <div class="ib-gold-rule"></div>
              <p class="ib-cover-date">{{ context().event.event_date | date:'MMMM d, y' }}</p>
              <p class="ib-tap-hint">
                <span class="ib-pulse"></span>
                Tap to open
              </p>
            </div>
          </div>

          <!-- Back face — Page 3: RSVP -->
          <div class="ib-face ib-face-back ib-side-3">
            <div class="ib-inner-content">
              <p class="ib-section-ornament">◆</p>
              <p class="ib-section-label">Will you join us?</p>
              <div class="ib-gold-rule"></div>
              @if (context().event.show_rsvp !== false) {
                <p class="ib-guest-name">{{ context().guest.display_name }}</p>
                <div class="ib-rsvp-area">
                  <app-rsvp-buttons
                    [status]="context().rsvpStatus"
                    (rsvpChange)="context().onRsvpChange($event)">
                  </app-rsvp-buttons>
                  @if (context().rsvpError) {
                    <p class="ib-rsvp-error">{{ context().rsvpError }}</p>
                  }
                </div>
              } @else {
                <div class="ib-rsvp-disabled">
                  <p class="ib-rsvp-ornament">❧</p>
                  <p class="ib-rsvp-note">Kindly note your attendance</p>
                </div>
              }
            </div>
          </div>

        </div>
      </div>

      <!-- TAP ZONES (positioned within wrapper, over the book) -->
      <div class="ib-tap-left"
           [class.ib-tap-disabled]="state() === 'cover'"
           (click)="navigate('backward')">
        <span class="ib-chevron">‹</span>
      </div>
      <div class="ib-tap-right"
           [class.ib-tap-disabled]="state() === 'back'"
           (click)="navigate('forward')">
        <span class="ib-chevron">›</span>
      </div>

      <!-- NAV DOTS -->
      <div class="ib-dots">
        <span class="ib-dot" [class.ib-dot-active]="state() === 'cover'"></span>
        <span class="ib-dot" [class.ib-dot-active]="state() === 'spread'"></span>
        <span class="ib-dot" [class.ib-dot-active]="state() === 'back'"></span>
      </div>
    </div>

  </div>
`,
```

- [ ] **Step 2: Build to verify no compilation errors**

```bash
cd tap-invite && ng build --configuration development
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.ts
git commit -m "feat: add full template markup for invitation-booklet (all 4 pages + tap zones)"
```

---

### Task 4: CSS — scene, wrapper, book structure, 3D setup, state transforms

**Files:**
- Modify: `tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.css`

- [ ] **Step 1: Replace CSS file with structural and state styles**

Replace the full contents of `invitation-booklet.template.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap');

/* ── Scene ── */
.ib-scene {
  min-height: 100vh;
  background: linear-gradient(160deg, #f5ede0 0%, #ede0cf 50%, #e8d8c0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px 64px;
  font-family: 'Playfair Display', Georgia, serif;
  perspective: 1600px;
  perspective-origin: center center;
}

/* ── Wrapper: positions tap zones and dots relative to the book ── */
.ib-wrapper {
  position: relative;
  width: 100%;
  max-width: 740px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  user-select: none;
}

/* ── Book frame ── */
.ib-book {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: min(520px, 82vh);
}

/* ── Pages ── */
.ib-page {
  flex: 1;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.9s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: center center;
}

/* ── Spine ── */
.ib-spine {
  width: 8px;
  flex-shrink: 0;
  background: linear-gradient(
    to right,
    rgba(100, 70, 20, 0.12) 0%,
    rgba(201, 168, 76, 0.55) 35%,
    rgba(201, 168, 76, 0.55) 65%,
    rgba(100, 70, 20, 0.12) 100%
  );
  z-index: 10;
  align-self: stretch;
  box-shadow:
    -3px 0 12px rgba(100, 70, 20, 0.10),
     3px 0 12px rgba(100, 70, 20, 0.10);
}

/* ── Faces ── */
.ib-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
  box-shadow:
    0 28px 60px rgba(100, 70, 20, 0.20),
    0 0 0 1px rgba(201, 168, 76, 0.15);
}

.ib-face-back { transform: rotateY(180deg); }

.ib-page-left  .ib-face { border-radius: 14px 0 0 14px; }
.ib-page-right .ib-face { border-radius: 0 14px 14px 0; }

/* ── 3-state rotations ── */

/* COVER: right page shows front (Page 1), left page is edge-on */
.ib-cover .ib-page-left  { transform: rotateY(-90deg); }
.ib-cover .ib-page-right { transform: rotateY(0deg);   }

/* SPREAD: left shows front (Page 2), right shows back (Page 3) */
.ib-spread .ib-page-left  { transform: rotateY(0deg);    }
.ib-spread .ib-page-right { transform: rotateY(-180deg); }

/* BACK: left shows back (Page 4), right page is edge-on */
.ib-back .ib-page-left  { transform: rotateY(180deg);  }
.ib-back .ib-page-right { transform: rotateY(-90deg);  }

/* ── Pointer events — disable hidden/edge-on faces ── */
.ib-cover  .ib-page-left  .ib-face-front,
.ib-cover  .ib-page-left  .ib-face-back,
.ib-cover  .ib-page-right .ib-face-back  { pointer-events: none; }

.ib-spread .ib-page-left  .ib-face-back,
.ib-spread .ib-page-right .ib-face-front { pointer-events: none; }

.ib-back   .ib-page-right .ib-face-front,
.ib-back   .ib-page-right .ib-face-back,
.ib-back   .ib-page-left  .ib-face-front { pointer-events: none; }

/* ── Shared utilities ── */
.ib-gold-rule {
  width: 56px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #c9a84c, transparent);
  margin: 0 auto 14px;
  flex-shrink: 0;
}

.ib-corner {
  position: absolute;
  color: #c9a84c;
  font-size: 0.68rem;
  opacity: 0.45;
}
.ib-tl { top: 14px;    left: 16px;  }
.ib-tr { top: 14px;    right: 16px; }
.ib-bl { bottom: 14px; left: 16px;  }
.ib-br { bottom: 14px; right: 16px; }

.ib-inner-content {
  display: flex;
  flex-direction: column;
  padding: clamp(16px, 3vw, 28px) clamp(12px, 2.5vw, 22px) clamp(14px, 2.5vw, 20px);
  width: 100%;
  overflow-y: auto;
  min-height: 0;
}

.ib-section-ornament {
  color: #c9a84c;
  font-size: 0.4rem;
  text-align: center;
  margin: 0 0 5px;
}

.ib-section-label {
  color: #c9a84c;
  font-size: clamp(0.46rem, 1.1vw, 0.54rem);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-align: center;
  margin: 0 0 12px;
  font-style: normal;
}

.ib-detail-block { margin-bottom: 14px; }

.ib-detail-label {
  font-size: clamp(0.44rem, 1vw, 0.52rem);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #c9a84c;
  margin: 0 0 3px;
  font-style: normal;
}

.ib-detail-primary {
  font-size: clamp(0.66rem, 1.8vw, 0.78rem);
  color: #3a2e1e;
  margin: 0 0 2px;
  line-height: 1.4;
}

.ib-detail-secondary {
  font-size: clamp(0.62rem, 1.6vw, 0.72rem);
  color: #7a6a52;
  font-style: italic;
  margin: 0;
}

.ib-map-link {
  display: inline-block;
  margin-top: 4px;
  font-size: clamp(0.58rem, 1.4vw, 0.66rem);
  color: #c9a84c;
  text-decoration: none;
  font-style: normal;
  font-weight: 600;
}
.ib-map-link:hover { text-decoration: underline; }

.ib-notes-text {
  color: #3a2e1e;
  font-size: clamp(0.64rem, 1.8vw, 0.76rem);
  font-style: italic;
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

/* ── Page 1 — Cover ── */
.ib-side-1 {
  background: #fffaf4;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.ib-side-1::before {
  content: '';
  position: absolute;
  inset: 13px;
  border: 1px solid rgba(201, 168, 76, 0.22);
  border-radius: 4px;
  pointer-events: none;
}

.ib-s1-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 36px 22px;
  gap: 0;
}

.ib-ornament {
  color: #c9a84c;
  font-size: 1.25rem;
  margin: 0 0 12px;
  line-height: 1;
}

.ib-invite-line {
  color: #7a6a52;
  font-size: clamp(0.55rem, 1.4vw, 0.68rem);
  font-style: italic;
  letter-spacing: 0.1em;
  margin: 0 0 12px;
}

.ib-title {
  color: #3a2e1e;
  font-size: clamp(1rem, 3.2vw, 1.45rem);
  font-weight: 700;
  line-height: 1.2;
  margin: 0 0 14px;
  letter-spacing: -0.01em;
}

.ib-cover-date {
  color: #7a6a52;
  font-size: clamp(0.62rem, 1.6vw, 0.76rem);
  font-style: italic;
  letter-spacing: 0.06em;
  margin: 0 0 22px;
}

.ib-tap-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  color: rgba(58, 46, 30, 0.36);
  font-size: clamp(0.5rem, 1.2vw, 0.58rem);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-style: normal;
}

.ib-pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(201, 168, 76, 0.7);
  animation: ibPulse 2.4s ease infinite;
  flex-shrink: 0;
}

@keyframes ibPulse {
  0%, 100% { opacity: 1;   transform: scale(1);   box-shadow: 0 0 0 0   rgba(201, 168, 76, 0.5); }
  60%       { opacity: 0.7; transform: scale(1.3); box-shadow: 0 0 0 6px rgba(201, 168, 76, 0);   }
}

/* ── Page 2 — Left spread ── */
.ib-side-2 {
  background: #fffdf8;
  display: flex;
  align-items: stretch;
}

/* ── Page 3 — Right spread ── */
.ib-side-3 {
  background: #fffdf8;
  display: flex;
  align-items: stretch;
}

.ib-guest-name {
  color: #3a2e1e;
  font-size: clamp(0.72rem, 2vw, 0.88rem);
  font-weight: 600;
  font-style: italic;
  text-align: center;
  margin: 0 0 14px;
}

.ib-rsvp-area {
  margin-top: auto;
  padding-top: 2px;
  --color-primary:      #c9a84c;
  --color-primary-dark: #a8843a;
  --color-text:         #3a2e1e;
  --color-text-muted:   #7a6a52;
  --color-border:       rgba(201, 168, 76, 0.35);
  --color-error:        #e05050;
}

.ib-rsvp-error {
  font-size: clamp(0.62rem, 1.6vw, 0.72rem);
  color: #e05050;
  margin: 8px 0 0;
  font-style: italic;
}

.ib-rsvp-disabled {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: auto 0;
}

.ib-rsvp-ornament {
  color: rgba(201, 168, 76, 0.3);
  font-size: 1.4rem;
  margin: 0 0 10px;
}

.ib-rsvp-note {
  color: #7a6a52;
  font-size: clamp(0.62rem, 1.6vw, 0.72rem);
  font-style: italic;
  text-align: center;
  margin: 0;
}

/* ── Page 4 — Back Cover ── */
.ib-side-4 {
  background: #fffaf4;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ib-side-4::before {
  content: '';
  position: absolute;
  inset: 13px;
  border: 1px solid rgba(201, 168, 76, 0.20);
  border-radius: 4px;
  pointer-events: none;
}

.ib-s4-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 20px;
  gap: 0;
}

.ib-s4-ornament {
  color: #c9a84c;
  font-size: 1.25rem;
  margin: 0 0 14px;
  line-height: 1;
}

.ib-s4-message {
  color: #7a6a52;
  font-size: clamp(0.66rem, 1.8vw, 0.8rem);
  font-style: italic;
  line-height: 1.75;
  margin: 0 0 14px;
}

.ib-s4-closing {
  color: #c9a84c;
  font-size: clamp(0.58rem, 1.5vw, 0.72rem);
  font-weight: 600;
  letter-spacing: 0.06em;
  margin: 0;
}

/* ── Tap zones ── */
.ib-tap-left,
.ib-tap-right {
  position: absolute;
  top: 0;
  height: min(520px, 82vh);
  width: 20%;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ib-tap-left  { left: 0;  cursor: w-resize; }
.ib-tap-right { right: 0; cursor: e-resize; }
.ib-tap-disabled { pointer-events: none; }

/* ── Chevrons ── */
.ib-chevron {
  color: rgba(201, 168, 76, 0.55);
  font-size: 1.8rem;
  line-height: 1;
  transition: opacity 0.3s;
  pointer-events: none;
  user-select: none;
}

.ib-tap-disabled .ib-chevron { opacity: 0; }

/* ── Navigation dots ── */
.ib-dots {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 14px 0;
  z-index: 20;
}

.ib-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid #c9a84c;
  background: transparent;
  transition: background 0.3s;
  opacity: 0.55;
}

.ib-dot-active {
  background: #c9a84c;
  opacity: 1;
}

/* ── Mobile ── */
@media (max-width: 600px) {
  .ib-scene {
    padding: 0 0 56px;
    align-items: flex-start;
  }
  .ib-book {
    height: calc(100dvh - 56px);
  }
  .ib-face { box-shadow: none; }
  .ib-page-left  .ib-face { border-radius: 0; }
  .ib-page-right .ib-face { border-radius: 0; }
  .ib-spine { width: 5px; }
  .ib-tap-left,
  .ib-tap-right { height: calc(100dvh - 56px); }
}
```

- [ ] **Step 2: Verify visually in browser**

```bash
cd tap-invite && ng serve
```

Open the `invitation-booklet` template. Verify:
- Cover state: only right page visible (title, date, pulsing hint), left half of frame is transparent
- Swipe left or tap right zone → spread animates open (Pages 2 & 3 side by side)
- Swipe right or tap left zone from spread → returns to cover
- Swipe left from spread → back cover (Page 4, "With love ♡"), right page gone
- Right chevron absent at back state; left chevron absent at cover state
- Nav dots track the current state

- [ ] **Step 3: Run state machine tests to confirm nothing broke**

```bash
cd tap-invite && ng test --include="**/invitation-booklet.template.spec.ts" --watch=false
```

Expected: `7 specs, 0 failures`

- [ ] **Step 4: Commit**

```bash
git add tap-invite/src/app/features/templates/invitation-booklet/invitation-booklet.template.css
git commit -m "feat: add complete CSS for invitation-booklet (3D structure, states, content, nav)"
```

---

### End-to-end manual test checklist

Run after Task 4 is committed. Test in a browser with the dev server (`ng serve`).

- [ ] Cover state: right page shows title, date, "You are cordially invited", pulsing dot + "Tap to open"
- [ ] Left page is invisible (edge-on) in cover state — no shadow artifacts visible
- [ ] Swipe left (≥50px horizontal delta) from cover → spread animates correctly
- [ ] Tap right zone (right 20% of book width) from cover → spread
- [ ] Left chevron `‹` is hidden in cover state
- [ ] Spread: Page 2 (When & Where) on left, Page 3 (RSVP / Will you join us?) on right
- [ ] Google Maps link renders as "View on Google Maps →" (not raw URL) when `google_maps_url` is set
- [ ] Notes section appears on Page 2 only when `notes` is present
- [ ] RSVP section shows guest `display_name` and RSVP buttons when `show_rsvp` is `true`
- [ ] When `show_rsvp` is `false`, Page 3 shows "Kindly note your attendance" instead
- [ ] Swipe right from spread → cover
- [ ] Swipe left from spread → back cover
- [ ] Back cover (Page 4): decorative corners, ❧ ornament, "With love ♡"
- [ ] Right chevron `›` is hidden in back state
- [ ] Swipe right from back → spread
- [ ] Swipe left from back → no state change (no-op)
- [ ] Swipe right from cover → no state change (no-op)
- [ ] Nav dots: first dot active on cover, second on spread, third on back
- [ ] Vertical scrolling inside Page 2 (when notes are long) is not intercepted by swipe
- [ ] Mobile (≤600px): book fills screen height, no shadows, no rounded corners
