// src/app/features/templates/soft-floral/soft-floral.manifest.ts
import { TemplateManifest } from '../template.types';

export const softFloralManifest: TemplateManifest = {
  id: 'soft-floral',
  label: 'Soft Floral',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="213"><rect width="160" height="213" fill="%23fdf6f0" rx="6"/><rect width="160" height="58" fill="%23f0c4b0" rx="6"/><rect y="52" width="160" height="6" fill="%23f0c4b0"/><rect x="44" y="10" width="72" height="10" rx="5" fill="%23e8a87c" opacity="0.5"/><rect x="28" y="26" width="104" height="7" rx="3.5" fill="%235c2d0e" opacity="0.35"/><rect x="22" y="38" width="116" height="9" rx="4.5" fill="%235c2d0e" opacity="0.55"/><rect x="28" y="74" width="104" height="10" rx="5" fill="%235c2d0e" opacity="0.7"/><rect x="20" y="98" width="14" height="14" rx="3" fill="%23e8a87c" opacity="0.5"/><rect x="40" y="101" width="82" height="6" rx="3" fill="%23f0d9cc"/><rect x="40" y="111" width="55" height="5" rx="2.5" fill="%23f0d9cc" opacity="0.7"/><rect x="20" y="126" width="14" height="14" rx="3" fill="%23e8a87c" opacity="0.5"/><rect x="40" y="129" width="90" height="6" rx="3" fill="%23f0d9cc"/><rect x="40" y="139" width="62" height="5" rx="2.5" fill="%23f0d9cc" opacity="0.7"/><rect x="20" y="156" width="120" height="1" fill="%23f0d9cc"/><rect x="12" y="165" width="66" height="24" rx="12" fill="%23e8a87c"/><rect x="86" y="165" width="62" height="24" rx="12" fill="%23f0d9cc"/></svg>`,
  tags: ['floral', 'romantic'],
  load: () =>
    import('./soft-floral.template').then(m => m.SoftFloralTemplateComponent),
};
