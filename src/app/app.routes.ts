import { Routes } from '@angular/router';

export const routes: Routes = [
  // The Magic Link Route for Guests (e.g., tapinvite.lk/w/event-id/guest-id)
  { 
    path: 'w/:eventId/:guestId', 
    loadComponent: () => import('./features/guest-view/guest-view.component').then(c => c.GuestViewComponent) 
  },

  // Host Dashboard (Lazy loaded for Kamal)
  { 
    path: 'dashboard', 
    loadComponent: () => import('./features/host-dashboard/host-dashboard.component').then(c => c.HostDashboardComponent),
  },

  // Landing Page fallback
  { 
    path: '', 
    loadComponent: () => import('./features/landing/landing.component').then(c => c.LandingComponent) 
  },
  
  // Catch-all
  { path: '**', redirectTo: '' }
];