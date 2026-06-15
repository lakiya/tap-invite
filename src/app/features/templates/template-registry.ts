// src/app/features/templates/template-registry.ts
import { TemplateManifest } from './template.types';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
