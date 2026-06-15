import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminProfile } from '../admin.types';
import { AdminService } from '../admin.service';
import { ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-magic-link-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel-section">
      <h2 class="section-title">✉️ Manual Magic Link Dispatcher</h2>
      <p class="section-sub">Search for a user and send them a fresh magic login link.</p>

      <div class="search-row">
        <input
          type="text"
          class="admin-input search-input"
          placeholder="Search user by email…"
          [(ngModel)]="searchQuery"
        />
      </div>

      @if (filteredProfiles().length > 0) {
        <ul class="profile-list">
          @for (profile of filteredProfiles(); track profile.id) {
            <li class="profile-item">
              <span class="profile-email">{{ profile.email }}</span>
              <button
                class="btn-send"
                [disabled]="sending() === profile.email"
                (click)="sendLink(profile)"
              >{{ sending() === profile.email ? 'Sending…' : 'Send Magic Email' }}</button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .panel-section { background:#1e293b; border-radius:12px; padding:24px; }
    .section-title { color:#f1f5f9; font-size:1rem; font-weight:700; margin:0 0 4px; }
    .section-sub { color:#64748b; font-size:0.8125rem; margin:0 0 16px; }
    .search-row { margin-bottom:12px; }
    .admin-input { background:#0f172a; border:1px solid #334155; border-radius:6px; padding:8px 12px; color:#f1f5f9; font-size:0.875rem; }
    .admin-input:focus { outline:none; border-color:#7c3aed; }
    .search-input { width:100%; max-width:460px; box-sizing:border-box; }
    .profile-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; max-width:560px; }
    .profile-item { display:flex; align-items:center; justify-content:space-between; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:10px 14px; }
    .profile-email { color:#e2e8f0; font-size:0.875rem; }
    .btn-send { background:#7c3aed; color:white; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:0.8125rem; font-weight:600; white-space:nowrap; }
    .btn-send:disabled { background:#475569; cursor:not-allowed; }
  `]
})
export class MagicLinkPanelComponent implements OnInit {
  private adminService = inject(AdminService);
  private toast = inject(ToastService);

  allProfiles = signal<AdminProfile[]>([]);
  searchQuery = '';
  sending = signal<string | null>(null);

  filteredProfiles = computed(() => {
    const q = this.searchQuery.toLowerCase();
    if (q.length < 2) return [];
    return this.allProfiles().filter(p => p.email.toLowerCase().includes(q)).slice(0, 8);
  });

  async ngOnInit() {
    try {
      this.allProfiles.set(await this.adminService.getAllProfiles());
    } catch {
      this.toast.error('Failed to load users.');
    }
  }

  async sendLink(profile: AdminProfile) {
    this.sending.set(profile.email);
    try {
      await this.adminService.sendManualMagicLink(profile.email);
      this.toast.success(`Magic link sent to ${profile.email}`);
      this.searchQuery = '';
    } catch {
      this.toast.error(`Failed to send link to ${profile.email}`);
    } finally {
      this.sending.set(null);
    }
  }
}
