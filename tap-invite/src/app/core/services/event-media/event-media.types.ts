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
