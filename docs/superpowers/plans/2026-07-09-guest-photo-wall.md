# Collaborative Guest Photo & Video Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let guests upload photos (and, on premium events, short videos) from their existing invite link, have the host moderate uploads, show approved media in an in-app gallery and a public live "wall" slideshow, and gate video/higher caps/ZIP export behind a manually-toggled `is_premium` flag.

**Architecture:** A new core `EventMediaService` wraps all `event_media` table + `event-media` Storage bucket operations. A guest-facing `PhotoTabComponent` (upload + gallery) is added to the existing guest-view page. A host-facing `PhotoManagerComponent` (moderation queue + approved gallery + ZIP download) is added to the host dashboard. A new public `WallComponent` polls approved media for a slideshow. A daily Edge Function deletes expired media. The super admin panel gets a `Premium` toggle mirroring the existing `is_enabled` toggle.

**Tech Stack:** Angular 22 (standalone components, signals), @supabase/supabase-js 2.108.1, Supabase Storage + Postgres RLS, Deno Edge Functions, `jszip` (new dependency for client-side ZIP export).

## Global Constraints

- Free tier: photos only, max 30 per event, max 10MB each, no video.
- Premium tier (`events.is_premium = true`, settable only by super_admin): unlimited photos (10MB each), video allowed (max 50MB, max 60 seconds).
- Retention: free events auto-delete media 1 day after `event_date`; premium events auto-delete 14 days after `event_date`.
- Guests have no Supabase Auth session — all guest-side reads/writes rely on knowing the correct `eventId`/`guestId` (same trust model as the rest of this app), not on `auth.uid()`.
- Live wall access is via an unguessable `wall_token` on the event, no login.
- ZIP "download all" is premium-only.

---

## File Map

**Create:**
- `src/app/core/services/event-media/event-media.types.ts`
- `src/app/core/services/event-media/event-media.service.ts`
- `src/app/core/services/event-media/event-media.service.spec.ts`
- `src/app/features/guest-view/components/photo-tab/photo-tab.component.ts`
- `src/app/features/host-dashboard/components/photo-manager/photo-manager.component.ts`
- `src/app/features/host-dashboard/components/photo-manager/photo-manager.component.html`
- `src/app/features/host-dashboard/components/photo-manager/photo-manager.component.css`
- `src/app/features/wall/wall.component.ts`
- `supabase/functions/cleanup-expired-media/index.ts`

**Modify:**
- `src/app/features/templates/template.types.ts` (add `is_premium`, `wall_token` to `EventData`)
- `src/app/features/admin/admin.types.ts` (add `is_premium`, `wall_token` to `AdminEvent`)
- `src/app/features/admin/admin.service.ts` (add `togglePremium`)
- `src/app/features/admin/components/event-grid.component.ts` (add Premium toggle column)
- `src/app/features/guest-view/components/guest-view.component.ts` (import `PhotoTabComponent`)
- `src/app/features/guest-view/components/guest-view.component.html` (render `<app-photo-tab>`)
- `src/app/features/host-dashboard/components/host-dashboard.component.ts` (import `PhotoManagerComponent`)
- `src/app/features/host-dashboard/components/host-dashboard.component.html` (render `<app-photo-manager>`)
- `src/app/app.routes.ts` (register `/wall/:eventId/:wallToken`)
- `package.json` (add `jszip`)

**Task order note:** Schema (Task 1) and type updates (Task 2) come first since every later task depends on the new columns/types. The service (Tasks 3–4) is built and tested before any component consumes it. Guest-side (Tasks 5–6) and host-side (Tasks 7–8) can be done in either order relative to each other. Admin toggle (Task 9) can happen any time after Task 2. The wall (Task 10) and cleanup function (Task 11) depend only on the service/schema. Task 12 is a full manual pass, done last.

---

### Task 1: Database Schema (manual SQL)

**Note:** All steps run in the Supabase SQL editor — not via code.

- [ ] **Step 1: Add `is_premium` and `wall_token` to `events`**

```sql
ALTER TABLE public.events ADD COLUMN is_premium boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN wall_token uuid NOT NULL DEFAULT gen_random_uuid();
```

- [ ] **Step 2: Create the `event_media` table**

```sql
CREATE TYPE media_type AS ENUM ('photo', 'video');
CREATE TYPE media_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.event_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id     uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  media_type   media_type NOT NULL,
  storage_path text NOT NULL,
  caption      text,
  status       media_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_media_event_id_idx ON public.event_media(event_id);
```

- [ ] **Step 3: Enable RLS and add `event_media` policies**

```sql
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

-- Any caller can insert a media row, as long as guest_id truly belongs to event_id
-- (mirrors this app's existing trust model — no guest auth session exists)
CREATE POLICY "guest_insert_own_event_media"
  ON public.event_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.id = guest_id AND g.event_id = event_id
    )
  );

-- Anyone can read approved media (guest gallery + public wall)
CREATE POLICY "public_select_approved_media"
  ON public.event_media FOR SELECT
  USING (status = 'approved');

-- The event's host can read all media for their own event, including pending
CREATE POLICY "host_select_own_event_media"
  ON public.event_media FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
  );

-- Only the host can approve (update status)
CREATE POLICY "host_update_own_event_media"
  ON public.event_media FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
  );

-- Only the host can reject/delete
CREATE POLICY "host_delete_own_event_media"
  ON public.event_media FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid())
  );
```

- [ ] **Step 4: Restrict `is_premium` changes to super_admin**

```sql
CREATE POLICY "super_admin_update_event_premium"
  ON public.events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );
```

- [ ] **Step 5: Create the `event-media` Storage bucket**

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('event-media', 'event-media', false, 52428800)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 6: Add Storage RLS policies**

Objects are keyed `events/{eventId}/{guestId}/{uuid}.{ext}` — `storage.foldername(name)` returns `['events', '{eventId}', '{guestId}']`, 1-indexed.

```sql
CREATE POLICY "guest_insert_event_media_objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-media' AND
    EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.event_id::text = (storage.foldername(name))[2]
        AND g.id::text = (storage.foldername(name))[3]
    )
  );

CREATE POLICY "public_select_approved_media_objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'event-media' AND
    EXISTS (
      SELECT 1 FROM public.event_media m
      WHERE m.storage_path = name AND m.status = 'approved'
    )
  );

CREATE POLICY "host_select_own_media_objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'event-media' AND
    EXISTS (
      SELECT 1 FROM public.event_media m
      JOIN public.events e ON e.id = m.event_id
      WHERE m.storage_path = name AND e.host_id = auth.uid()
    )
  );

CREATE POLICY "host_delete_media_objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-media' AND
    EXISTS (
      SELECT 1 FROM public.event_media m
      JOIN public.events e ON e.id = m.event_id
      WHERE m.storage_path = name AND e.host_id = auth.uid()
    )
  );
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-07-09-guest-photo-wall-design.md docs/superpowers/plans/2026-07-09-guest-photo-wall.md
git commit -m "chore: guest photo wall schema applied in Supabase — event_media table, is_premium/wall_token, storage bucket + RLS"
```

---

### Task 2: Extend `EventData` & `AdminEvent` Types

**Files:**
- Modify: `src/app/features/templates/template.types.ts`
- Modify: `src/app/features/admin/admin.types.ts`

**Interfaces:**
- Produces: `EventData.is_premium: boolean`, `EventData.wall_token: string`, `AdminEvent.is_premium: boolean`, `AdminEvent.wall_token: string` — used by every later task.

- [ ] **Step 1: Update `EventData`**

In `src/app/features/templates/template.types.ts`, replace the `EventData` interface:

```typescript
export interface EventData {
  id: string;
  host_id: string;
  title: string;
  event_date: string;
  location_text: string;
  template_id: string;
  google_maps_url?: string | null;
  is_premium: boolean;
  wall_token: string;
}
```

- [ ] **Step 2: Update `AdminEvent`**

In `src/app/features/admin/admin.types.ts`, replace the `AdminEvent` interface:

```typescript
export interface AdminEvent {
  id: string;
  title: string;
  event_date: string;
  location_text: string;
  google_maps_url: string | null;
  is_enabled: boolean;
  is_premium: boolean;
  wall_token: string;
  host_id: string;
  created_at: string;
  hostEmail: string;
  computedStatus: EventStatus;
}
```

- [ ] **Step 3: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/templates/template.types.ts src/app/features/admin/admin.types.ts
git commit -m "feat: add is_premium and wall_token to EventData and AdminEvent types"
```

---

### Task 3: Event Media Types & Validation Helpers

**Files:**
- Create: `src/app/core/services/event-media/event-media.types.ts`
- Test: `src/app/core/services/event-media/event-media.service.spec.ts` (validation portion)

**Interfaces:**
- Produces: `MediaType`, `MediaStatus`, `EventMedia`, `EventMediaWithUrl`, `validateMediaFile(file, isPremium)`, constants `FREE_PHOTO_CAP`, `PHOTO_MAX_BYTES`, `VIDEO_MAX_BYTES`, `VIDEO_MAX_DURATION_SECONDS` — consumed by `EventMediaService` (Task 4) and both UI components (Tasks 5, 7).

- [ ] **Step 1: Write the failing tests for `validateMediaFile`**

Create `src/app/core/services/event-media/event-media.service.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateMediaFile, PHOTO_MAX_BYTES, VIDEO_MAX_BYTES } from './event-media.types';

function makeFile(type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], 'test-file', { type });
}

describe('validateMediaFile', () => {
  it('rejects video when isPremium is false', () => {
    const file = makeFile('video/mp4', 1024);
    const result = validateMediaFile(file, false);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('premium');
  });

  it('accepts video when isPremium is true and within size', () => {
    const file = makeFile('video/mp4', 1024);
    const result = validateMediaFile(file, true);
    expect(result.valid).toBe(true);
  });

  it('rejects video over the size cap even when premium', () => {
    const file = makeFile('video/mp4', VIDEO_MAX_BYTES + 1);
    const result = validateMediaFile(file, true);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('50MB');
  });

  it('rejects an unsupported video format', () => {
    const file = makeFile('video/avi', 1024);
    const result = validateMediaFile(file, true);
    expect(result.valid).toBe(false);
  });

  it('accepts a valid photo regardless of tier', () => {
    const file = makeFile('image/jpeg', 1024);
    expect(validateMediaFile(file, false).valid).toBe(true);
    expect(validateMediaFile(file, true).valid).toBe(true);
  });

  it('rejects a photo over the size cap', () => {
    const file = makeFile('image/jpeg', PHOTO_MAX_BYTES + 1);
    const result = validateMediaFile(file, false);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('10MB');
  });

  it('rejects an unsupported photo format', () => {
    const file = makeFile('image/gif', 1024);
    const result = validateMediaFile(file, false);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/app/core/services/event-media/event-media.service.spec.ts
```

Expected: FAIL — `Cannot find module './event-media.types'` (file doesn't exist yet).

- [ ] **Step 3: Create the types and validation implementation**

Create `src/app/core/services/event-media/event-media.types.ts`:

```typescript
export type MediaType = 'photo' | 'video';
export type MediaStatus = 'pending' | 'approved' | 'rejected';

export interface EventMedia {
  id: string;
  event_id: string;
  guest_id: string;
  media_type: MediaType;
  storage_path: string;
  caption: string | null;
  status: MediaStatus;
  created_at: string;
}

export interface EventMediaWithUrl extends EventMedia {
  url: string;
  guestName: string;
}

export const FREE_PHOTO_CAP = 30;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_MAX_DURATION_SECONDS = 60;

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export type MediaValidationResult = { valid: true } | { valid: false; error: string };

export function validateMediaFile(file: File, isPremium: boolean): MediaValidationResult {
  const isVideo = file.type.startsWith('video/');

  if (isVideo) {
    if (!isPremium) {
      return { valid: false, error: 'Video uploads are only available for premium events.' };
    }
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return { valid: false, error: 'Unsupported video format.' };
    }
    if (file.size > VIDEO_MAX_BYTES) {
      return { valid: false, error: 'Video must be 50MB or smaller.' };
    }
    return { valid: true };
  }

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { valid: false, error: 'Unsupported photo format.' };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { valid: false, error: 'Photo must be 10MB or smaller.' };
  }
  return { valid: true };
}

export function getVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject(new Error('Could not read video metadata.'));
    video.src = URL.createObjectURL(file);
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/app/core/services/event-media/event-media.service.spec.ts
```

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/event-media/event-media.types.ts src/app/core/services/event-media/event-media.service.spec.ts
git commit -m "feat: add event media types and validateMediaFile with tests"
```

---

### Task 4: EventMediaService

**Files:**
- Create: `src/app/core/services/event-media/event-media.service.ts`
- Test: `src/app/core/services/event-media/event-media.service.spec.ts` (append to existing file)

**Interfaces:**
- Consumes: `validateMediaFile`, `getVideoDurationSeconds`, `FREE_PHOTO_CAP`, `VIDEO_MAX_DURATION_SECONDS` from Task 3; `Supabase.client` from `src/app/core/services/supabase/supabase.ts`.
- Produces: `EventMediaService` with methods `getMediaCount`, `getApprovedMedia`, `getPendingMedia`, `uploadMedia`, `approveMedia`, `deleteMedia`, `getEventForWall` — consumed by `PhotoTabComponent` (Task 5), `PhotoManagerComponent` (Task 7), `WallComponent` (Task 10).

- [ ] **Step 1: Write the failing tests for cap-enforcement logic**

Append to `src/app/core/services/event-media/event-media.service.spec.ts` (add these imports at the top alongside the existing ones, and add the new `describe` block at the end of the file):

```typescript
// add to the top imports:
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EventMediaService } from './event-media.service';
import { Supabase } from '../supabase/supabase';
import { APP_ENV } from '../../tokens/app-env';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

describe('EventMediaService', () => {
  let service: EventMediaService;
  let supabase: Supabase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENV, useValue: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' } },
      ],
    });
    service = TestBed.inject(EventMediaService);
    supabase = TestBed.inject(Supabase);
  });

  describe('uploadMedia', () => {
    it('throws and never uploads when the free-tier photo cap is reached', async () => {
      const file = new File([new Uint8Array(1024)], 'photo.jpg', { type: 'image/jpeg' });
      vi.spyOn(service, 'getMediaCount').mockResolvedValue(30);
      const uploadSpy = vi.spyOn(supabase.client.storage.from('event-media'), 'upload');

      await expect(service.uploadMedia('evt-1', 'guest-1', file, false)).rejects.toThrow(/free photo limit/);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('rejects a video on a non-premium event before touching storage', async () => {
      const file = new File([new Uint8Array(1024)], 'clip.mp4', { type: 'video/mp4' });
      const uploadSpy = vi.spyOn(supabase.client.storage.from('event-media'), 'upload');

      await expect(service.uploadMedia('evt-1', 'guest-1', file, false)).rejects.toThrow(/premium/);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('uploads and inserts when validation and cap checks pass', async () => {
      const file = new File([new Uint8Array(1024)], 'photo.jpg', { type: 'image/jpeg' });
      vi.spyOn(service, 'getMediaCount').mockResolvedValue(5);

      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase.client, 'storage', 'get').mockReturnValue({
        from: vi.fn(() => ({ upload: mockUpload })),
      } as any);
      vi.spyOn(supabase.client, 'from').mockImplementation((table: string) => {
        if (table === 'event_media') return { insert: mockInsert } as any;
        return {} as any;
      });

      await service.uploadMedia('evt-1', 'guest-1', file, false);

      expect(mockUpload).toHaveBeenCalledOnce();
      expect(mockInsert).toHaveBeenCalledOnce();
      const insertedRow = mockInsert.mock.calls[0][0][0];
      expect(insertedRow.event_id).toBe('evt-1');
      expect(insertedRow.guest_id).toBe('guest-1');
      expect(insertedRow.media_type).toBe('photo');
    });
  });

  describe('getMediaCount', () => {
    it('returns the count from the query result', async () => {
      const mockNeq = vi.fn().mockResolvedValue({ data: [], error: null, count: 12 });
      const mockEq2 = vi.fn().mockReturnValue({ neq: mockNeq });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      vi.spyOn(supabase.client, 'from').mockReturnValue({ select: mockSelect } as any);

      const result = await service.getMediaCount('evt-1', 'photo');
      expect(result).toBe(12);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/app/core/services/event-media/event-media.service.spec.ts
```

Expected: FAIL — `Cannot find module './event-media.service'` (file doesn't exist yet).

- [ ] **Step 3: Create the service**

Create `src/app/core/services/event-media/event-media.service.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import { Supabase } from '../supabase/supabase';
import {
  EventMedia,
  EventMediaWithUrl,
  MediaType,
  FREE_PHOTO_CAP,
  VIDEO_MAX_DURATION_SECONDS,
  validateMediaFile,
  getVideoDurationSeconds,
} from './event-media.types';

@Injectable({ providedIn: 'root' })
export class EventMediaService {
  private supabase = inject(Supabase);

  async getMediaCount(eventId: string, mediaType: MediaType): Promise<number> {
    const { count, error } = await this.supabase.client
      .from('event_media')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('media_type', mediaType)
      .neq('status', 'rejected');
    if (error) throw error;
    return count ?? 0;
  }

  async uploadMedia(eventId: string, guestId: string, file: File, isPremium: boolean, caption?: string): Promise<void> {
    const validation = validateMediaFile(file, isPremium);
    if (!validation.valid) throw new Error(validation.error);

    const mediaType: MediaType = file.type.startsWith('video/') ? 'video' : 'photo';

    if (mediaType === 'video') {
      const duration = await getVideoDurationSeconds(file);
      if (duration > VIDEO_MAX_DURATION_SECONDS) {
        throw new Error('Video must be 60 seconds or shorter.');
      }
    } else if (!isPremium) {
      const count = await this.getMediaCount(eventId, 'photo');
      if (count >= FREE_PHOTO_CAP) {
        throw new Error(`This event has reached its free photo limit (${FREE_PHOTO_CAP}). Ask the host to unlock more.`);
      }
    }

    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `events/${eventId}/${guestId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await this.supabase.client
      .storage.from('event-media')
      .upload(storagePath, file, { contentType: file.type });
    if (uploadError) throw uploadError;

    const { error: insertError } = await this.supabase.client
      .from('event_media')
      .insert([{
        event_id: eventId,
        guest_id: guestId,
        media_type: mediaType,
        storage_path: storagePath,
        caption: caption || null,
      }]);
    if (insertError) throw insertError;
  }

  async getApprovedMedia(eventId: string): Promise<EventMediaWithUrl[]> {
    const { data, error } = await this.supabase.client
      .from('event_media')
      .select('*, guests(display_name)')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return this.attachSignedUrls((data ?? []) as unknown as Array<EventMedia & { guests: { display_name: string } | null }>);
  }

  async getPendingMedia(eventId: string): Promise<EventMediaWithUrl[]> {
    const { data, error } = await this.supabase.client
      .from('event_media')
      .select('*, guests(display_name)')
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return this.attachSignedUrls((data ?? []) as unknown as Array<EventMedia & { guests: { display_name: string } | null }>);
  }

  async approveMedia(mediaId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('event_media').update({ status: 'approved' }).eq('id', mediaId);
    if (error) throw error;
  }

  async deleteMedia(mediaId: string, storagePath: string): Promise<void> {
    const { error: storageError } = await this.supabase.client
      .storage.from('event-media').remove([storagePath]);
    if (storageError) throw storageError;
    const { error: dbError } = await this.supabase.client
      .from('event_media').delete().eq('id', mediaId);
    if (dbError) throw dbError;
  }

  async getEventForWall(eventId: string, wallToken: string): Promise<{ title: string } | null> {
    const { data, error } = await this.supabase.client
      .from('events')
      .select('title, wall_token')
      .eq('id', eventId)
      .eq('wall_token', wallToken)
      .maybeSingle();
    if (error || !data) return null;
    return { title: (data as { title: string }).title };
  }

  private async attachSignedUrls(
    rows: Array<EventMedia & { guests: { display_name: string } | null }>
  ): Promise<EventMediaWithUrl[]> {
    if (rows.length === 0) return [];
    const paths = rows.map(r => r.storage_path);
    const { data, error } = await this.supabase.client
      .storage.from('event-media')
      .createSignedUrls(paths, 3600);
    if (error) throw error;
    const urlMap = new Map<string, string>(
      (data ?? []).map((d: { path: string | null; signedUrl: string }) => [d.path ?? '', d.signedUrl])
    );
    return rows.map(r => ({
      ...r,
      guestName: r.guests?.display_name ?? 'Guest',
      url: urlMap.get(r.storage_path) ?? '',
    }));
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/app/core/services/event-media/event-media.service.spec.ts
```

Expected: PASS — all tests green.

- [ ] **Step 5: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/event-media/event-media.service.ts src/app/core/services/event-media/event-media.service.spec.ts
git commit -m "feat: add EventMediaService with upload/moderation/wall/download methods"
```

---

### Task 5: Guest Photo Tab Component

**Files:**
- Create: `src/app/features/guest-view/components/photo-tab/photo-tab.component.ts`

**Interfaces:**
- Consumes: `EventMediaService.getApprovedMedia`, `EventMediaService.uploadMedia` (Task 4); `EventMediaWithUrl` (Task 3).
- Produces: `PhotoTabComponent` with `@Input() eventId`, `@Input() guestId`, `@Input() isPremium` — consumed by `GuestViewComponent` (Task 6).

- [ ] **Step 1: Create the component**

```typescript
// src/app/features/guest-view/components/photo-tab/photo-tab.component.ts
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventMediaService } from '../../../../core/services/event-media/event-media.service';
import { EventMediaWithUrl } from '../../../../core/services/event-media/event-media.types';

interface PendingPreview {
  id: string;
  previewUrl: string;
  mediaType: 'photo' | 'video';
}

@Component({
  selector: 'app-photo-tab',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="photo-tab">
      <h2 class="photo-tab__title">📸 Shared Photos</h2>
      <p class="photo-tab__sub">Add your photos{{ isPremium ? ' or a short video' : '' }} for everyone to see.</p>

      <div class="upload-row">
        <label class="upload-btn">
          {{ isUploading() ? 'Uploading…' : ('+ Add Photo' + (isPremium ? '/Video' : '')) }}
          <input
            type="file"
            [accept]="acceptTypes"
            (change)="onFileSelected($event)"
            [disabled]="isUploading()"
            hidden
          />
        </label>
      </div>

      @if (uploadError()) {
        <p class="upload-error">{{ uploadError() }}</p>
      }

      @if (isLoading()) {
        <p class="hint-text">Loading photos…</p>
      } @else if (approvedMedia().length === 0 && myPendingUploads().length === 0) {
        <p class="hint-text">No photos yet — be the first to share one!</p>
      } @else {
        <div class="gallery-grid">
          @for (item of myPendingUploads(); track item.id) {
            <div class="gallery-item gallery-item--pending">
              @if (item.mediaType === 'video') {
                <video [src]="item.previewUrl" muted></video>
              } @else {
                <img [src]="item.previewUrl" alt="Pending upload" />
              }
              <span class="pending-badge">Waiting for host approval</span>
            </div>
          }
          @for (item of approvedMedia(); track item.id) {
            <div class="gallery-item">
              @if (item.media_type === 'video') {
                <video [src]="item.url" controls></video>
              } @else {
                <img [src]="item.url" [alt]="item.caption || 'Guest photo'" />
              }
              <span class="gallery-item__by">{{ item.guestName }}</span>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .photo-tab { padding: 20px; }
    .photo-tab__title { font-size: 1.1rem; font-weight: 700; margin: 0 0 4px; }
    .photo-tab__sub { font-size: 0.85rem; color: #64748b; margin: 0 0 16px; }
    .upload-row { margin-bottom: 12px; }
    .upload-btn { display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
    .upload-error { color: #dc2626; font-size: 0.8125rem; margin: 0 0 12px; }
    .hint-text { color: #64748b; font-size: 0.875rem; }
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .gallery-item { position: relative; border-radius: 10px; overflow: hidden; background: #f1f5f9; aspect-ratio: 1; }
    .gallery-item img, .gallery-item video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .gallery-item--pending { opacity: 0.5; }
    .pending-badge { position: absolute; bottom: 4px; left: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; font-size: 0.65rem; padding: 3px 6px; border-radius: 4px; text-align: center; }
    .gallery-item__by { position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.55); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; }
  `]
})
export class PhotoTabComponent implements OnInit {
  @Input({ required: true }) eventId!: string;
  @Input({ required: true }) guestId!: string;
  @Input({ required: true }) isPremium = false;

  private eventMediaService = inject(EventMediaService);

  isLoading = signal(true);
  isUploading = signal(false);
  uploadError = signal<string | null>(null);
  approvedMedia = signal<EventMediaWithUrl[]>([]);
  myPendingUploads = signal<PendingPreview[]>([]);

  get acceptTypes(): string {
    return this.isPremium
      ? 'image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime,video/webm'
      : 'image/jpeg,image/png,image/heic,image/webp';
  }

  async ngOnInit() {
    await this.loadApprovedMedia();
  }

  async loadApprovedMedia() {
    try {
      this.isLoading.set(true);
      this.approvedMedia.set(await this.eventMediaService.getApprovedMedia(this.eventId));
    } finally {
      this.isLoading.set(false);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set(null);
    this.isUploading.set(true);
    const previewUrl = URL.createObjectURL(file);
    const mediaType: 'photo' | 'video' = file.type.startsWith('video/') ? 'video' : 'photo';

    try {
      await this.eventMediaService.uploadMedia(this.eventId, this.guestId, file, this.isPremium);
      this.myPendingUploads.update(items => [
        { id: crypto.randomUUID(), previewUrl, mediaType },
        ...items,
      ]);
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Failed to upload. Please try again.');
      URL.revokeObjectURL(previewUrl);
    } finally {
      this.isUploading.set(false);
    }
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/guest-view/components/photo-tab/photo-tab.component.ts
git commit -m "feat: add guest PhotoTab component — upload and browse shared album"
```

---

### Task 6: Wire Photo Tab into Guest View

**Files:**
- Modify: `src/app/features/guest-view/components/guest-view.component.ts`
- Modify: `src/app/features/guest-view/components/guest-view.component.html`

**Interfaces:**
- Consumes: `PhotoTabComponent` (Task 5); `eventId()`, `guestId()`, `eventData()` signals already on `GuestViewComponent`.

- [ ] **Step 1: Import `PhotoTabComponent`**

In `guest-view.component.ts`, update the imports:

```typescript
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Supabase } from '../../../core/services/supabase/supabase';
import { RsvpStatus } from './rsvp-buttons/rsvp-buttons.component';
import { EventData, GuestData, TemplateContext } from '../../templates/template.types';
import { TemplateRendererComponent } from '../../templates/components/template-renderer/template-renderer.component';
import { PhotoTabComponent } from './photo-tab/photo-tab.component';

@Component({
  selector: 'app-guest-view',
  standalone: true,
  imports: [CommonModule, RouterModule, TemplateRendererComponent, PhotoTabComponent],
  templateUrl: './guest-view.component.html',
  styleUrls: ['./guest-view.component.css']
})
```

Leave the rest of the class body unchanged.

- [ ] **Step 2: Render the photo tab below the template**

Replace the final `@else if` block in `guest-view.component.html`:

```html
  @else if (templateContext()) {
    <app-template-renderer [context]="templateContext()!"></app-template-renderer>
    <app-photo-tab
      [eventId]="eventId()!"
      [guestId]="guestId()!"
      [isPremium]="eventData()!.is_premium">
    </app-photo-tab>
  }
```

- [ ] **Step 3: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/guest-view/components/guest-view.component.ts src/app/features/guest-view/components/guest-view.component.html
git commit -m "feat: render PhotoTab on the guest invitation page"
```

---

### Task 7: Host Photo Manager Component

**Files:**
- Create: `src/app/features/host-dashboard/components/photo-manager/photo-manager.component.ts`
- Create: `src/app/features/host-dashboard/components/photo-manager/photo-manager.component.html`
- Create: `src/app/features/host-dashboard/components/photo-manager/photo-manager.component.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: `EventMediaService.getPendingMedia`, `getApprovedMedia`, `approveMedia`, `deleteMedia` (Task 4); `ToastService.success`/`error` (existing).
- Produces: `PhotoManagerComponent` with `@Input() eventId`, `@Input() isPremium` — consumed by `HostDashboardComponent` (Task 8).

- [ ] **Step 1: Add the `jszip` dependency**

```bash
npm install jszip
```

Expected: `package.json` gains a `jszip` entry under `dependencies`.

- [ ] **Step 2: Create the component class**

```typescript
// src/app/features/host-dashboard/components/photo-manager/photo-manager.component.ts
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import JSZip from 'jszip';
import { EventMediaService } from '../../../../core/services/event-media/event-media.service';
import { EventMediaWithUrl } from '../../../../core/services/event-media/event-media.types';
import { ToastService } from '../../../../core/services/toast/toast.service';

@Component({
  selector: 'app-photo-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-manager.component.html',
  styleUrls: ['./photo-manager.component.css']
})
export class PhotoManagerComponent implements OnInit {
  @Input({ required: true }) eventId!: string;
  @Input({ required: true }) isPremium = false;

  private eventMediaService = inject(EventMediaService);
  private toast = inject(ToastService);

  isLoading = signal(true);
  pendingMedia = signal<EventMediaWithUrl[]>([]);
  approvedMedia = signal<EventMediaWithUrl[]>([]);
  isZipping = signal(false);

  async ngOnInit() {
    await this.loadMedia();
  }

  async loadMedia() {
    try {
      this.isLoading.set(true);
      const [pending, approved] = await Promise.all([
        this.eventMediaService.getPendingMedia(this.eventId),
        this.eventMediaService.getApprovedMedia(this.eventId),
      ]);
      this.pendingMedia.set(pending);
      this.approvedMedia.set(approved);
    } catch {
      this.toast.error('Failed to load photos.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async approve(item: EventMediaWithUrl) {
    try {
      await this.eventMediaService.approveMedia(item.id);
      this.pendingMedia.update(items => items.filter(i => i.id !== item.id));
      this.approvedMedia.update(items => [item, ...items]);
      this.toast.success('Photo approved.');
    } catch {
      this.toast.error('Failed to approve photo.');
    }
  }

  async reject(item: EventMediaWithUrl) {
    try {
      await this.eventMediaService.deleteMedia(item.id, item.storage_path);
      this.pendingMedia.update(items => items.filter(i => i.id !== item.id));
      this.toast.success('Photo rejected.');
    } catch {
      this.toast.error('Failed to reject photo.');
    }
  }

  async remove(item: EventMediaWithUrl) {
    try {
      await this.eventMediaService.deleteMedia(item.id, item.storage_path);
      this.approvedMedia.update(items => items.filter(i => i.id !== item.id));
      this.toast.success('Photo removed.');
    } catch {
      this.toast.error('Failed to remove photo.');
    }
  }

  async downloadAll() {
    if (!this.isPremium || this.approvedMedia().length === 0) return;
    this.isZipping.set(true);
    try {
      const zip = new JSZip();
      for (const item of this.approvedMedia()) {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const filename = item.storage_path.split('/').pop() ?? item.id;
        zip.file(filename, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'event-photos.zip';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      this.toast.error('Failed to build the download. Please try again.');
    } finally {
      this.isZipping.set(false);
    }
  }
}
```

- [ ] **Step 3: Create the template**

```html
<!-- src/app/features/host-dashboard/components/photo-manager/photo-manager.component.html -->
<section class="photo-manager">
  <div class="photo-manager__header">
    <h2 class="section-title">📸 Guest Photos</h2>
    @if (isPremium) {
      <button
        class="btn-download"
        [disabled]="isZipping() || approvedMedia().length === 0"
        (click)="downloadAll()">
        {{ isZipping() ? 'Preparing ZIP…' : '⬇ Download All' }}
      </button>
    }
  </div>

  @if (isLoading()) {
    <p class="hint-text">Loading photos…</p>
  } @else {
    @if (pendingMedia().length > 0) {
      <div class="photo-section">
        <h3 class="photo-section__title">Pending Approval ({{ pendingMedia().length }})</h3>
        <div class="photo-grid">
          @for (item of pendingMedia(); track item.id) {
            <div class="photo-card">
              @if (item.media_type === 'video') {
                <video [src]="item.url" controls></video>
              } @else {
                <img [src]="item.url" [alt]="item.caption || 'Pending photo'" />
              }
              <span class="photo-card__by">{{ item.guestName }}</span>
              <div class="photo-card__actions">
                <button class="btn-approve" (click)="approve(item)">✓ Approve</button>
                <button class="btn-reject" (click)="reject(item)">✕ Reject</button>
              </div>
            </div>
          }
        </div>
      </div>
    }

    <div class="photo-section">
      <h3 class="photo-section__title">Approved ({{ approvedMedia().length }})</h3>
      @if (approvedMedia().length === 0) {
        <p class="hint-text">No approved photos yet.</p>
      } @else {
        <div class="photo-grid">
          @for (item of approvedMedia(); track item.id) {
            <div class="photo-card">
              @if (item.media_type === 'video') {
                <video [src]="item.url" controls></video>
              } @else {
                <img [src]="item.url" [alt]="item.caption || 'Guest photo'" />
              }
              <span class="photo-card__by">{{ item.guestName }}</span>
              <div class="photo-card__actions">
                <button class="btn-reject" (click)="remove(item)">🗑 Remove</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  }
</section>
```

- [ ] **Step 4: Create the styles**

```css
/* src/app/features/host-dashboard/components/photo-manager/photo-manager.component.css */
.photo-manager { background: white; border-radius: 12px; padding: 20px; margin-top: 20px; }
.photo-manager__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-title { font-size: 1rem; font-weight: 700; margin: 0; }
.btn-download { background: #7c3aed; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
.btn-download:disabled { background: #cbd5e1; cursor: not-allowed; }
.hint-text { color: #64748b; font-size: 0.875rem; }
.photo-section { margin-bottom: 20px; }
.photo-section__title { font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 10px; }
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.photo-card { position: relative; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #f8fafc; }
.photo-card img, .photo-card video { width: 100%; height: 140px; object-fit: cover; display: block; }
.photo-card__by { display: block; font-size: 0.7rem; color: #64748b; padding: 4px 8px; }
.photo-card__actions { display: flex; gap: 6px; padding: 0 8px 8px; }
.btn-approve { flex: 1; background: #16a34a; color: white; border: none; padding: 5px; border-radius: 5px; font-size: 0.75rem; cursor: pointer; }
.btn-reject { flex: 1; background: #dc2626; color: white; border: none; padding: 5px; border-radius: 5px; font-size: 0.75rem; cursor: pointer; }
```

- [ ] **Step 5: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/features/host-dashboard/components/photo-manager/
git commit -m "feat: add host PhotoManager — moderation queue, approved gallery, ZIP download"
```

---

### Task 8: Wire Photo Manager into Host Dashboard

**Files:**
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.ts`
- Modify: `src/app/features/host-dashboard/components/host-dashboard.component.html`

**Interfaces:**
- Consumes: `PhotoManagerComponent` (Task 7); `activeEvent()` signal already on `HostDashboardComponent`.

- [ ] **Step 1: Import `PhotoManagerComponent`**

In `host-dashboard.component.ts`, add the import and register it:

```typescript
import { PhotoManagerComponent } from './photo-manager/photo-manager.component';
```

Add `PhotoManagerComponent` to the `imports` array in the `@Component` decorator, alongside `TemplateGalleryComponent`.

- [ ] **Step 2: Render it below the dashboard grid**

In `host-dashboard.component.html`, add this immediately after the closing `</div>` of `.dash-grid` (still inside the `@else` block):

```html
    <app-photo-manager
      [eventId]="activeEvent().id"
      [isPremium]="activeEvent().is_premium">
    </app-photo-manager>
```

- [ ] **Step 3: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/host-dashboard/components/host-dashboard.component.ts src/app/features/host-dashboard/components/host-dashboard.component.html
git commit -m "feat: render PhotoManager on the host dashboard"
```

---

### Task 9: Admin Premium Toggle

**Files:**
- Modify: `src/app/features/admin/admin.service.ts`
- Modify: `src/app/features/admin/components/event-grid.component.ts`

**Interfaces:**
- Consumes: `AdminEvent.is_premium` (Task 2).
- Produces: `AdminService.togglePremium(id, is_premium)`.

- [ ] **Step 1: Add `togglePremium` to `AdminService`**

In `admin.service.ts`, add this method immediately after `toggleEventEnabled`:

```typescript
  async togglePremium(id: string, is_premium: boolean): Promise<void> {
    const { error } = await this.supabase.client
      .from('events').update({ is_premium }).eq('id', id);
    if (error) throw error;
  }
```

- [ ] **Step 2: Add the Premium column to the events table header**

In `event-grid.component.ts`, replace this line in the `<thead>`:

```html
                <th>Enabled</th>
```

with:

```html
                <th>Enabled</th>
                <th>Premium</th>
```

- [ ] **Step 3: Add the Premium toggle cell**

Replace this block in the `<tbody>` row:

```html
                  <td>
                    <button
                      class="toggle-pill"
                      [class.toggle-pill--on]="event.is_enabled"
                      (click)="toggleEnabled(event)"
                    >{{ event.is_enabled ? 'ON' : 'OFF' }}</button>
                  </td>
```

with:

```html
                  <td>
                    <button
                      class="toggle-pill"
                      [class.toggle-pill--on]="event.is_enabled"
                      (click)="toggleEnabled(event)"
                    >{{ event.is_enabled ? 'ON' : 'OFF' }}</button>
                  </td>
                  <td>
                    <button
                      class="toggle-pill"
                      [class.toggle-pill--on]="event.is_premium"
                      (click)="togglePremium(event)"
                    >{{ event.is_premium ? 'ON' : 'OFF' }}</button>
                  </td>
```

- [ ] **Step 4: Add the `togglePremium` method**

In the `EventGridComponent` class, add this method immediately after `toggleEnabled`:

```typescript
  async togglePremium(event: AdminEvent) {
    const newValue = !event.is_premium;
    try {
      await this.adminService.togglePremium(event.id, newValue);
      this.allEvents.update(events =>
        events.map(e => e.id === event.id ? { ...e, is_premium: newValue } : e)
      );
    } catch {
      this.toast.error('Failed to update premium status.');
    }
  }
```

- [ ] **Step 5: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/admin/admin.service.ts src/app/features/admin/components/event-grid.component.ts
git commit -m "feat: add super-admin Premium toggle for events"
```

---

### Task 10: Live Wall Component + Route

**Files:**
- Create: `src/app/features/wall/wall.component.ts`
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `EventMediaService.getEventForWall`, `getApprovedMedia` (Task 4).

- [ ] **Step 1: Create the component**

```typescript
// src/app/features/wall/wall.component.ts
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { EventMediaService } from '../../core/services/event-media/event-media.service';
import { EventMediaWithUrl } from '../../core/services/event-media/event-media.types';

@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="wall-page">
      @if (isLoading()) {
        <p class="wall-status">Loading…</p>
      } @else if (!eventTitle()) {
        <p class="wall-status">This wall link is invalid or has expired.</p>
      } @else if (media().length === 0) {
        <div class="wall-empty">
          <h1>{{ eventTitle() }}</h1>
          <p>No photos yet — check back soon!</p>
        </div>
      } @else {
        <div class="wall-slide">
          <h1 class="wall-slide__title">{{ eventTitle() }}</h1>
          @if (currentItem()?.media_type === 'video') {
            <video [src]="currentItem()!.url" autoplay muted></video>
          } @else {
            <img [src]="currentItem()!.url" [alt]="currentItem()!.caption || 'Guest photo'" />
          }
          <span class="wall-slide__by">{{ currentItem()!.guestName }}</span>
        </div>
      }
    </main>
  `,
  styles: [`
    .wall-page { min-height: 100vh; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; }
    .wall-status { font-size: 1.2rem; color: #94a3b8; }
    .wall-empty { text-align: center; }
    .wall-slide { text-align: center; max-width: 90vw; }
    .wall-slide__title { font-size: 1.4rem; margin: 0 0 20px; color: #a78bfa; }
    .wall-slide img, .wall-slide video { max-width: 90vw; max-height: 80vh; border-radius: 12px; object-fit: contain; }
    .wall-slide__by { display: block; margin-top: 12px; font-size: 0.9rem; color: #94a3b8; }
  `]
})
export class WallComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private eventMediaService = inject(EventMediaService);
  private platformId = inject(PLATFORM_ID);

  isLoading = signal(true);
  eventTitle = signal<string | null>(null);
  media = signal<EventMediaWithUrl[]>([]);
  currentIndex = signal(0);

  private eventId = '';
  private wallToken = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private slideHandle: ReturnType<typeof setInterval> | null = null;

  currentItem = () => this.media()[this.currentIndex()] ?? null;

  async ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('eventId') ?? '';
    this.wallToken = this.route.snapshot.paramMap.get('wallToken') ?? '';
    await this.loadWall();
    this.isLoading.set(false);

    if (!isPlatformBrowser(this.platformId) || !this.eventTitle()) return;

    this.pollHandle = setInterval(() => this.loadWall(), 5000);
    this.slideHandle = setInterval(() => {
      const count = this.media().length;
      if (count > 0) this.currentIndex.update(i => (i + 1) % count);
    }, 6000);
  }

  async loadWall() {
    const event = await this.eventMediaService.getEventForWall(this.eventId, this.wallToken);
    if (!event) { this.eventTitle.set(null); return; }
    this.eventTitle.set(event.title);
    this.media.set(await this.eventMediaService.getApprovedMedia(this.eventId));
  }

  ngOnDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
    if (this.slideHandle) clearInterval(this.slideHandle);
  }
}
```

- [ ] **Step 2: Register the route**

In `app.routes.ts`, add this route entry immediately before `{ path: '**', redirectTo: '' }`:

```typescript
  {
    path: 'wall/:eventId/:wallToken',
    loadComponent: () => import('./features/wall/wall.component').then(c => c.WallComponent)
  },
```

- [ ] **Step 3: Build to verify**

```bash
npx ng build --configuration development
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/wall/wall.component.ts src/app/app.routes.ts
git commit -m "feat: add public live photo wall at /wall/:eventId/:wallToken"
```

---

### Task 11: Cleanup Edge Function + Schedule

**Files:**
- Create: `supabase/functions/cleanup-expired-media/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/cleanup-expired-media/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, event_date, is_premium')
    if (eventsError) throw eventsError

    const now = Date.now()
    const expiredEventIds = (events ?? [])
      .filter((e: { event_date: string; is_premium: boolean }) => {
        const retentionDays = e.is_premium ? 14 : 1
        const expiry = new Date(e.event_date)
        expiry.setDate(expiry.getDate() + retentionDays)
        return now > expiry.getTime()
      })
      .map((e: { id: string }) => e.id)

    if (expiredEventIds.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const { data: expiredMedia, error: mediaError } = await supabase
      .from('event_media')
      .select('id, storage_path')
      .in('event_id', expiredEventIds)
    if (mediaError) throw mediaError

    if (!expiredMedia || expiredMedia.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const paths = expiredMedia.map((m: { storage_path: string }) => m.storage_path)
    const { error: storageError } = await supabase.storage.from('event-media').remove(paths)
    if (storageError) console.error('Storage cleanup error:', storageError)

    const ids = expiredMedia.map((m: { id: string }) => m.id)
    const { error: deleteError } = await supabase.from('event_media').delete().in('id', ids)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ deleted: ids.length }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('Unexpected error in cleanup-expired-media:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy cleanup-expired-media
```

Expected: deployment succeeds.

- [ ] **Step 3: Schedule it via `pg_cron` (manual SQL in Supabase SQL editor)**

Replace `<SUPABASE_PROJECT_URL>` and `<SUPABASE_SERVICE_ROLE_KEY>` with your project's actual values (Project Settings → API):

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'cleanup-expired-media-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_PROJECT_URL>/functions/v1/cleanup-expired-media',
    headers := jsonb_build_object('Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 4: Verify the schedule was created**

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'cleanup-expired-media-daily';
```

Expected: one row returned.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/cleanup-expired-media/index.ts
git commit -m "feat: add cleanup-expired-media Edge Function, scheduled daily via pg_cron"
```

---

### Task 12: End-to-End Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
npx ng serve
```

- [ ] **Step 2: Verify free-tier photo upload and moderation**

1. As a host, create/open an event (leave `is_premium` off via the admin panel).
2. Open a guest invite link (`/w/:eventId/:guestId`) in another tab.
3. Upload a photo under 10MB.
4. Expected: it appears greyed out under "Waiting for host approval" on the guest page.
5. On the host dashboard, confirm it appears in "Pending Approval" with the guest's name.
6. Click Approve.
7. Reload the guest page — expected: photo now appears in the normal gallery (no longer greyed).

- [ ] **Step 3: Verify the free-tier cap and video block**

1. Upload photos until the event has 30 approved/pending photos (or temporarily lower `FREE_PHOTO_CAP` for this test).
2. Expected: the upload button disables with "This event has reached its free photo limit…".
3. Confirm the file input only accepts image types (no video option shown) while `is_premium` is false.

- [ ] **Step 4: Verify premium unlock**

1. In the admin panel, toggle the event's Premium pill to ON.
2. Reload the guest page — expected: the upload label now says "+ Add Photo/Video" and video files are accepted.
3. Upload a short (<60s) video under 50MB — expected: succeeds, shows pending, approvable from host dashboard, plays with controls once approved.
4. Upload an oversized or too-long video — expected: rejected client-side with a clear message before any network call.
5. On the host dashboard, confirm "Download All" is visible and enabled; click it and confirm a `event-photos.zip` downloads containing the approved media.

- [ ] **Step 5: Verify reject and takedown**

1. Upload a new photo, then click Reject on the host dashboard.
2. Expected: it disappears from the pending queue and from Supabase Storage (check the bucket in the dashboard).
3. Approve another photo, then click Remove from the Approved section.
4. Expected: it disappears from the guest gallery on reload.

- [ ] **Step 6: Verify the live wall**

1. Note the event's `wall_token` (Supabase Table Editor → events).
2. Visit `/wall/:eventId/:wallToken` in a new tab — expected: approved photos rotate as a slideshow with the event title.
3. Approve a new photo from the host dashboard, wait up to 5 seconds — expected: it appears on the wall without a page reload.
4. Visit `/wall/:eventId/wrong-token` — expected: "This wall link is invalid or has expired." with no other event data shown.

- [ ] **Step 7: Verify disabled-event lockout still blocks photos**

1. In the admin panel, toggle the event's Enabled pill to OFF.
2. Reload the guest invite link — expected: the existing "Invitation Unavailable" lockout shows, with no photo tab visible at all.

- [ ] **Step 8: Verify retention cleanup (manual dry run)**

1. In Supabase Table Editor, temporarily backdate a test event's `event_date` to more than 1 day (or 14 days if premium) in the past, and ensure it has at least one `event_media` row.
2. Manually invoke the Edge Function: `npx supabase functions invoke cleanup-expired-media`.
3. Expected: the response shows `deleted` count matching that event's media rows, and both the Storage objects and `event_media` rows are gone.
