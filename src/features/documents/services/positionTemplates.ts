/**
 * Positionsvorlagen (Addendum 2, Spec 2.2): wiederverwendbare Positionen
 * für den Konfigurator, gespeichert als JSON in app_settings
 * (Key document_position_templates, keine Migration nötig).
 *
 * Seed beim ersten Laden: drei Vorlagen aus der Referenz des Nutzers
 * (docs/assets/referenz-angebot.pdf) – Komplettpaket 590, Onepager 390,
 * Refresh 490. Die Texte folgen der Referenz, ohne Auftrags-Spezifika
 * (gleiche Verallgemeinerung wie die Standard-Bausteine, EA-03);
 * pro Vorlage frei editierbar.
 */
import { getSetting, setSetting } from '@/services/database';
import {
  DocumentPositionTemplateListSchema,
  type DocumentPositionTemplate,
  type LineItem,
  lineItemTotal,
} from '../schemas';

export const DOCUMENT_POSITION_TEMPLATES_SETTING_KEY = 'document_position_templates';

/** Seed-Vorlagen (Texte editierbar, ids entstehen beim Seeden). */
const POSITION_TEMPLATE_SEEDS: Omit<DocumentPositionTemplate, 'id'>[] = [
  {
    name: 'Komplettpaket',
    title: 'Website-Erstellung (Komplettpaket)',
    description:
      'Neuerstellung einer modernen, mobil optimierten Website mit Startseite, ' +
      'Leistungs- und Preisbereich sowie Kontaktbereich. Inklusive Kontaktformular ' +
      'mit Weiterleitung an Ihre E-Mail und technischer Grundoptimierung für die ' +
      'Auffindbarkeit bei Google.',
    unit_price: 590,
    default_quantity: 1,
  },
  {
    name: 'Onepager',
    title: 'Website-Erstellung Onepager',
    description:
      'Einseitige Website mit allen Kerninfos Ihres Unternehmens, vollständig mobil ' +
      'optimiert, mit Kontaktbereich und technischer Grundoptimierung für die ' +
      'Auffindbarkeit bei Google.',
    unit_price: 390,
    default_quantity: 1,
  },
  {
    name: 'Refresh',
    title: 'Website-Refresh',
    description:
      'Modernisierung Ihrer bestehenden Website: Überarbeitung des Designs, ' +
      'vollständige mobile Optimierung und Übernahme Ihrer bestehenden Inhalte.',
    unit_price: 490,
    default_quantity: 1,
  },
];

export function buildSeedPositionTemplates(): DocumentPositionTemplate[] {
  return POSITION_TEMPLATE_SEEDS.map((seed) => ({ id: crypto.randomUUID(), ...seed }));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Liest die Positionsvorlagen. Fehlender Key (erster Start) wird mit den
 * drei Referenz-Vorlagen geseedet und persistiert. Eine bewusst geleerte
 * Liste ([]) bleibt leer – im Gegensatz zu den Baustein-Standards ist
 * "keine Vorlagen" ein gültiger Nutzerzustand. Unlesbare Werte fallen
 * ohne Überschreiben auf den Seed zurück.
 */
export async function getPositionTemplates(): Promise<DocumentPositionTemplate[]> {
  let stored: unknown = null;
  try {
    stored = await getSetting<unknown>(DOCUMENT_POSITION_TEMPLATES_SETTING_KEY);
  } catch (error) {
    console.error('[Documents] Positionsvorlagen unlesbar, nutze Seed', error);
    return buildSeedPositionTemplates();
  }

  if (stored === null) {
    const seeded = buildSeedPositionTemplates();
    try {
      await setSetting(DOCUMENT_POSITION_TEMPLATES_SETTING_KEY, seeded);
    } catch (error) {
      console.error('[Documents] Positionsvorlagen-Seed konnte nicht gespeichert werden', error);
    }
    return seeded;
  }

  const parsed = DocumentPositionTemplateListSchema.safeParse(stored);
  if (!parsed.success) {
    console.error('[Documents] Positionsvorlagen unlesbar, nutze Seed', parsed.error);
    return buildSeedPositionTemplates();
  }
  return parsed.data;
}

export async function savePositionTemplates(
  templates: DocumentPositionTemplate[],
): Promise<DocumentPositionTemplate[]> {
  try {
    const parsed = DocumentPositionTemplateListSchema.parse(templates);
    await setSetting(DOCUMENT_POSITION_TEMPLATES_SETTING_KEY, parsed);
    return parsed;
  } catch (error) {
    throw new Error(`Positionsvorlagen konnten nicht gespeichert werden: ${errorText(error)}`);
  }
}

/**
 * Vorlage → Position (Spec 2.2): Titel wird die erste Beschreibungszeile
 * (polygrid rendert sie fett als Positionstitel, EB-03), Beschreibung
 * folgt darunter. Danach frei editierbar – Änderungen wirken nur im
 * Dokument, nie zurück auf die Vorlage.
 */
export function lineItemFromPositionTemplate(template: DocumentPositionTemplate): LineItem {
  const description = [template.title.trim(), template.description.trim()]
    .filter((part) => part.length > 0)
    .join('\n');
  return {
    description: description || template.name,
    quantity: template.default_quantity,
    unit_price: template.unit_price,
  };
}

/** Anzeige im Vorlagen-Dropdown: Name und Preis der Standard-Menge. */
export function positionTemplatePriceLabel(template: DocumentPositionTemplate): number {
  return lineItemTotal({
    description: template.name || '-',
    quantity: template.default_quantity,
    unit_price: template.unit_price,
  });
}
