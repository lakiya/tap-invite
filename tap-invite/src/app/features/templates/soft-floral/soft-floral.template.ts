// src/app/features/templates/soft-floral/soft-floral.template.ts
import { Component, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RsvpButtonsComponent } from '../../guest-view/components/rsvp-buttons/rsvp-buttons.component';
import { TemplateContext, TemplateComponent } from '../template.types';

@Component({
  selector: 'app-soft-floral-template',
  standalone: true,
  imports: [CommonModule, DatePipe, RsvpButtonsComponent],
  template: `
    <div class="sf-page">
    <div class="sf-card sf-fade-up">
      <div class="sf-header">
        <div class="sf-floral-accent">🌸 🌿 🌸</div>
        <p class="sf-subtitle">Together with joy, we invite</p>
        <p class="sf-greeting">Dear {{ context().guest.display_name }},</p>
      </div>
      <div class="sf-body">
        <h1 class="sf-event-name">{{ context().event.title }}</h1>
        <div class="sf-details">
          <div class="sf-detail-row">
            <span class="sf-detail-icon">📅</span>
            <div>
              <p class="sf-detail-primary">{{ context().event.event_date | date:'EEEE, MMMM d, y' }}</p>
              <p class="sf-detail-secondary">{{ context().event.event_date | date:'shortTime' }}</p>
            </div>
          </div>
          <div class="sf-detail-row">
            <span class="sf-detail-icon">📍</span>
            <div>
              <p class="sf-detail-primary">{{ context().event.location_text }}</p>
              @if (context().event.google_maps_url) {
                <a [href]="context().event.google_maps_url" target="_blank" rel="noopener noreferrer" class="sf-map-link">
                  View on Google Maps →
                </a>
              }
            </div>
          </div>
        </div>
        @if (context().event.show_rsvp !== false) {
          <div class="sf-divider">🌸 🌿 🌸</div>
          <app-rsvp-buttons
            [status]="context().rsvpStatus"
            (rsvpChange)="context().onRsvpChange($event)">
          </app-rsvp-buttons>
          @if (context().rsvpError) {
            <p class="sf-rsvp-error">{{ context().rsvpError }}</p>
          }
        }
      </div>
    </div>
    </div>
  `,
  styleUrl: './soft-floral.template.css'
})
export class SoftFloralTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
}
