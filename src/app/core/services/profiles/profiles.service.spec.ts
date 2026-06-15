import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProfilesService } from './profiles.service';
import { Supabase } from '../supabase/supabase';
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

describe('ProfilesService', () => {
  let service: ProfilesService;
  let supabase: Supabase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENV, useValue: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' } },
      ],
    });
    service = TestBed.inject(ProfilesService);
    supabase = TestBed.inject(Supabase);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns { role: "user" } when supabase returns a valid user role', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null });
    const mockEq     = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    vi.spyOn(supabase.client, 'from').mockReturnValue({ select: mockSelect } as any);

    const result = await service.getMyProfile('user-123');

    expect(result).toEqual({ role: 'user' });
  });

  it('returns null when supabase returns an error', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    const mockEq     = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    vi.spyOn(supabase.client, 'from').mockReturnValue({ select: mockSelect } as any);

    const result = await service.getMyProfile('user-123');

    expect(result).toBeNull();
  });

  it('returns null when data.role is an unexpected value', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'moderator' }, error: null });
    const mockEq     = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    vi.spyOn(supabase.client, 'from').mockReturnValue({ select: mockSelect } as any);

    const result = await service.getMyProfile('user-123');

    expect(result).toBeNull();
  });
});
