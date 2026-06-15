// src/app/features/templates/components/template-renderer/template-renderer.component.ts
import { Component, computed, effect, inject, InjectionToken, input, signal, Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TemplateContext, TemplateComponent, TemplateManifest } from '../../template.types';
import { getManifest } from '../../template-registry';

/** Injection token for the manifest resolver — swap in tests for a stub. */
export const TEMPLATE_MANIFEST_RESOLVER = new InjectionToken<(id: string) => TemplateManifest>(
  'TEMPLATE_MANIFEST_RESOLVER',
  { providedIn: 'root', factory: () => getManifest }
);

@Component({
  selector: 'app-template-renderer',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `
    @if (!templateComp()) {
      <div class="tpl-loading">
        <div class="tpl-spinner"></div>
      </div>
    } @else {
      <ng-container
        [ngComponentOutlet]="templateComp()!"
        [ngComponentOutletInputs]="templateInputs()">
      </ng-container>
    }
  `,
  styleUrl: './template-renderer.component.css'
})
export class TemplateRendererComponent {
  context = input.required<TemplateContext>();

  templateComp   = signal<Type<TemplateComponent> | null>(null);
  templateInputs = computed(() => ({ context: this.context() }));

  private templateId     = computed(() => this.context().event.template_id);
  private manifestResolver = inject(TEMPLATE_MANIFEST_RESOLVER);

  constructor() {
    effect(() => {
      const id = this.templateId();
      this.templateComp.set(null);
      this.manifestResolver(id).load().then(comp => this.templateComp.set(comp));
    });
  }
}
