import { TemplateManifest } from './template.types';
import { defaultMinimalManifest }     from './default-minimal/default-minimal.manifest';
import { softFloralManifest }         from './soft-floral/soft-floral.manifest';
import { flipCardManifest }           from './flip-card/flip-card.manifest';
import { weddingBookManifest }        from './wedding-book/wedding-book.manifest';
import { invitationBookletManifest }  from './invitation-booklet/invitation-booklet.manifest';

export const TEMPLATE_REGISTRY: TemplateManifest[] = [
  defaultMinimalManifest,
  softFloralManifest,
  flipCardManifest,
  weddingBookManifest,
  invitationBookletManifest,
];

export function getManifest(id: string): TemplateManifest {
  return TEMPLATE_REGISTRY.find(m => m.id === id) ?? TEMPLATE_REGISTRY[0];
}
