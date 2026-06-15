// src/app/features/guest-view/components/rsvp-buttons/rsvp-buttons.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RsvpStatus } from '../../../../features/templates/template.types';

export type { RsvpStatus };

@Component({
  selector: 'app-rsvp-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rsvp-buttons.component.html',
  styleUrls: ['./rsvp-buttons.component.css']
})
export class RsvpButtonsComponent {
  @Input() status: RsvpStatus = 'Pending';
  @Output() rsvpChange = new EventEmitter<RsvpStatus>();
}
