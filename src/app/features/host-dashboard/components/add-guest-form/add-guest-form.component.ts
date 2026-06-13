import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../../../core/services/supabase/supabase';

const PHONE_REGEX = /^\+?[\d\s\-()]{7,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-add-guest-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-guest-form.component.html',
  styleUrls: ['./add-guest-form.component.css']
})
export class AddGuestFormComponent {
  @Input() eventId!: string;
  @Output() guestAdded = new EventEmitter<void>();

  private supabase = inject(Supabase);

  name = '';
  phone = '';
  email = '';

  phoneError = signal<string | null>(null);
  emailError = signal<string | null>(null);
  isSubmitting = signal(false);

  validatePhone() {
    if (!this.phone.trim()) { this.phoneError.set(null); return; }
    this.phoneError.set(PHONE_REGEX.test(this.phone.trim()) ? null : 'Enter a valid phone number (e.g. +94 77 234 5678)');
  }

  validateEmail() {
    if (!this.email.trim()) { this.emailError.set(null); return; }
    this.emailError.set(EMAIL_REGEX.test(this.email.trim()) ? null : 'Enter a valid email address');
  }

  canSubmit(): boolean {
    return !!this.name.trim() && !this.phoneError() && !this.emailError();
  }

  async handleSubmit() {
    this.validatePhone();
    this.validateEmail();
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);
    try {
      await this.supabase.addGuest(
        this.eventId,
        this.name.trim(),
        this.phone.trim() || undefined,
        this.email.trim() || undefined
      );
      this.name = '';
      this.phone = '';
      this.email = '';
      this.phoneError.set(null);
      this.emailError.set(null);
      this.guestAdded.emit();
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
