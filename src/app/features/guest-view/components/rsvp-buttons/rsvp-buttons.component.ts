import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type RsvpStatus = 'Pending' | 'Accepted' | 'Declined' | 'Tentative';

@Component({
  selector: 'app-rsvp-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rsvp-buttons.component.html',
  styleUrls: ['./rsvp-buttons.component.css']
})
export class RsvpButtonsComponent {
  @Input() status: RsvpStatus = 'Pending';
  @Output() rsvpChange = new EventEmitter<'Accepted' | 'Declined' | 'Tentative'>();
}
