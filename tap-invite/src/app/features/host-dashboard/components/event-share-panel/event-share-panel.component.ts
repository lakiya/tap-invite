import { Component, inject, input, computed, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import QRCode from 'qrcode';
import { ToastService } from '../../../../core/services/toast/toast.service';

@Component({
  selector: 'app-event-share-panel',
  standalone: true,
  imports: [],
  templateUrl: './event-share-panel.component.html',
  styleUrls: ['./event-share-panel.component.css'],
})
export class EventSharePanelComponent implements OnInit {
  eventId    = input.required<string>();
  eventTitle = input.required<string>();

  private toast      = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  shareUrl  = computed(() =>
    isPlatformBrowser(this.platformId)
      ? `${window.location.origin}/e/${this.eventId()}`
      : ''
  );
  qrDataUrl = signal('');

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = await QRCode.toDataURL(this.shareUrl(), { width: 256, margin: 2 });
    this.qrDataUrl.set(url);
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.toast.info('Event link copied!');
    } catch {
      this.toast.error('Could not copy — please copy the link manually.');
    }
  }
}
