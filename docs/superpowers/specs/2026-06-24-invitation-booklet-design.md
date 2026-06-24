# Invitation Booklet Template — Design Spec

**Date:** 2026-06-24  
**Template ID:** `invitation-booklet`  
**Position in registry:** 5th template

---

## Overview

A new Angular template that simulates the physical page-turning behaviour of a 2-sheet invitation booklet. The booklet has 4 distinct viewable sides (faces) and navigates linearly through 3 states: Cover → Spread → Back Cover. No looping; the user cannot advance past the Back Cover or retreat past the Cover.

---

## State Machine

### States

```
'cover' | 'spread' | 'back'
```

Initial state: `'cover'`

### Transitions

| Current state | Direction  | Result state |
|---------------|------------|--------------|
| `cover`       | forward    | `spread`     |
| `spread`      | forward    | `back`       |
| `back`        | forward    | no-op        |
| `cover`       | backward   | no-op        |
| `spread`      | backward   | `cover`      |
| `back`        | backward   | `spread`     |

### Angular signal

```typescript
state = signal<'cover' | 'spread' | 'back'>('cover');

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
```

---

## Layout & 3D CSS Architecture

### Fixed 2-page frame

The book container always occupies the full 2-page-wide frame. Two child `<div>` elements — `.ib-page-left` and `.ib-page-right` — sit side by side separated by a spine divider. The frame never changes width; in `cover` state the left half is visually empty (transparent), and in `back` state the right half is empty.

### Face assignments

Each page div has two faces (`.ib-face-front` and `.ib-face-back`) with `backface-visibility: hidden`.

| Element          | Front face (rotateY = 0°) | Back face              |
|------------------|---------------------------|------------------------|
| `.ib-page-left`  | Page 2 — left of spread   | Page 4 — Back Cover    |
| `.ib-page-right` | Page 1 — Cover            | Page 3 — right of spread |

### Per-state CSS transforms

| State    | `.ib-page-left`         | `.ib-page-right`        |
|----------|-------------------------|-------------------------|
| `cover`  | `rotateY(-90deg)` — edge-on, invisible | `rotateY(0deg)` — shows Cover |
| `spread` | `rotateY(0deg)` — shows Page 2 | `rotateY(-180deg)` — shows Page 3 |
| `back`   | `rotateY(180deg)` — shows Page 4 | `rotateY(-90deg)` — edge-on, invisible |

### CSS 3D setup

```css
.ib-scene {
  perspective: 1600px;
  perspective-origin: center center;
}

.ib-book {
  display: flex;
  transform-style: preserve-3d;
}

.ib-page {
  flex: 1;
  position: relative;
  transform-style: preserve-3d;
  transform-origin: center center;
  transition: transform 0.9s cubic-bezier(0.4, 0, 0.2, 1);
}

.ib-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
}

.ib-face-back {
  transform: rotateY(180deg);
}
```

### Rounded edges

```css
.ib-page-left  .ib-face { border-radius: 14px 0 0 14px; }
.ib-page-right .ib-face { border-radius: 0 14px 14px 0; }
```

### Pointer events

Hidden/edge-on faces receive `pointer-events: none` to prevent invisible click targets:

| State    | Disabled faces |
|----------|---------------|
| `cover`  | left front, left back, right back |
| `spread` | left back, right front |
| `back`   | right front, right back, left front |

### Transition duration & easing

`0.9s cubic-bezier(0.4, 0, 0.2, 1)` — matches wedding-book for visual consistency.

---

## Content Per Page

### Page 1 — Cover (right page, front face)

- Event title (large Playfair Display serif) — `event.title`
- Event date (smaller, elegant) — `event.event_date`
- Decorative gold CSS divider / ornament (no external image assets)
- Static italic subtitle: "You are cordially invited"
- Pulsing "tap to open →" hint (CSS keyframe animation, same style as wedding-book `wbPulse`)

### Page 2 — Left spread (left page, front face)

- Section heading: "When & Where"
- Formatted event date — `event.event_date`
- Venue / location name — `event.location_text`
- Google Maps hyperlink — rendered as `View on Google Maps →` anchor (only shown when `event.google_maps_url` is present)
- Notes / additional details — `event.notes` (only shown when present; scrollable container if content overflows)

### Page 3 — Right spread (right page, back face)

- Section heading: "Will you join us?"
- Guest name (personalised from `context.guest.name`)
- `RsvpButtonsComponent` (existing shared component)
- When `event.show_rsvp === false`: RSVP content replaced by a decorative CSS ornament and a static italic note — "Kindly note your attendance"

### Page 4 — Back Cover (left page, back face)

- Decorative full-bleed CSS gradient (ivory-gold, no external images)
- Static closing line: "With love ♡" (no dynamic host name — `host_name` is not available in `EventData`)
- No interactive elements — purely decorative

---

## Interaction Design

### Swipe gesture detection

Host element listens for `touchstart`/`touchend` (mobile) and `mousedown`/`mouseup` (desktop).

- Record start X on `touchstart`/`mousedown`
- On `touchend`/`mouseup`, compute `deltaX = endX - startX` and `deltaY`
- Fire navigation only when `|deltaX| ≥ 50px` AND `|deltaX| > |deltaY|` (horizontal intent, not vertical scroll)
- `deltaX < 0` (left swipe) → `navigate('forward')`
- `deltaX > 0` (right swipe) → `navigate('backward')`

### Tap zones

Two invisible overlay `<div>` elements span the full height of the book frame:

| Zone            | Width     | Cursor       | Action               | Disabled when     |
|-----------------|-----------|--------------|----------------------|-------------------|
| `.ib-tap-left`  | left 20%  | `w-resize`   | `navigate('backward')` | `state === 'cover'` |
| `.ib-tap-right` | right 20% | `e-resize`   | `navigate('forward')`  | `state === 'back'`  |

Middle 60% has no tap-navigation — normal content interaction (RSVP buttons, map link, scrolling) is uninterrupted.

### Chevron arrows

- Left `‹` — overlaid on `.ib-tap-left`, `opacity: 0` when `state === 'cover'`
- Right `›` — overlaid on `.ib-tap-right`, `opacity: 0` when `state === 'back'`
- Gold, semi-transparent, fade via CSS `opacity` transition

### Navigation dots

Three small dots at the bottom centre of the scene:

- Active dot: filled gold (`#c9a84c`)
- Inactive dots: outlined, muted gold
- Dot order left-to-right: Cover · Spread · Back

---

## Visual Style

Inherits the wedding-book ivory-gold aesthetic:

| Token              | Value                     |
|--------------------|---------------------------|
| Primary accent     | `#c9a84c` (gold)          |
| Text primary       | `#3a2e1e` (dark brown)    |
| Text secondary     | `#7a6a52` (muted brown)   |
| Page background    | `#fffdf8` / `#fffaf4`     |
| Scene background   | Warm beige gradient        |
| Font               | Playfair Display (Google Fonts) |
| Spine              | Gold gradient, subtle shadow |

---

## File Structure

```
tap-invite/src/app/features/templates/invitation-booklet/
├── invitation-booklet.manifest.ts
├── invitation-booklet.template.ts
└── invitation-booklet.template.css
```

Registration in `template-registry.ts` — appended after `weddingBookManifest`.

---

## Edge Cases & Constraints

- **No loop:** Silently ignore `navigate('forward')` at `back` and `navigate('backward')` at `cover`.
- **Vertical scroll:** Do not cancel `touchmove` / scroll events; only intercept confirmed horizontal swipes.
- **RSVP hidden:** When `show_rsvp` is `false`, Page 3 shows a decorative placeholder instead of RSVP buttons (keeps the spread balanced visually).
- **No external images:** All decorative elements use CSS gradients and Unicode ornaments only.
- **Responsive:** Mobile ≤ 600px fills full screen width; remove box shadows and border-radius at that breakpoint (consistent with wedding-book).
