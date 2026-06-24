import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';
import { EventGridComponent } from './components/event-grid.component';
import { MagicLinkPanelComponent } from './components/magic-link-panel.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [EventGridComponent, MagicLinkPanelComponent],
  template: `
    <div class="admin-shell">
      <nav class="admin-nav">
        <span class="admin-nav__brand">⚡ Admin Command Center</span>
        <button class="admin-nav__signout" (click)="signOut()">Sign Out</button>
      </nav>
      <main class="admin-main">
        <app-event-grid />
        <app-magic-link-panel />
      </main>
    </div>
  `,
  styles: [`
    .admin-shell { min-height:100vh; background:#0f172a; color:#f1f5f9; font-family:inherit; }
    .admin-nav { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; background:#1e293b; border-bottom:1px solid #334155; position:sticky; top:0; z-index:10; }
    .admin-nav__brand { font-weight:700; font-size:1rem; color:#a78bfa; }
    .admin-nav__signout { background:none; border:1px solid #475569; color:#94a3b8; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:0.8rem; transition:color 0.15s,border-color 0.15s; }
    .admin-nav__signout:hover { color:#f1f5f9; border-color:#94a3b8; }
    .admin-main { padding:24px; max-width:1400px; margin:0 auto; display:flex; flex-direction:column; gap:24px; }
  `]
})
export class AdminDashboardComponent {
  private supabase = inject(Supabase);
  private router = inject(Router);

  async signOut() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
