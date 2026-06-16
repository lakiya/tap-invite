import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'w/:eventId/:guestId',
    renderMode: RenderMode.Server
  },
  {
    // Auth guard reads localStorage; must run client-side only
    path: 'dashboard',
    renderMode: RenderMode.Client
  },
  {
    // Auth guard reads localStorage; must run client-side only
    path: 'admin',
    renderMode: RenderMode.Client
  },
  {
    // Magic link hash fragment is client-only; cannot be prerendered
    path: 'auth/callback',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
