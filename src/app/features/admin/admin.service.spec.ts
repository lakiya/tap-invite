import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { vi } from 'vitest';
import { AdminService } from './admin.service';
import { Supabase } from '../../core/services/supabase/supabase';
import { APP_ENV } from '../../core/tokens/app-env';

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
      delete: vi.fn().mockReturnThis(),
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

describe('AdminService', () => {
  let service: AdminService;
  let supabase: Supabase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENV, useValue: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' } },
        { provide: DOCUMENT, useValue: { location: { origin: 'https://test.example.com' } } },
      ],
    });
    service = TestBed.inject(AdminService);
    supabase = TestBed.inject(Supabase);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---- computeStatus ----

  describe('computeStatus', () => {
    it('returns "Disabled" when is_enabled is false', () => {
      const result = service.computeStatus({ is_enabled: false, event_date: '2099-01-01T00:00:00' });
      expect(result).toBe('Disabled');
    });

    it('returns "Upcoming" for a future date', () => {
      const result = service.computeStatus({ is_enabled: true, event_date: '2099-12-31T23:59:59' });
      expect(result).toBe('Upcoming');
    });

    it('returns "Ongoing" for today\'s date as a full ISO datetime', () => {
      // Use today's date (2026-06-15) as a full ISO datetime string
      const todayISO = new Date().toISOString().split('T')[0];
      const result = service.computeStatus({ is_enabled: true, event_date: `${todayISO}T10:00:00` });
      expect(result).toBe('Ongoing');
    });

    it('returns "Passed" for a past date', () => {
      const result = service.computeStatus({ is_enabled: true, event_date: '2020-01-01T08:00:00' });
      expect(result).toBe('Passed');
    });
  });

  // ---- getAllEvents ----

  describe('getAllEvents', () => {
    it('merges hostEmail from profiles and computes status', async () => {
      const fakeEvents = [
        { id: 'evt-1', host_id: 'user-1', is_enabled: true, event_date: '2099-12-31T18:00:00', created_at: '2025-01-01' },
      ];
      const fakeProfiles = [
        { id: 'user-1', email: 'host@example.com' },
      ];

      // events chain: select -> order -> resolves
      const mockEventsOrder = vi.fn().mockResolvedValue({ data: fakeEvents, error: null });
      const mockEventsSelect = vi.fn().mockReturnValue({ order: mockEventsOrder });

      // profiles chain: select -> resolves
      const mockProfilesSelect = vi.fn().mockResolvedValue({ data: fakeProfiles, error: null });

      vi.spyOn(supabase.client, 'from').mockImplementation((table: string) => {
        if (table === 'events') return { select: mockEventsSelect } as any;
        if (table === 'profiles') return { select: mockProfilesSelect } as any;
        return {} as any;
      });

      const result = await service.getAllEvents();

      expect(result).toHaveLength(1);
      expect(result[0].hostEmail).toBe('host@example.com');
      expect(result[0].computedStatus).toBe('Upcoming');
    });

    it('falls back to "Unknown" when host_id is not in profiles', async () => {
      const fakeEvents = [
        { id: 'evt-2', host_id: 'missing-user', is_enabled: true, event_date: '2099-12-31T18:00:00', created_at: '2025-01-01' },
      ];

      const mockEventsOrder = vi.fn().mockResolvedValue({ data: fakeEvents, error: null });
      const mockEventsSelect = vi.fn().mockReturnValue({ order: mockEventsOrder });
      const mockProfilesSelect = vi.fn().mockResolvedValue({ data: [], error: null });

      vi.spyOn(supabase.client, 'from').mockImplementation((table: string) => {
        if (table === 'events') return { select: mockEventsSelect } as any;
        if (table === 'profiles') return { select: mockProfilesSelect } as any;
        return {} as any;
      });

      const result = await service.getAllEvents();

      expect(result[0].hostEmail).toBe('Unknown');
    });

    it('throws when Supabase returns an error for events', async () => {
      const mockEventsOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const mockEventsSelect = vi.fn().mockReturnValue({ order: mockEventsOrder });
      const mockProfilesSelect = vi.fn().mockResolvedValue({ data: [], error: null });

      vi.spyOn(supabase.client, 'from').mockImplementation((table: string) => {
        if (table === 'events') return { select: mockEventsSelect } as any;
        if (table === 'profiles') return { select: mockProfilesSelect } as any;
        return {} as any;
      });

      await expect(service.getAllEvents()).rejects.toMatchObject({ message: 'DB error' });
    });
  });

  // ---- sendManualMagicLink ----

  describe('sendManualMagicLink', () => {
    it('calls signInWithOtp with correct email and redirectTo', async () => {
      const mockSignInWithOtp = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase.client.auth, 'signInWithOtp').mockImplementation(mockSignInWithOtp);

      await service.sendManualMagicLink('user@example.com');

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        options: { emailRedirectTo: 'https://test.example.com/auth/callback' },
      });
    });

    it('throws when Supabase returns an error', async () => {
      const fakeError = { message: 'OTP send failed' };
      vi.spyOn(supabase.client.auth, 'signInWithOtp').mockResolvedValue({ data: { user: null, session: null }, error: fakeError as any });

      await expect(service.sendManualMagicLink('bad@example.com')).rejects.toMatchObject({ message: 'OTP send failed' });
    });
  });
});
