// src/app/features/templates/template-registry.ts
import { TemplateManifest } from './template.types';
import { defaultMinimalManifest } from './default-minimal/default-minimal.manifest';
import { softFloralManifest }     from './soft-floral/soft-floral.manifest';
import { flipCardManifest }        from './flip-card/flip-card.manifest';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [
  defaultMinimalManifest,
  softFloralManifest,
  flipCardManifest,
];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
