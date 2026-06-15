import { TestBed } from '@angular/core/testing';
import { TemplateGalleryComponent } from './template-gallery.component';
import { TEMPLATE_REGISTRY } from '../../template-registry';

describe('TemplateGalleryComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TemplateGalleryComponent] });
  });

  it('renders a card for every registered template', () => {
    const fixture = TestBed.createComponent(TemplateGalleryComponent);
    fixture.componentRef.setInput('selectedId', 'default-minimal');
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.gallery-card');
    expect(cards.length).toBe(TEMPLATE_REGISTRY.length);
  });

  it('marks the selected template with the selected class', () => {
    const fixture = TestBed.createComponent(TemplateGalleryComponent);
    fixture.componentRef.setInput('selectedId', 'soft-floral');
    fixture.detectChanges();
    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.gallery-card');
    const selectedIndex = TEMPLATE_REGISTRY.findIndex(t => t.id === 'soft-floral');
    expect(cards[selectedIndex].classList.contains('selected')).toBe(true);
  });

  it('emits templateSelected with the id when a card is clicked', () => {
    const fixture = TestBed.createComponent(TemplateGalleryComponent);
    fixture.componentRef.setInput('selectedId', 'default-minimal');
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.templateSelected.subscribe((id: string) => emitted.push(id));
    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.gallery-card');
    const softFloralIndex = TEMPLATE_REGISTRY.findIndex(t => t.id === 'soft-floral');
    cards[softFloralIndex].click();
    expect(emitted).toEqual(['soft-floral']);
  });
});
