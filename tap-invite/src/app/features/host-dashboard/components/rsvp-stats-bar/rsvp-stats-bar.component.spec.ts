import { TestBed } from '@angular/core/testing';
import { RsvpStatsBarComponent } from './rsvp-stats-bar.component';

function makeGuest(status: string | null) {
  return { rsvps: status ? [{ status }] : [] };
}

describe('RsvpStatsBarComponent — computed counts', () => {
  it('counts each RSVP status correctly', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', [
      makeGuest('Accepted'),
      makeGuest('Accepted'),
      makeGuest('Declined'),
      makeGuest(null),
    ]);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.accepted()).toBe(2);
    expect(c.declined()).toBe(1);
    expect(c.tentative()).toBe(0);
    expect(c.pending()).toBe(1);
  });

  it('counts tentative guests', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', [makeGuest('Tentative'), makeGuest('Tentative')]);
    fixture.detectChanges();
    expect(fixture.componentInstance.tentative()).toBe(2);
  });

  it('treats empty rsvps array as pending', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', [makeGuest(null), makeGuest('Pending')]);
    fixture.detectChanges();
    expect(fixture.componentInstance.pending()).toBe(2);
  });

  it('returns all zeros for empty guest list', () => {
    const fixture = TestBed.createComponent(RsvpStatsBarComponent);
    fixture.componentRef.setInput('guests', []);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.accepted()).toBe(0);
    expect(c.declined()).toBe(0);
    expect(c.tentative()).toBe(0);
    expect(c.pending()).toBe(0);
  });
});
