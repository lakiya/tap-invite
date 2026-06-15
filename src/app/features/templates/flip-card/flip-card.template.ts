import { Component, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

@Component({
  selector: 'app-flip-card-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `
    <div class="fc-page">
      <div class="fc-scene" [class.is-flipped]="isFlipped()">
        <div class="fc-card">

          <!-- ─── FRONT: elegant cover ─── -->
          <div class="fc-face fc-front" (click)="flip()">
            <div class="fc-frame"></div>
            <div class="fc-front-content">
              <p class="fc-ornament">✦ &nbsp; ✦ &nbsp; ✦</p>
              <p class="fc-invite-label">You Are Invited</p>

              <div class="fc-seal">
                <span class="fc-seal-icon">✉</span>
              </div>

              <p class="fc-celebrate">To celebrate with</p>
              <h2 class="fc-guest-name">{{ context().guest.display_name }}</h2>

              <div class="fc-divider-line">
                <span class="fc-diamond">◆</span>
              </div>

              <p class="fc-event-teaser">{{ context().event.title }}</p>

              <div class="fc-tap-hint">
                <span class="fc-tap-pulse"></span>
                Tap to open
              </div>
            </div>
          </div>

          <!-- ─── BACK: styled event details ─── -->
          <div class="fc-face fc-back">

            <!-- Header -->
            <div class="fc-back-header">
              <p class="fc-back-ornament">✦ &nbsp; ✦ &nbsp; ✦</p>
              <p class="fc-back-label">Invitation Details</p>
              <h1 class="fc-event-name">{{ context().event.title }}</h1>
              <div class="fc-header-accent"></div>
            </div>

            <!-- Scrollable content -->
            <div class="fc-back-body">

              <!-- Date & Time -->
              <div class="fc-detail-row">
                <div class="fc-detail-badge">📅</div>
                <div class="fc-detail-info">
                  <p class="fc-detail-label">Date &amp; Time</p>
                  <p class="fc-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
                  <p class="fc-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
                </div>
              </div>

              <div class="fc-row-sep">
                <span class="fc-row-dot"></span>
              </div>

              <!-- Location -->
              <div class="fc-detail-row">
                <div class="fc-detail-badge">📍</div>
                <div class="fc-detail-info">
                  <p class="fc-detail-label">Location</p>
                  <p class="fc-detail-primary">{{ context().event.location_text }}</p>
                  @if (context().event.google_maps_url) {
                    <a [href]="context().event.google_maps_url"
                       target="_blank" rel="noopener noreferrer"
                       class="fc-map-link">View on Google Maps →</a>
                  }
                </div>
              </div>

              <!-- RSVP box -->
              <div class="fc-rsvp-box">
                <p class="fc-rsvp-heading">
                  <span class="fc-rsvp-ornament">◆</span>
                  Will you join us?
                  <span class="fc-rsvp-ornament">◆</span>
                </p>
                <app-rsvp-buttons
                  [status]="context().rsvpStatus"
                  (rsvpChange)="context().onRsvpChange($event)">
                </app-rsvp-buttons>
                @if (context().rsvpError) {
                  <p class="fc-rsvp-error">{{ context().rsvpError }}</p>
                }
              </div>

            </div>

            <!-- Footer -->
            <div class="fc-back-footer">
              <button class="fc-back-btn" (click)="flip()" type="button">
                ← Back to cover
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  `,
  styleUrl: './flip-card.template.css'
})
export class FlipCardTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
  isFlipped = signal(false);

  flip(): void {
    this.isFlipped.update(v => !v);
  }
}
