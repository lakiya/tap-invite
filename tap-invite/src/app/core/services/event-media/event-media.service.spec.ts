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
