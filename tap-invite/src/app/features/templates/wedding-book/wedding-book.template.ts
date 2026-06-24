import { Component, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

@Component({
  selector: 'app-wedding-book-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `
    <div class="wb-scene">
      <div [class]="'wb-book wb-' + state()">

        <!-- LEFT PAGE: front = Side 2 (Ceremony), back = Side 4 (Decorative) -->
        <div class="wb-page wb-page-left">

          <!-- Front face — Side 2: Ceremony (visible when open) -->
          <div class="wb-face wb-face-front wb-side-2">
            <div class="wb-inner-content">
              <p class="wb-section-ornament">◆</p>
              <p class="wb-section-label">Ceremony</p>
              <div class="wb-gold-rule"></div>
              <div class="wb-detail-block">
                <p class="wb-detail-label">Date &amp; Time</p>
                <p class="wb-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
                <p class="wb-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
              </div>
              <div class="wb-detail-block">
                <p class="wb-detail-label">Venue</p>
                <p class="wb-detail-primary">{{ context().event.location_text }}</p>
                @if (context().event.google_maps_url) {
                  <a [href]="context().event.google_maps_url"
                     target="_blank" rel="noopener noreferrer"
                     class="wb-map-link">View on Maps →</a>
                }
              </div>
              <button class="wb-close-btn" (click)="close()" type="button">← Close</button>
            </div>
          </div>

          <!-- Back face — Side 4: Decorative back cover (visible when closed) -->
          <div class="wb-face wb-face-back wb-side-4">
            <div class="wb-corner wb-tl">✦</div>
            <div class="wb-corner wb-tr">✦</div>
            <div class="wb-corner wb-bl">✦</div>
            <div class="wb-corner wb-br">✦</div>
            <div class="wb-s4-content">
              <p class="wb-s4-ornament">❧</p>
              <div class="wb-gold-rule"></div>
              <p class="wb-s4-message">We look forward<br>to celebrating<br>with you.</p>
              <div class="wb-gold-rule"></div>
              <p class="wb-s4-names">{{ context().event.title }}</p>
            </div>
          </div>

        </div>

        <!-- SPINE -->
        <div class="wb-spine"></div>

        <!-- RIGHT PAGE: front = Side 1 (Cover), back = Side 3 (Details + RSVP) -->
        <div class="wb-page wb-page-right">

          <!-- Front face — Side 1: Cover (visible when closed) -->
          <div class="wb-face wb-face-front wb-side-1" (click)="open()">
            <div class="wb-corner wb-tl">✦</div>
            <div class="wb-corner wb-tr">✦</div>
            <div class="wb-corner wb-bl">✦</div>
            <div class="wb-corner wb-br">✦</div>
            <div class="wb-s1-content">
              <p class="wb-ornament">❧</p>
              <p class="wb-invite-line">You are invited to celebrate</p>
              <div class="wb-gold-rule"></div>
              <h1 class="wb-couple-names">{{ context().event.title }}</h1>
              <div class="wb-gold-rule"></div>
              <p class="wb-cover-date">{{ context().event.event_date | date:'MMMM d, y' }}</p>
              <p class="wb-tap-hint">
                <span class="wb-pulse"></span>
                Tap to open
              </p>
            </div>
          </div>

          <!-- Back face — Side 3: Details + RSVP (visible when open) -->
          <div class="wb-face wb-face-back wb-side-3">
            <div class="wb-inner-content">
              <p class="wb-section-ornament">◆</p>
              <p class="wb-section-label">Additional Details</p>
              <div class="wb-gold-rule"></div>
              @if (context().event.notes) {
                <p class="wb-notes-text">{{ context().event.notes }}</p>
              } @else {
                <p class="wb-notes-empty">❧</p>
              }
              @if (context().event.show_rsvp !== false) {
                <div class="wb-rsvp-area">
                  <div class="wb-gold-rule"></div>
                  <app-rsvp-buttons
                    [status]="context().rsvpStatus"
                    (rsvpChange)="context().onRsvpChange($event)">
                  </app-rsvp-buttons>
                  @if (context().rsvpError) {
                    <p class="wb-rsvp-error">{{ context().rsvpError }}</p>
                  }
                </div>
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styleUrl: './wedding-book.template.css'
})
export class WeddingBookTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
  state = signal<'closed' | 'open'>('closed');

  open():  void { this.state.set('open');   }
  close(): void { this.state.set('closed'); }
}
