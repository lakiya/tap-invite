import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Supabase } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  template: `
    <main class="login-page">
      <div class="login-card">

        <div class="logo-mark">T</div>
        <h1 class="login-title">Welcome back</h1>
        <p class="login-sub">Enter your email to receive a secure magic link.</p>

        @if (!isSent()) {
          <form (ngSubmit)="handleLogin()">
            <div class="field-group">
              <label class="field-label">Email address</label>
              <input
                class="field-input"
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="you@example.com"
                [disabled]="isLoading()"
                autocomplete="email"
              />
            </div>
            <button class="submit-btn" type="submit" [disabled]="isLoading() || !email">
              {{ isLoading() ? 'Sending…' : '✉ Send Magic Link' }}
            </button>
          </form>
          @if (loginError()) {
            <p class="login-error">{{ loginError() }}</p>
          }
          <a routerLink="/" class="back-link">← Back to home</a>
        } @else {
          <div class="sent-card">
            <div class="sent-icon">✅</div>
            <h2 class="sent-title">Check your inbox!</h2>
            <p class="sent-sub">We sent a secure link to</p>
            <span class="email-chip">{{ email }}</span>
            <p class="sent-note">Link expires in 48 hours.</p>
            <button type="button" class="resend-btn" (click)="handleLogin()">Resend link</button>
          </div>
        }

      </div>
    </main>
  `,
  styles: [`
    .login-page {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--color-bg);
      padding: 24px;
    }

    .login-card {
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

    .login-title {
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 8px;
      letter-spacing: -0.02em;
    }

    .login-sub {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin: 0 0 28px;
    }

    .field-group { text-align: left; margin-bottom: 16px; }

    .field-label {
      display: block;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: 6px;
    }

    .field-input {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid var(--color-border);
      border-radius: 10px;
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }

    .field-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
    }

    .submit-btn {
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-accent), var(--color-accent-dark));
      color: white;
      font-size: 0.95rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: opacity 0.15s;
      box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
      margin-top: 4px;
    }

    .submit-btn:hover:not(:disabled) { opacity: 0.92; }
    .submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }

    .login-error {
      font-size: 0.82rem;
      color: var(--color-error);
      margin: 10px 0 0;
      text-align: center;
    }

    .back-link {
      display: inline-block;
      margin-top: 20px;
      font-size: 0.83rem;
      color: var(--color-text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }

    .back-link:hover { color: var(--color-primary); }

    .sent-card { padding: 8px 0; }

    .sent-icon { font-size: 2.5rem; margin-bottom: 14px; }

    .sent-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 8px;
    }

    .sent-sub {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin: 0 0 10px;
    }

    .email-chip {
      display: inline-block;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 99px;
      padding: 4px 14px;
      font-size: 0.83rem;
      font-weight: 600;
      color: var(--color-primary);
    }

    .sent-note {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin: 12px 0 16px;
    }

    .resend-btn {
      background: none;
      border: none;
      color: var(--color-primary);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  `]
})
export class LoginComponent {
  private supabase = inject(Supabase);
  private document = inject(DOCUMENT);

  email = '';
  isLoading = signal(false);
  isSent = signal(false);
  loginError = signal<string | null>(null);

  async handleLogin() {
    if (!this.email) return;
    this.loginError.set(null);
    try {
      this.isLoading.set(true);
      await this.supabase.signInWithMagicLink(this.email, `${this.document.location.origin}/auth/callback`);
      this.isSent.set(true);
    } catch (error) {
      console.error('Login error:', error);
      this.loginError.set('Failed to send magic link. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}