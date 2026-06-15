// src/app/features/templates/components/template-renderer/template-renderer.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { Component, input, Type } from '@angular/core';
import { vi } from 'vitest';
import { TemplateRendererComponent, TEMPLATE_MANIFEST_RESOLVER } from './template-renderer.component';
import { TemplateContext, TemplateComponent, TemplateManifest } from '../../template.types';

@Component({ selector: 'app-stub-tpl', standalone: true, template: '<div class="stub-tpl">stub</div>' })
class StubTemplateComponent implements TemplateComponent {
  context = input.required<TemplateContext>();
}

const mockContext: TemplateContext = {
  event: {
    id: 'e1', host_id: 'h1', title: 'Test Event',
    event_date: '2025-07-12T18:00:00', location_text: 'Venue',
    template_id: 'default-minimal', google_maps_url: null,
  },
  guest: { id: 'g1', event_id: 'e1', display_name: 'Alice' },
  rsvpStatus: 'Pending',
  rsvpError: null,
  onRsvpChange: vi.fn(),
};

describe('TemplateRendererComponent', () => {
  it('shows spinner while template is loading', async () => {
    let resolve!: (v: Type<TemplateComponent>) => void;
    const resolverSpy = vi.fn((_id: string): TemplateManifest => ({
      id: 'default-minimal', label: 'Classic', thumbnail: '', tags: [],
      load: () => new Promise(r => { resolve = r as any; }),
    }));

    TestBed.configureTestingModule({
      imports: [TemplateRendererComponent],
      providers: [{ provide: TEMPLATE_MANIFEST_RESOLVER, useValue: resolverSpy }],
    });

    const fixture = TestBed.createComponent(TemplateRendererComponent);
    fixture.componentRef.setInput('context', mockContext);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tpl-spinner')).toBeTruthy();

    resolve(StubTemplateComponent as any);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tpl-spinner')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.stub-tpl')).toBeTruthy();
  });

  it('re-loads when template_id changes', async () => {
    const loadSpy = vi.fn().mockResolvedValue(StubTemplateComponent);
    const resolverSpy = vi.fn((_id: string): TemplateManifest => ({
      id: 'default-minimal', label: 'Classic', thumbnail: '', tags: [],
      load: loadSpy,
    }));

    TestBed.configureTestingModule({
      imports: [TemplateRendererComponent],
      providers: [{ provide: TEMPLATE_MANIFEST_RESOLVER, useValue: resolverSpy }],
    });

    const fixture = TestBed.createComponent(TemplateRendererComponent);
    fixture.componentRef.setInput('context', mockContext);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const updatedContext = { ...mockContext, event: { ...mockContext.event, template_id: 'soft-floral' } };
    fixture.componentRef.setInput('context', updatedContext);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledTimes(2);
  });
});
