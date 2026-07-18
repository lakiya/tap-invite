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
      (data ?? []).map((d: { path: string | null; signedUrl: string | null }) => [d.path ?? '', d.signedUrl ?? ''])
    );
    return rows.map(r => ({
      ...r,
      guestName: r.guests?.display_name ?? 'Guest',
      url: urlMap.get(r.storage_path) ?? '',
    }));
  }
}
