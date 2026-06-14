# Toast Service Design

**Date:** 2026-06-14
**Status:** Approved

## Overview

Replace the locally-managed toast logic in `HostDashboardComponent` with a centralized, injectable `ToastService` usable from any component or service. Extends the existing custom `ToastComponent` (no Angular Material snackbar) to support four message types and inline confirmation toasts.

## Requirements

- Call `toast.success/error/info/warning(message)` from any component without boilerplate
- Call `await toast.confirm(message)` and get a `Promise<boolean>` without any modal/dialog
- Confirmation toast stays visible until the user clicks Confirm or Cancel
- Message toasts auto-dismiss after 3 seconds (default)
- Visual style stays fully custom — extends existing `ToastComponent` CSS

## Architecture

Three pieces:

### 1. `ToastService` (`src/app/core/services/toast/toast.service.ts`)

`providedIn: 'root'` — injectable anywhere.

```typescript
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'confirm';
  duration?: number;                  // undefined = no auto-dismiss
  resolve?: (value: boolean) => void; // only on confirm toasts
}
```

Public API:
- `toasts: Signal<Toast[]>` — readonly signal read by the component
- `success(message, duration?)` — adds success toast, auto-dismisses
- `error(message, duration?)` — adds error toast, auto-dismisses
- `info(message, duration?)` — adds info toast, auto-dismisses
- `warning(message, duration?)` — adds warning toast, auto-dismisses
- `confirm(message): Promise<boolean>` — adds confirm toast, no auto-dismiss; resolves when user clicks Confirm (`true`) or Cancel (`false`)
- `dismiss(id)` — removes toast by ID (also called internally)

Internals:
- Private `_toasts = signal<Toast[]>([])`
- Private `_counter = 0` for unique IDs
- Private `show(toast)` appends to signal
- Message methods call `show()` then `setTimeout(() => dismiss(id), duration ?? 3000)`
- `confirm()` creates a `new Promise<boolean>`, stores `resolve` on the toast, calls `show()` — no timeout

### 2. `ToastComponent` (updated — `src/app/shared/components/toast/`)

- Injects `ToastService`, reads `service.toasts` signal directly (no `@Input`)
- Template renders each toast; confirmation toasts (`type === 'confirm'`) show a button row
- Clicking Confirm calls `service.dismiss(toast.id)` after `toast.resolve(true)`
- Clicking Cancel calls `service.dismiss(toast.id)` after `toast.resolve(false)`
- `Toast` interface imported from `toast.service.ts` (not defined in the component)

### 3. Root placement (`src/app/app.ts`)

- `ToastComponent` added to `imports[]`
- `<app-toast />` placed once at the end of the root template
- Removed from `HostDashboardComponent` imports and template

## Styling

Existing `.toast-stack`, `.toast`, `.toast-icon`, `.toast-error`, `@keyframes slide-in` are preserved unchanged.

Additions to `toast.component.css`:

```css
/* info and warning icon variants */
.toast-info    .toast-icon { background: rgba(59,130,246,0.15); color: var(--color-info); }
.toast-warning .toast-icon { background: rgba(234,179,8,0.15);  color: var(--color-warning); }

/* confirmation action buttons */
.toast-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  pointer-events: all;
}
.btn-confirm {
  padding: 4px 14px;
  border-radius: 8px;
  border: none;
  background: var(--color-success);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel {
  padding: 4px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  font-size: 0.8rem;
  cursor: pointer;
}
```

The `.toast-stack` container keeps `pointer-events: none`; only `.toast-actions` opts back in.

## Migration of `HostDashboardComponent`

Remove:
- `toasts` signal
- `toastCounter` private field
- `showToast()` method
- `ToastComponent` from `imports[]` and template

Add:
- `private toast = inject(ToastService)`
- Replace all `this.showToast('...')` → `this.toast.success('...')`
- Replace all `this.showToast('...', 'error')` → `this.toast.error('...')`

## Usage Examples

```typescript
// Message toasts
this.toast.success('Guest added successfully!');
this.toast.error('Failed to send email.');
this.toast.info('Invitation link copied!');
this.toast.warning('You have unsaved changes.');

// Confirmation toast
const confirmed = await this.toast.confirm('Delete this guest?');
if (confirmed) {
  await this.deleteGuest(guestId);
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/app/core/services/toast/toast.service.ts` | **Create** — service + Toast interface |
| `src/app/shared/components/toast/toast.component.ts` | **Update** — inject service, remove @Input |
| `src/app/shared/components/toast/toast.component.html` | **Update** — add info/warning icons, confirm buttons |
| `src/app/shared/components/toast/toast.component.css` | **Update** — add info/warning/confirm styles |
| `src/app/app.ts` | **Update** — import ToastComponent, add `<app-toast />` |
| `src/app/features/host-dashboard/components/host-dashboard.component.ts` | **Update** — migrate to ToastService |
| `src/app/features/host-dashboard/components/host-dashboard.component.html` | **Update** — remove `<app-toast>` usage |
