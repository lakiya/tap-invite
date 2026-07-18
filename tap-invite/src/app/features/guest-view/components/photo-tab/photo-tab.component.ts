import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventMediaService } from '../../../../core/services/event-media/event-media.service';
import { EventMediaWithUrl, FREE_PHOTO_CAP } from '../../../../core/services/event-media/event-media.types';

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
        <label class="upload-btn" [class.upload-btn--disabled]="atPhotoCap()">
          {{ isUploading() ? 'Uploading…' : ('+ Add Photo' + (isPremium ? '/Video' : '')) }}
          <input
            type="file"
            [accept]="acceptTypes"
            (change)="onFileSelected($event)"
            [disabled]="isUploading() || atPhotoCap()"
            hidden
          />
        </label>
      </div>

      @if (atPhotoCap()) {
        <p class="cap-message">This event has reached its free photo limit. Ask your host to unlock more.</p>
      }

      @if (uploadError()) {
        <p class="upload-error">{{ uploadError() }}</p>
      }

      @if (isLoading()) {
        <p class="hint-text">Loading photos…</p>
      } @else if (loadError()) {
        <p class="upload-error">{{ loadError() }}</p>
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
    .upload-btn--disabled { background: #a3a3a3; cursor: not-allowed; }
    .upload-error { color: #dc2626; font-size: 0.8125rem; margin: 0 0 12px; }
    .cap-message { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; font-size: 0.8125rem; margin: 0 0 12px; }
    .hint-text { color: #64748b; font-size: 0.875rem; }
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .gallery-item { position: relative; border-radius: 10px; overflow: hidden; background: #f1f5f9; aspect-ratio: 1; }
    .gallery-item img, .gallery-item video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .gallery-item--pending { opacity: 0.5; }
    .pending-badge { position: absolute; bottom: 4px; left: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; font-size: 0.65rem; padding: 3px 6px; border-radius: 4px; text-align: center; }
    .gallery-item__by { position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.55); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; }
  `]
})
export class PhotoTabComponent implements OnInit, OnDestroy {
  @Input({ required: true }) eventId!: string;
  @Input({ required: true }) guestId!: string;
  @Input({ required: true }) isPremium = false;

  private eventMediaService = inject(EventMediaService);

  isLoading = signal(true);
  isUploading = signal(false);
  uploadError = signal<string | null>(null);
  loadError = signal<string | null>(null);
  approvedMedia = signal<EventMediaWithUrl[]>([]);
  myPendingUploads = signal<PendingPreview[]>([]);
  atPhotoCap = signal(false);

  get acceptTypes(): string {
    return this.isPremium
      ? 'image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime,video/webm'
      : 'image/jpeg,image/png,image/heic,image/webp';
  }

  async ngOnInit() {
    await Promise.all([this.loadApprovedMedia(), this.checkPhotoCap()]);
  }

  ngOnDestroy() {
    for (const item of this.myPendingUploads()) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  async loadApprovedMedia() {
    try {
      this.isLoading.set(true);
      this.loadError.set(null);
      this.approvedMedia.set(await this.eventMediaService.getApprovedMedia(this.eventId));
    } catch {
      this.loadError.set("Couldn't load photos. Please try reloading the page.");
    } finally {
      this.isLoading.set(false);
    }
  }

  async checkPhotoCap() {
    if (this.isPremium) return;
    try {
      const count = await this.eventMediaService.getMediaCount(this.eventId, 'photo');
      this.atPhotoCap.set(count >= FREE_PHOTO_CAP);
    } catch {
      // Non-fatal: leave atPhotoCap as-is; the reactive check in uploadMedia
      // still guards against exceeding the cap if this proactive check fails.
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
      if (mediaType === 'photo' && !this.isPremium) {
        await this.checkPhotoCap();
      }
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Failed to upload. Please try again.');
      URL.revokeObjectURL(previewUrl);
    } finally {
      this.isUploading.set(false);
    }
  }
}
