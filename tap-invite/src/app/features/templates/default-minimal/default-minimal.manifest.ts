// src/app/features/templates/default-minimal/default-minimal.manifest.ts
import { TemplateManifest } from '../template.types';

export const defaultMinimalManifest: TemplateManifest = {
  id: 'default-minimal',
  label: 'Classic',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="213"><rect width="160" height="213" fill="%23f8fafc" rx="6"/><rect width="160" height="58" fill="%230ea5e9" rx="6"/><rect y="52" width="160" height="6" fill="%230ea5e9"/><rect x="44" y="13" width="72" height="12" rx="6" fill="%23ffffff" opacity="0.25"/><rect x="20" y="33" width="90" height="8" rx="4" fill="%23ffffff" opacity="0.65"/><rect x="28" y="74" width="104" height="10" rx="5" fill="%230f172a"/><rect x="20" y="98" width="14" height="14" rx="3" fill="%230ea5e9" opacity="0.35"/><rect x="40" y="101" width="82" height="6" rx="3" fill="%23e2e8f0"/><rect x="40" y="111" width="55" height="5" rx="2.5" fill="%23e2e8f0" opacity="0.7"/><rect x="20" y="126" width="14" height="14" rx="3" fill="%230ea5e9" opacity="0.35"/><rect x="40" y="129" width="90" height="6" rx="3" fill="%23e2e8f0"/><rect x="40" y="139" width="62" height="5" rx="2.5" fill="%23e2e8f0" opacity="0.7"/><rect x="20" y="156" width="120" height="1" fill="%23e2e8f0"/><rect x="12" y="165" width="62" height="24" rx="12" fill="%230ea5e9"/><rect x="82" y="165" width="66" height="24" rx="12" fill="%23e2e8f0"/></svg>`,
  tags: ['minimal', 'classic'],
  load: () =>
    import('./default-minimal.template').then(m => m.DefaultMinimalTemplateComponent),
};
