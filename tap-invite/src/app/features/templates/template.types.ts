// src/app/features/templates/template.types.ts
import { InputSignal, Type } from '@angular/core';

export type RsvpStatus = 'Pending' | 'Accepted' | 'Declined' | 'Tentative';

export interface EventData {
  id: string;
  host_id: string;
  title: string;
  event_date: string;
  location_text: string;
  template_id: string;
  google_maps_url?: string | null;
  notes?: string | null;
  show_rsvp: boolean;
  is_premium: boolean;
  wall_token: string;
}

export interface GuestData {
  id: string;
  event_id: string;
  display_name: string;
  phone_number?: string | null;
  email?: string | null;
}

export interface TemplateContext {
  event: EventData;
  guest: GuestData;
  rsvpStatus: RsvpStatus;
  rsvpError: string | null;
  onRsvpChange: (status: RsvpStatus) => void;
}

export interface TemplateComponent {
  context: InputSignal<TemplateContext>;
}

export interface TemplateManifest {
  id: string;
  label: string;
  /** SVG data URI for gallery thumbnail. */
  thumbnail: string;
  tags: string[];
  load: () => Promise<Type<TemplateComponent>>;
}
