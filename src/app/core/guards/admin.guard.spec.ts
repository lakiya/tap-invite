import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { adminGuard } from './admin.guard';
import { Supabase } from '../services/supabase/supabase';
import { ProfilesService } from '../services/profiles/profiles.service';
import { APP_ENV } from '../tokens/app-env';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
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

describe('adminGuard', () => {
  let supabase: Supabase;
  let profiles: ProfilesService;
  let router: Router;

  const runGuard = () =>
    TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: APP_ENV,
          useValue: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
        },
      ],
    });

    supabase = TestBed.inject(Supabase);
    profiles = TestBed.inject(ProfilesService);
    router = TestBed.inject(Router);
  });

  it('redirects to /login when getCurrentUser() returns null', async () => {
    vi.spyOn(supabase, 'getCurrentUser').mockResolvedValue(null);

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('redirects to /dashboard when profile role is "user"', async () => {
    vi.spyOn(supabase, 'getCurrentUser').mockResolvedValue({ id: 'user-123' } as any);
    vi.spyOn(profiles, 'getMyProfile').mockResolvedValue({ role: 'user' });

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });

  it('redirects to /dashboard when getMyProfile() returns null (DB error)', async () => {
    vi.spyOn(supabase, 'getCurrentUser').mockResolvedValue({ id: 'user-123' } as any);
    vi.spyOn(profiles, 'getMyProfile').mockResolvedValue(null);

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });

  it('returns true when profile role is "super_admin"', async () => {
    vi.spyOn(supabase, 'getCurrentUser').mockResolvedValue({ id: 'admin-456' } as any);
    vi.spyOn(profiles, 'getMyProfile').mockResolvedValue({ role: 'super_admin' });

    const result = await runGuard();

    expect(result).toBe(true);
  });
});
