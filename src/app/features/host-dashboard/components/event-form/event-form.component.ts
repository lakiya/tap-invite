import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../../../core/services/supabase/supabase';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form.component.html',
  styleUrls: ['./event-form.component.css']
})
export class EventFormComponent {
  @Input() hostId!: string;
  @Output() eventCreated = new EventEmitter<any>();

  private supabase = inject(Supabase);

  isSubmitting = signal(false);
  fields = { title: '', date: '', location: '' };

  async handleSubmit() {
    if (!this.fields.title.trim()) return;
    this.isSubmitting.set(true);
    try {
      const event = await this.supabase.createEvent(
        this.hostId,
        this.fields.title,
        this.fields.date,
        this.fields.location
      );
      this.eventCreated.emit(event);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
