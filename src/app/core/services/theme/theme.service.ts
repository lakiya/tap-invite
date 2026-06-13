import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'tapinvite-theme';

  isDark = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'dark') {
      this.applyDark(true);
    } else if (stored === null) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) this.applyDark(true);
    }
  }

  toggle(): void {
    this.applyDark(!this.isDark());
  }

  private applyDark(dark: boolean): void {
    this.isDark.set(dark);
    if (isPlatformBrowser(this.platformId)) {
      if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
    }
  }
}
