import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'w/:eventId/:guestId',
    loadComponent: () => import('./features/guest-view/components/guest-view.component').then(c => c.GuestViewComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/host-dashboard/components/host-dashboard.component').then(c => c.HostDashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(c => c.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(c => c.LandingComponent)
  },
  { path: '**', redirectTo: '' }
];