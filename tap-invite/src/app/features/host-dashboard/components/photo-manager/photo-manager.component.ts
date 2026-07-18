import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import JSZip from 'jszip';
import { EventMediaService } from '../../../../core/services/event-media/event-media.service';
import { EventMediaWithUrl } from '../../../../core/services/event-media/event-media.types';
import { ToastService } from '../../../../core/services/toast/toast.service';

@Component({
  selector: 'app-photo-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-manager.component.html',
  styleUrls: ['./photo-manager.component.css']
})
export class PhotoManagerComponent implements OnInit {
  @Input({ required: true }) eventId!: string;
  @Input({ required: true }) isPremium = false;

  private eventMediaService = inject(EventMediaService);
  private toast = inject(ToastService);

  isLoading = signal(true);
  pendingMedia = signal<EventMediaWithUrl[]>([]);
  approvedMedia = signal<EventMediaWithUrl[]>([]);
  isZipping = signal(false);

  async ngOnInit() {
    await this.loadMedia();
  }

  async loadMedia() {
    try {
      this.isLoading.set(true);
      const [pending, approved] = await Promise.all([
        this.eventMediaService.getPendingMedia(this.eventId),
        this.eventMediaService.getApprovedMedia(this.eventId),
      ]);
      this.pendingMedia.set(pending);
      this.approvedMedia.set(approved);
    } catch {
      this.toast.error('Failed to load photos.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async approve(item: EventMediaWithUrl) {
    try {
      await this.eventMediaService.approveMedia(item.id);
      this.pendingMedia.update(items => items.filter(i => i.id !== item.id));
      this.approvedMedia.update(items => [item, ...items]);
      this.toast.success('Photo approved.');
    } catch {
      this.toast.error('Failed to approve photo.');
    }
  }

  async reject(item: EventMediaWithUrl) {
    try {
      await this.eventMediaService.deleteMedia(item.id, item.storage_path);
      this.pendingMedia.update(items => items.filter(i => i.id !== item.id));
      this.toast.success('Photo rejected.');
    } catch {
      this.toast.error('Failed to reject photo.');
    }
  }

  async remove(item: EventMediaWithUrl) {
    try {
      await this.eventMediaService.deleteMedia(item.id, item.storage_path);
      this.approvedMedia.update(items => items.filter(i => i.id !== item.id));
      this.toast.success('Photo removed.');
    } catch {
      this.toast.error('Failed to remove photo.');
    }
  }

  async downloadAll() {
    if (!this.isPremium || this.approvedMedia().length === 0) return;
    this.isZipping.set(true);
    try {
      const zip = new JSZip();
      for (const item of this.approvedMedia()) {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const filename = item.storage_path.split('/').pop() ?? item.id;
        zip.file(filename, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'event-photos.zip';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      this.toast.error('Failed to build the download. Please try again.');
    } finally {
      this.isZipping.set(false);
    }
  }
}
