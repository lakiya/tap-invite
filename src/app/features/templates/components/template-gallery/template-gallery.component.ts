// src/app/features/templates/components/template-gallery/template-gallery.component.ts
import { Component, input, output } from '@angular/core';
import { TEMPLATE_REGISTRY } from '../../template-registry';

@Component({
  selector: 'app-template-gallery',
  standalone: true,
  templateUrl: './template-gallery.component.html',
  styleUrl:    './template-gallery.component.css'
})
export class TemplateGalleryComponent {
  selectedId       = input.required<string>();
  templateSelected = output<string>();

  readonly templates = TEMPLATE_REGISTRY;

  select(id: string): void {
    this.templateSelected.emit(id);
  }
}
