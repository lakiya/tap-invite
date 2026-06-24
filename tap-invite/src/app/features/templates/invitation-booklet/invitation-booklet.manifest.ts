import { TemplateManifest } from '../template.types';

export const invitationBookletManifest: TemplateManifest = {
  id: 'invitation-booklet',
  label: 'Invitation Booklet',
  thumbnail: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="213"><rect width="160" height="213" fill="%23fffaf4" rx="6"/><rect x="10" y="10" width="140" height="193" fill="none" stroke="%23c9a84c" stroke-width="0.7" rx="4" opacity="0.35"/><rect x="78" y="10" width="4" height="193" fill="%23c9a84c" opacity="0.25"/><rect x="24" y="70" width="50" height="6" rx="3" fill="%233a2e1e" opacity="0.4"/><rect x="24" y="82" width="36" height="4" rx="2" fill="%237a6a52" opacity="0.3"/><rect x="86" y="70" width="50" height="6" rx="3" fill="%233a2e1e" opacity="0.4"/><rect x="86" y="82" width="36" height="4" rx="2" fill="%237a6a52" opacity="0.3"/><circle cx="56" cy="175" r="3" fill="%23c9a84c" opacity="0.35"/><circle cx="80" cy="175" r="3" fill="%23c9a84c" opacity="0.7"/><circle cx="104" cy="175" r="3" fill="%23c9a84c" opacity="0.35"/></svg>`,
  tags: ['booklet', 'elegant', 'wedding'],
  load: () =>
    import('./invitation-booklet.template').then(m => m.InvitationBookletTemplateComponent),
};
