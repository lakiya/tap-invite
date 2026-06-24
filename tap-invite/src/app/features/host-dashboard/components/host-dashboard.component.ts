// src/app/features/host-dashboard/components/host-dashboard.component.ts
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Supabase } from '../../../core/services/supabase/supabase';
import { ToastService } from '../../../core/services/toast/toast.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { EventFormComponent } from './event-form/event-form.component';
import { AddGuestFormComponent } from './add-guest-form/add-guest-form.component';
import { GuestTableComponent } from './guest-table/guest-table.component';
import { TemplateGalleryComponent } from '../../../features/templates/components/template-gallery/template-gallery.component';
import { EditEventDialogComponent, EditDialogResult } from './edit-event-dialog/edit-event-dialog.component';
import { BulkUploadDialogComponent } from './bulk-upload-dialog/bulk-upload-dialog.component';
import { RsvpStatsBarComponent } from './rsvp-stats-bar/rsvp-stats-bar.component';
import { EventSharePanelComponent } from './event-share-panel/event-share-panel.component';
import { normalizeEmail, normalizePhone, type ExistingGuestKey } from './bulk-upload-dialog/guest-import';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    EventFormComponent,
    AddGuestFormComponent,
    GuestTableComponent,
    TemplateGalleryComponent,
    RsvpStatsBarComponent,
    EventSharePanelComponent,
  ],
  templateUrl: './host-dashboard.component.html',
  styleUrls: ['./host-dashboard.component.css']
})
export class HostDashboardComponent implements OnInit, OnDestroy {
  private supabase    = inject(Supabase);
  private router      = inject(Router);
  private platformId  = inject(PLATFORM_ID);
  private toast       = inject(ToastService);
  private dialog      = inject(MatDialog);
  private document    = inject(DOCUMENT);

  userId             = signal<string | null>(null);
  isLoading          = signal(true);
  activeEvent        = signal<any>(null);
  guests             = signal<any[]>([]);
  showTemplatePicker = signal(false);
  selectedTemplateId = signal('default-minimal');
  isSavingTemplate   = signal(false);

  private realtimeChannel: ReturnType<typeof this.supabase.client.channel> | null = null;

  async ngOnInit() {
    const user = await this.supabase.getCurrentUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.userId.set(user.id);
    await this.fetchDashboardData(user.id);
  }

  async fetchDashboardData(userId: string) {
    try {
      const events = await this.supabase.getEventByHost(userId);
      if (events?.length) {
        this.activeEvent.set(events[0]);
        await this.loadGuests(events[0].id);
        this.subscribeToRsvpUpdates(events[0].id);
      }
    } catch {
      this.toast.error('Could not load your dashboard. Please refresh.');
    } finally {
      this.isLoading.set(false);
    }
  }

  handleEventCreated(event: any) {
    this.activeEvent.set(event);
    this.selectedTemplateId.set('default-minimal');
    this.showTemplatePicker.set(true);
  }

  async confirmTemplate() {
    const event = this.activeEvent();
    if (!event) return;
    this.isSavingTemplate.set(true);
    try {
      await this.supabase.updateEvent(event.id, { template_id: this.selectedTemplateId() });
      this.activeEvent.set({ ...event, template_id: this.selectedTemplateId() });
      this.showTemplatePicker.set(false);
      this.toast.success('Template saved!');
    } catch {
      this.toast.error('Could not save template. Please try again.');
    } finally {
      this.isSavingTemplate.set(false);
    }
  }

  openEditDialog() {
    const event = this.activeEvent();
    if (!event) return;
    const isMobile = isPlatformBrowser(this.platformId)
      ? this.document.documentElement.clientWidth <= 600
      : false;
    const ref = this.dialog.open(EditEventDialogComponent, {
      data: { event },
      width: isMobile ? '100vw' : '760px',
      maxWidth: '100vw',
      maxHeight: isMobile ? '92vh' : '90vh',
      position: isMobile ? { bottom: '0' } : undefined,
      panelClass: 'edit-event-dialog-panel',
    });
    ref.afterClosed().subscribe(async (result: EditDialogResult | undefined) => {
      if (!result) return;
      try {
        await this.supabase.updateEvent(event.id, result);
        this.activeEvent.set({ ...event, ...result });
        this.toast.success('Event updated!');
      } catch {
        this.toast.error('Could not update event. Please try again.');
      }
    });
  }

  openBulkUpload() {
    const event = this.activeEvent();
    if (!event) return;

    const existingGuests: ExistingGuestKey[] = this.guests().map(g => ({
      email: normalizeEmail(g.email ?? ''),
      phone: normalizePhone(g.phone_number ?? ''),
    }));

    const isMobile = isPlatformBrowser(this.platformId)
      ? this.document.documentElement.clientWidth <= 600
      : false;

    const ref = this.dialog.open(BulkUploadDialogComponent, {
      data: { eventId: event.id, existingGuests },
      width: isMobile ? '100vw' : '860px',
      maxWidth: '100vw',
      maxHeight: isMobile ? '92vh' : '90vh',
      position: isMobile ? { bottom: '0' } : undefined,
      panelClass: 'edit-event-dialog-panel',
    });

    ref.afterClosed().subscribe(async (insertedCount: number | undefined) => {
      if (insertedCount == null) return;
      await this.loadGuests(event.id);
      this.toast.success(`${insertedCount} guest${insertedCount === 1 ? '' : 's'} added successfully!`);
    });
  }

  subscribeToRsvpUpdates(eventId: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.realtimeChannel = this.supabase.client
      .channel(`rsvps-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rsvps' },
        (payload) => {
          const changedGuestId =
            (payload.new as { guest_id?: string })?.guest_id ??
            (payload.old as { guest_id?: string })?.guest_id;
          if (changedGuestId && this.guests().some(g => g.id === changedGuestId)) {
            this.loadGuests(eventId);
          }
        }
      )
      .subscribe();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
  }

  async loadGuests(eventId: string) {
    const list = await this.supabase.getGuests(eventId);
    this.guests.set(list || []);
  }

  async handleGuestAdded() {
    await this.loadGuests(this.activeEvent().id);
    this.toast.success('Guest added successfully!');
  }

  async handleGuestDeleted() {
    await this.loadGuests(this.activeEvent().id);
    this.toast.success('Guest deleted successfully!');
  }

  async copyLink(guestId: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `${window.location.origin}/w/${this.activeEvent().id}/${guestId}`;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.info('Invitation link copied!');
    } catch {
      this.toast.error('Could not copy — please copy the link manually.');
    }
  }

  async handleLogout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
