import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-event-public',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './event-public.component.html',
  styleUrls: ['./event-public.component.css'],
})
export class EventPublicPageComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private supabase = inject(Supabase);

  isLoading  = signal(true);
  event      = signal<any>(null);
  isDisabled = signal(false);
  hasError   = signal(false);

  async ngOnInit() {
    const eventId = this.route.snapshot.paramMap.get('eventId');
    if (!eventId) { this.hasError.set(true); this.isLoading.set(false); return; }
    try {
      const { data, error } = await this.supabase.client
        .from('events').select('id, title, event_date, location_text, is_enabled').eq('id', eventId).single();
      if (error || !data) throw new Error('not found');
      this.event.set(data);
      this.isDisabled.set(data.is_enabled === false);
    } catch {
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
