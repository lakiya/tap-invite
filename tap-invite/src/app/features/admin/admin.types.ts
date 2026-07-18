// src/app/features/admin/admin.types.ts
export type EventStatus = 'Upcoming' | 'Ongoing' | 'Passed' | 'Disabled';

export interface AdminEvent {
  id: string;
  title: string;
  event_date: string;
  location_text: string;
  google_maps_url: string | null;
  is_enabled: boolean;
  is_premium: boolean;
  wall_token: string;
  host_id: string;
  created_at: string;
  hostEmail: string;
  computedStatus: EventStatus;
}

export interface AdminProfile {
  id: string;
  email: string;
  role: 'user' | 'super_admin';
  created_at: string;
}

export interface EventEditFields {
  title?: string;
  event_date?: string;
  location_text?: string;
  google_maps_url?: string | null;
}

export interface AdminGuest {
  id: string;
  event_id: string;
  display_name: string;
  phone_number: string | null;
  email: string | null;
}
