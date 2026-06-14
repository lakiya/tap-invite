import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [RouterModule],
  template: `
    <main class="callback-page">
      <div class="callback-card">
        <div class="logo-mark">T</div>
        @if (errorMessage()) {
          <h2 class="error-title">Link Expired</h2>
          <p class="error-sub">{{ errorMessage() }}</p>
          <a routerLink="/login" class="retry-btn">Request a new link</a>
        } @else {
          <div class="spinner"></div>
          <p class="loading-text">Signing you in…</p>
        }
      </div>
    </main>
  `,
  styles: [`
    .callback-page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--color-bg);
      padding: 24px;
    }

    .callback-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 20px;
      padding: 40px 36px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
      text-align: center;
    }

    .logo-mark {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
      color: white;
      font-size: 1.3rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .loading-text {
      font-size: 0.9rem;
      color: var(--color-text-muted);
      margin: 0;
    }

    .error-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 10px;
    }

    .error-sub {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin: 0 0 24px;
    }

    .retry-btn {
      display: inline-block;
      padding: 12px 28px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-accent), var(--color-accent-dark));
      color: white;
      font-size: 0.9rem;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
      transition: opacity 0.15s;
    }

    .retry-btn:hover { opacity: 0.9; }
  `]
})
export class AuthCallbackComponent implements OnInit, OnDestroy {
  private supabase = inject(Supabase);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);

  errorMessage = signal<string | null>(null);
  private authSubscription: { unsubscribe: () => void } | null = null;

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const params = new URLSearchParams(this.document.location.hash.substring(1));
    const error = params.get('error');

    if (error) {
      const description = params.get('error_description') ?? 'The magic link has expired or already been used.';
      this.errorMessage.set(description.replace(/\+/g, ' '));
      return;
    }

    // No hash at all — redirect to login rather than spinning forever
    if (!this.document.location.hash) {
      this.router.navigate(['/login']);
      return;
    }

    let navigated = false;
    const navigate = () => {
      if (!navigated) {
        navigated = true;
        this.router.navigate(['/dashboard']);
      }
    };

    const { data: { subscription } } = this.supabase.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) navigate();
    });
    this.authSubscription = subscription;

    const { data: { session } } = await this.supabase.client.auth.getSession();
    if (session) {
      navigate();
      return;
    }

    // Fallback: if supabase-js never fires SIGNED_IN (e.g. consumed token), redirect after 8s
    setTimeout(() => {
      if (!navigated) {
        this.errorMessage.set('Sign-in timed out. Please request a new link.');
      }
    }, 8000);
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
  }
}
