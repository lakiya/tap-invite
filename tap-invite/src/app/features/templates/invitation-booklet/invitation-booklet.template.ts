import { Component, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

export type BookState = 'cover' | 'spread' | 'back';

@Component({
  selector: 'app-invitation-booklet-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `
  <div class="ib-scene"
       (touchstart)="onDragStart($event)"
       (touchend)="onDragEnd($event)"
       (mousedown)="onDragStart($event)"
       (mouseup)="onDragEnd($event)">

    <div class="ib-wrapper">
      <div [class]="'ib-book ib-' + state()">

        <!-- LEFT PAGE: front = Page 2 (spread left), back = Page 4 (back cover) -->
        <div class="ib-page ib-page-left">

          <!-- Front face — Page 2: When & Where -->
          <div class="ib-face ib-face-front ib-side-2">
            <div class="ib-inner-content">
              <p class="ib-section-ornament">◆</p>
              <p class="ib-section-label">When &amp; Where</p>
              <div class="ib-gold-rule"></div>
              <div class="ib-detail-block">
                <p class="ib-detail-label">Date &amp; Time</p>
                <p class="ib-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
                <p class="ib-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
              </div>
              <div class="ib-detail-block">
                <p class="ib-detail-label">Venue</p>
                <p class="ib-detail-primary">{{ context().event.location_text }}</p>
                @if (context().event.google_maps_url) {
                  <a [href]="context().event.google_maps_url"
                     target="_blank" rel="noopener noreferrer"
                     class="ib-map-link">View on Google Maps →</a>
                }
              </div>
              @if (context().event.notes) {
                <div class="ib-detail-block">
                  <p class="ib-detail-label">Notes</p>
                  <p class="ib-notes-text">{{ context().event.notes }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Back face — Page 4: Back Cover -->
          <div class="ib-face ib-face-back ib-side-4">
            <div class="ib-corner ib-tl">✦</div>
            <div class="ib-corner ib-tr">✦</div>
            <div class="ib-corner ib-bl">✦</div>
            <div class="ib-corner ib-br">✦</div>
            <div class="ib-s4-content">
              <p class="ib-s4-ornament">❧</p>
              <div class="ib-gold-rule"></div>
              <p class="ib-s4-message">We look forward<br>to celebrating<br>with you.</p>
              <div class="ib-gold-rule"></div>
              <p class="ib-s4-closing">With love ♡</p>
            </div>
          </div>

        </div>

        <!-- SPINE -->
        <div class="ib-spine"></div>

        <!-- RIGHT PAGE: front = Page 1 (cover), back = Page 3 (spread right) -->
        <div class="ib-page ib-page-right">

          <!-- Front face — Page 1: Cover -->
          <div class="ib-face ib-face-front ib-side-1">
            <div class="ib-corner ib-tl">✦</div>
            <div class="ib-corner ib-tr">✦</div>
            <div class="ib-corner ib-bl">✦</div>
            <div class="ib-corner ib-br">✦</div>
            <div class="ib-s1-content">
              <p class="ib-ornament">❧</p>
              <p class="ib-invite-line">You are cordially invited</p>
              <div class="ib-gold-rule"></div>
              <h1 class="ib-title">{{ context().event.title }}</h1>
              <div class="ib-gold-rule"></div>
              <p class="ib-cover-date">{{ context().event.event_date | date:'MMMM d, y' }}</p>
              <p class="ib-tap-hint">
                <span class="ib-pulse"></span>
                Tap to open
              </p>
            </div>
          </div>

          <!-- Back face — Page 3: RSVP -->
          <div class="ib-face ib-face-back ib-side-3">
            <div class="ib-inner-content">
              <p class="ib-section-ornament">◆</p>
              <p class="ib-section-label">Will you join us?</p>
              <div class="ib-gold-rule"></div>
              @if (context().event.show_rsvp !== false) {
                <p class="ib-guest-name">{{ context().guest.display_name }}</p>
                <div class="ib-rsvp-area">
                  <app-rsvp-buttons
                    [status]="context().rsvpStatus"
                    (rsvpChange)="context().onRsvpChange($event)">
                  </app-rsvp-buttons>
                  @if (context().rsvpError) {
                    <p class="ib-rsvp-error">{{ context().rsvpError }}</p>
                  }
                </div>
              } @else {
                <div class="ib-rsvp-disabled">
                  <p class="ib-rsvp-ornament">❧</p>
                  <p class="ib-rsvp-note">Kindly note your attendance</p>
                </div>
              }
            </div>
          </div>

        </div>
      </div>

      <!-- TAP ZONES (positioned within wrapper, over the book) -->
      <div class="ib-tap-left"
           [class.ib-tap-disabled]="state() === 'cover'"
           (click)="navigate('backward')">
        <span class="ib-chevron">‹</span>
      </div>
      <div class="ib-tap-right"
           [class.ib-tap-disabled]="state() === 'back'"
           (click)="navigate('forward')">
        <span class="ib-chevron">›</span>
      </div>

      <!-- NAV DOTS -->
      <div class="ib-dots">
        <span class="ib-dot" [class.ib-dot-active]="state() === 'cover'"></span>
        <span class="ib-dot" [class.ib-dot-active]="state() === 'spread'"></span>
        <span class="ib-dot" [class.ib-dot-active]="state() === 'back'"></span>
      </div>
    </div>

  </div>
`,
  styleUrl: './invitation-booklet.template.css'
})
export class InvitationBookletTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
  state = signal<BookState>('cover');

  private dragStartX = 0;
  private dragStartY = 0;

  navigate(direction: 'forward' | 'backward'): void {
    const s = this.state();
    if (direction === 'forward') {
      if (s === 'cover')  this.state.set('spread');
      if (s === 'spread') this.state.set('back');
    } else {
      if (s === 'back')   this.state.set('spread');
      if (s === 'spread') this.state.set('cover');
    }
  }

  onDragStart(e: TouchEvent | MouseEvent): void {
    this.dragStartX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
    this.dragStartY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;
  }

  onDragEnd(e: TouchEvent | MouseEvent): void {
    const endX = e instanceof TouchEvent ? e.changedTouches[0].clientX : e.clientX;
    const endY = e instanceof TouchEvent ? e.changedTouches[0].clientY : e.clientY;
    const deltaX = endX - this.dragStartX;
    const deltaY = endY - this.dragStartY;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    this.navigate(deltaX < 0 ? 'forward' : 'backward');
  }
}
