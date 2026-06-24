import { TestBed } from '@angular/core/testing';
import { InvitationBookletTemplateComponent } from './invitation-booklet.template';
import { TemplateContext, RsvpStatus } from '../template.types';

const mockContext: TemplateContext = {
  event: {
    id: '1', host_id: 'h1', title: 'Test Event',
    event_date: '2026-12-01T18:00:00',
    location_text: 'Test Venue', template_id: 'invitation-booklet',
    google_maps_url: null, notes: null, show_rsvp: true,
  },
  guest: { id: 'g1', event_id: '1', display_name: 'Jane Doe' },
  rsvpStatus: 'Pending' as RsvpStatus,
  rsvpError: null,
  onRsvpChange: () => {},
};

describe('InvitationBookletTemplateComponent – navigate()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [InvitationBookletTemplateComponent] });
  });

  function create() {
    const fixture = TestBed.createComponent(InvitationBookletTemplateComponent);
    fixture.componentRef.setInput('context', mockContext);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('starts in cover state', () => {
    expect(create().state()).toBe('cover');
  });

  it('cover + forward → spread', () => {
    const c = create(); c.navigate('forward');
    expect(c.state()).toBe('spread');
  });

  it('spread + forward → back', () => {
    const c = create(); c.navigate('forward'); c.navigate('forward');
    expect(c.state()).toBe('back');
  });

  it('back + forward → back (no-op)', () => {
    const c = create(); c.navigate('forward'); c.navigate('forward'); c.navigate('forward');
    expect(c.state()).toBe('back');
  });

  it('cover + backward → cover (no-op)', () => {
    const c = create(); c.navigate('backward');
    expect(c.state()).toBe('cover');
  });

  it('spread + backward → cover', () => {
    const c = create(); c.navigate('forward'); c.navigate('backward');
    expect(c.state()).toBe('cover');
  });

  it('back + backward → spread', () => {
    const c = create(); c.navigate('forward'); c.navigate('forward'); c.navigate('backward');
    expect(c.state()).toBe('spread');
  });
});
