import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'w/:eventId/:guestId',
    renderMode: RenderMode.Server
  },
  {
    // Public live wall, keyed by wallToken; dynamic per-event, cannot be prerendered
    path: 'wall/:eventId/:wallToken',
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
    // Magic link hash/query fragment is client-only; cannot be prerendered
    path: 'auth/callback',
    renderMode: RenderMode.Client
  },
  {
    // Uses document.location.origin to build redirect URL; needs real origin
    path: 'login',
    renderMode: RenderMode.Server
  },
  {
    // Support page that may use document.location
    path: 'magic-link',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
