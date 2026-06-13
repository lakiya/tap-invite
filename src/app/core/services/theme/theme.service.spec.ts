import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from './theme.service';

// jsdom does not implement window.matchMedia — provide a stub
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(ThemeService);
  });

  it('starts in light mode when no localStorage value', () => {
    expect(service.isDark()).toBeFalsy();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('toggle() switches to dark mode and sets attribute', () => {
    service.toggle();
    expect(service.isDark()).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle() persists choice to localStorage', () => {
    service.toggle();
    expect(localStorage.getItem('tapinvite-theme')).toBe('dark');
  });

  it('toggle() twice returns to light mode', () => {
    service.toggle();
    service.toggle();
    expect(service.isDark()).toBeFalsy();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('reads stored dark preference on init', () => {
    localStorage.setItem('tapinvite-theme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    const fresh: ThemeService = TestBed.inject(ThemeService);
    expect(fresh.isDark()).toBeTruthy();
  });
});
