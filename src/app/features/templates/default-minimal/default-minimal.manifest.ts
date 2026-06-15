// src/app/features/templates/default-minimal/default-minimal.manifest.ts
import { TemplateManifest } from '../template.types';

export const defaultMinimalManifest: TemplateManifest = {
  id: 'default-minimal',
  label: 'Classic',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="%23f8fafc" rx="6"/><rect width="160" height="36" fill="%230ea5e9" rx="6"/><rect y="28" width="160" height="8" fill="%230ea5e9"/><rect x="10" y="44" width="90" height="6" rx="3" fill="%23e2e8f0"/><rect x="10" y="56" width="60" height="6" rx="3" fill="%23e2e8f0"/><rect x="10" y="72" width="60" height="16" rx="8" fill="%230ea5e9"/><rect x="78" y="72" width="50" height="16" rx="8" fill="%23e2e8f0"/></svg>`,
  tags: ['minimal', 'classic'],
  load: () =>
    import('./default-minimal.template').then(m => m.DefaultMinimalTemplateComponent),
};
