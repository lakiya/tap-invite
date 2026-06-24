import { Component, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

type BookState = 'cover' | 'inside' | 'back';

@Component({
  selector: 'app-wedding-book-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `
    <div class="wb-page">
      <div [class]="'wb-book wb-state-' + state()">

        <!-- Side 1: Cover -->
        <div class="wb-face wb-cover" (click)="toInside()">
          <div class="wb-corner wb-corner-tl">✦</div>
          <div class="wb-corner wb-corner-tr">✦</div>
          <div class="wb-corner wb-corner-bl">✦</div>
          <div class="wb-corner wb-corner-br">✦</div>
          <div class="wb-cover-content">
            <p class="wb-ornament">❧</p>
            <p class="wb-invite-line">You are invited to celebrate</p>
            <div class="wb-divider-gold"></div>
            <h1 class="wb-couple-names">{{ context().event.title }}</h1>
            <div class="wb-divider-gold"></div>
            <p class="wb-cover-date">{{ context().event.event_date | date:'MMMM d, y' }}</p>
            <p class="wb-tap-hint">
              <span class="wb-pulse"></span>
              Tap to open
            </p>
          </div>
        </div>

        <!-- Sides 2 + 3: Inside spread -->
        <div class="wb-face wb-inside">
          <div class="wb-inside-left">
            <p class="wb-section-ornament">◆</p>
            <p class="wb-section-label">Ceremony</p>
            <div class="wb-inside-divider"></div>
            <div class="wb-detail-row">
              <p class="wb-detail-label">Date &amp; Time</p>
              <p class="wb-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
              <p class="wb-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
            </div>
            <div class="wb-detail-row">
              <p class="wb-detail-label">Venue</p>
              <p class="wb-detail-primary">{{ context().event.location_text }}</p>
              @if (context().event.google_maps_url) {
                <a [href]="context().event.google_maps_url"
                   target="_blank" rel="noopener noreferrer"
                   class="wb-map-link">View on Maps →</a>
              }
            </div>
            <button class="wb-nav-btn" (click)="toCover()" type="button">← Close</button>
          </div>
          <div class="wb-spine"></div>
          <div class="wb-inside-right">
            <p class="wb-section-ornament">◆</p>
            <p class="wb-section-label">Additional Details</p>
            <div class="wb-inside-divider"></div>
            @if (context().event.notes) {
              <p class="wb-notes-text">{{ context().event.notes }}</p>
            } @else {
              <p class="wb-notes-empty">❧</p>
            }
            @if (context().event.show_rsvp !== false) {
              <button class="wb-rsvp-btn" (click)="toBack()" type="button">RSVP →</button>
            }
          </div>
        </div>

        <!-- Side 4: Back / RSVP -->
        <div class="wb-face wb-back">
          <p class="wb-ornament">❧</p>
          <p class="wb-back-heading">Will you join us?</p>
          <div class="wb-divider-gold"></div>
          @if (context().event.show_rsvp !== false) {
            <div class="wb-rsvp-area">
              <app-rsvp-buttons
                [status]="context().rsvpStatus"
                (rsvpChange)="context().onRsvpChange($event)">
              </app-rsvp-buttons>
              @if (context().rsvpError) {
                <p class="wb-rsvp-error">{{ context().rsvpError }}</p>
              }
            </div>
          }
          <div class="wb-divider-gold"></div>
          <p class="wb-closing">We look forward to celebrating with you.</p>
          <button class="wb-back-nav" (click)="toInside()" type="button">← Back</button>
        </div>

      </div>
    </div>
  `,
  styleUrl: './wedding-book.template.css'
})
export class WeddingBookTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
  state = signal<BookState>('cover');

  toInside(): void { this.state.set('inside'); }
  toBack():   void { this.state.set('back');   }
  toCover():  void { this.state.set('cover');  }
}
