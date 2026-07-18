import { describe, it, expect, beforeEach } from 'vitest';
import { validateMediaFile, PHOTO_MAX_BYTES, VIDEO_MAX_BYTES } from './event-media.types';
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
      const uploadSpy = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase.client, 'storage', 'get').mockReturnValue({
        from: vi.fn(() => ({ upload: uploadSpy })),
      } as any);

      await expect(service.uploadMedia('evt-1', 'guest-1', file, false)).rejects.toThrow(/free photo limit/);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('rejects a video on a non-premium event before touching storage', async () => {
      const file = new File([new Uint8Array(1024)], 'clip.mp4', { type: 'video/mp4' });
      const uploadSpy = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase.client, 'storage', 'get').mockReturnValue({
        from: vi.fn(() => ({ upload: uploadSpy })),
      } as any);

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
