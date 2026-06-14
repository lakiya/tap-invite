import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterModule, HeaderComponent],
  template: `
    <app-header variant="landing"></app-header>

    <main class="landing-main">

      <!-- Hero -->
      <section class="hero">
        <div class="hero-glow glow-1"></div>
        <div class="hero-glow glow-2"></div>
        <div class="hero-inner">
          <span class="eyebrow">
            <span class="pulse-dot"></span>
            Now in Beta
          </span>
          <h1 class="hero-title">
            Invitations that<br><span class="accent">make an impression</span>
          </h1>
          <p class="hero-sub">
            One-tap RSVP links. Real-time responses. Premium design your guests will love.
          </p>
          <div class="hero-ctas">
            <a routerLink="/login" class="cta-primary">Get Started Free →</a>
            <a href="#features" class="cta-ghost">See how it works</a>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features" id="features">
        <div class="features-inner">
          <div class="feature-card">
            <div class="feat-icon feat-blue">🔗</div>
            <h3>One-tap RSVP</h3>
            <p>Guests tap a link and respond instantly — no app, no account needed.</p>
          </div>
          <div class="feature-card">
            <div class="feat-icon feat-orange">⚡</div>
            <h3>Real-time updates</h3>
            <p>Watch your guest list fill up live. Updates the moment guests respond.</p>
          </div>
          <div class="feature-card">
            <div class="feat-icon feat-teal">🎨</div>
            <h3>Premium look</h3>
            <p>Beautifully designed invitations that impress from the first tap.</p>
          </div>
        </div>
      </section>

    </main>

    <!-- Footer -->
    <footer class="site-footer">
      <div class="footer-inner">
        <span class="footer-logo">TapInvite</span>
        <span class="footer-copy">© 2026 TapInvite. All rights reserved.</span>
        <a routerLink="/login" class="footer-cta">Create Your Event →</a>
      </div>
    </footer>
  `,
  styles: [`
    .landing-main { overflow: hidden; }

    .hero {
      position: relative;
      padding: 96px 24px 80px;
      text-align: center;
      overflow: hidden;
    }

    .hero-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }

    .hero-glow.glow-1 {
      width: 500px; height: 500px;
      background: rgba(14, 165, 233, 0.12);
      top: -100px; left: 50%; transform: translateX(-60%);
    }

    .hero-glow.glow-2 {
      width: 300px; height: 300px;
      background: rgba(249, 115, 22, 0.08);
      bottom: 0; right: 10%;
    }

    .hero-inner {
      position: relative;
      max-width: 680px;
      margin: 0 auto;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 99px;
      padding: 6px 16px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: 24px;
    }

    .pulse-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.6; transform: scale(1.3); }
    }

    .hero-title {
      font-size: clamp(2rem, 5vw, 3.2rem);
      font-weight: 800;
      color: var(--color-text);
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin: 0 0 20px;
    }

    .accent { color: var(--color-primary); }

    .hero-sub {
      font-size: 1.05rem;
      color: var(--color-text-muted);
      max-width: 500px;
      margin: 0 auto 36px;
      line-height: 1.65;
    }

    .hero-ctas {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .cta-primary {
      padding: 13px 28px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-accent), #ea6c06);
      color: white;
      font-weight: 700;
      font-size: 0.95rem;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(249, 115, 22, 0.35);
      transition: opacity 0.15s;
    }

    .cta-primary:hover { opacity: 0.9; }

    .cta-ghost {
      padding: 13px 24px;
      border-radius: 12px;
      border: 1.5px solid var(--color-border);
      color: var(--color-text-muted);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      transition: border-color 0.15s, color 0.15s;
    }

    .cta-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .features { padding: 64px 24px 80px; }

    .features-inner {
      max-width: 900px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }

    .feature-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 18px;
      padding: 28px 24px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
    }

    .feat-icon {
      width: 48px; height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      margin-bottom: 16px;
    }

    .feat-blue   { background: rgba(14,165,233,0.12); }
    .feat-orange { background: rgba(249,115,22,0.12); }
    .feat-teal   { background: rgba(20,184,166,0.12); }

    .feature-card h3 {
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-text);
      margin: 0 0 8px;
    }

    .feature-card p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.6;
      margin: 0;
    }

    .site-footer {
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      padding: 24px;
    }

    .footer-inner {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .footer-logo { font-weight: 800; color: var(--color-text); }

    .footer-copy { font-size: 0.8rem; color: var(--color-text-muted); }

    .footer-cta {
      padding: 8px 18px;
      border-radius: 10px;
      background: var(--color-primary);
      color: white;
      font-size: 0.83rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }

    .footer-cta:hover { background: var(--color-primary-dark); }
  `]
})
export class LandingComponent {}
