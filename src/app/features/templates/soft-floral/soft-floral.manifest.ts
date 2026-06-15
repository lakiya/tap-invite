// src/app/features/templates/soft-floral/soft-floral.manifest.ts
import { TemplateManifest } from '../template.types';

export const softFloralManifest: TemplateManifest = {
  id: 'soft-floral',
  label: 'Soft Floral',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="%23fdf6f0" rx="6"/><rect width="160" height="36" fill="%23f0c4b0" rx="6"/><rect y="28" width="160" height="8" fill="%23f0c4b0"/><rect x="10" y="44" width="90" height="6" rx="3" fill="%23f0d9cc"/><rect x="10" y="56" width="60" height="6" rx="3" fill="%23f0d9cc"/><rect x="10" y="72" width="65" height="16" rx="8" fill="%23e8a87c"/><rect x="83" y="72" width="50" height="16" rx="8" fill="%23f0d9cc"/></svg>`,
  tags: ['floral', 'romantic'],
  load: () =>
    import('./soft-floral.template').then(m => m.SoftFloralTemplateComponent),
};
