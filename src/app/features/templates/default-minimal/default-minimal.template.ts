// src/app/features/templates/default-minimal/default-minimal.template.ts
import { Component, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

@Component({
  selector: 'app-default-minimal-template',
  standalone: true,
  imports: [CommonModule, DatePipe, LottieComponent, RsvpButtonsComponent],
  template: `
    <div class="invitation-card fade-up">
      <div class="card-band">
        <span class="event-badge">You're Invited</span>
        <p class="greeting">Dear {{ context().guest.display_name }},</p>
      </div>
      <div class="card-body">
        <div class="animation-wrap">
          <ng-lottie [options]="lottieOptions" width="160px" height="160px"></ng-lottie>
        </div>
        <h1 class="event-name">{{ context().event.title }}</h1>
        <div class="detail-rows">
          <div class="detail-row">
            <span class="detail-icon">📅</span>
            <div>
              <p class="detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
              <p class="detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-icon">📍</span>
            <div>
              <p class="detail-primary">{{ context().event.location_text }}</p>
              @if (context().event.google_maps_url) {
                <a [href]="context().event.google_maps_url" target="_blank" class="map-link">
                  View on Google Maps →
                </a>
              }
            </div>
          </div>
        </div>
        <div class="divider"></div>
        <app-rsvp-buttons
          [status]="context().rsvpStatus"
          (rsvpChange)="context().onRsvpChange($event)">
        </app-rsvp-buttons>
        @if (context().rsvpError) {
          <p class="rsvp-error">{{ context().rsvpError }}</p>
        }
      </div>
    </div>
  `,
  styleUrl: './default-minimal.template.css'
})
export class DefaultMinimalTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();

  readonly lottieOptions: AnimationOptions = {
    path: 'assets/animations/celebration4.json',
    loop: true,
    autoplay: true,
  };
}
