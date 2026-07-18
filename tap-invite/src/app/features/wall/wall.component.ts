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
      } @else if (currentItem()) {
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
    const newMedia = await this.eventMediaService.getApprovedMedia(this.eventId);
    this.media.set(newMedia);
    this.currentIndex.update(i => Math.min(i, Math.max(newMedia.length - 1, 0)));
  }

  ngOnDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
    if (this.slideHandle) clearInterval(this.slideHandle);
  }
}
