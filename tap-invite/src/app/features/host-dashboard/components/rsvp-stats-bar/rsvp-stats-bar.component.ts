import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-rsvp-stats-bar',
  standalone: true,
  imports: [],
  templateUrl: './rsvp-stats-bar.component.html',
  styleUrls: ['./rsvp-stats-bar.component.css'],
})
export class RsvpStatsBarComponent {
  guests = input<any[]>([]);

  accepted  = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Accepted').length);
  declined  = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Declined').length);
  tentative = computed(() => this.guests().filter(g => g.rsvps?.[0]?.status === 'Tentative').length);
  pending   = computed(() =>
    this.guests().filter(g => !g.rsvps?.length || g.rsvps[0].status === 'Pending').length
  );
}
