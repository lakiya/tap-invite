import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Supabase } from './supabase';
import { APP_ENV } from '../../tokens/app-env';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}));

describe('Supabase', () => {
  let service: Supabase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENV, useValue: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' } },
      ],
    });
    service = TestBed.inject(Supabase);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose the supabase client', () => {
    expect(service.client).toBeTruthy();
  });

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
});
