/**
 * Unit-Tests Snapshot-Komposition und Variablenersetzung (Auftrag 1b):
 * zentrale Wertetabelle inkl. iban/bic, Erkennung unaufgelöster Variablen
 * und Ersetzung im Snapshot-Compose (kein rohes {{...}} im Ergebnis).
 */
import { describe, expect, it } from 'vitest';
import type { ContentBlock, SnapshotIssuer } from '../schemas';
import {
  buildDocumentVariableValues,
  collectContentBlockTexts,
  composeDocumentSnapshot,
  findUnresolvedDocumentVariables,
  resolveDocumentVariables,
} from './composeSnapshot';

const ISSUER: SnapshotIssuer = {
  company_name: 'PolyGrid Studio',
  owner_name: 'Marco Kromer',
  street: 'Musterstraße 1',
  zip: '12345',
  city: 'Musterstadt',
  tax_number: '12/345/67890',
  vat_id: '',
  iban: 'DE02120300000000202051',
  bic: 'BYLADEM1001',
  bank_name: 'Testbank',
  email: 'kontakt@polygrid.example',
  phone: '',
  website: '',
};

function buildValues(overrides: Partial<SnapshotIssuer> = {}) {
  return buildDocumentVariableValues({
    issuer: { ...ISSUER, ...overrides },
    clientName: 'Malerbetrieb Weber',
    projectName: 'Relaunch Weber',
    issueDateFormatted: '10.07.2026',
    paymentTermsDays: 14,
    validUntilFormatted: null,
  });
}

describe('buildDocumentVariableValues', () => {
  it('liefert alle Bausteinvariablen inkl. iban, bic, bank und kontoinhaber', () => {
    expect(buildValues()).toEqual({
      kundenname: 'Malerbetrieb Weber',
      projektname: 'Relaunch Weber',
      firmenname: 'PolyGrid Studio',
      datum: '10.07.2026',
      zahlungsziel_tage: '14',
      iban: 'DE02120300000000202051',
      bic: 'BYLADEM1001',
      bank: 'Testbank',
      kontoinhaber: 'Marco Kromer',
      gueltig_bis: null,
    });
  });
});

describe('resolveDocumentVariables', () => {
  it('ersetzt {{iban}} und {{bic}} in Zahlungsbedingungen', () => {
    const resolved = resolveDocumentVariables(
      'Zahlbar per Überweisung: IBAN {{iban}}, BIC {{bic}} bei {{bank}}.',
      buildValues(),
    );
    expect(resolved).toBe(
      'Zahlbar per Überweisung: IBAN DE02120300000000202051, BIC BYLADEM1001 bei Testbank.',
    );
  });

  it('ist tolerant gegenüber Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(resolveDocumentVariables('{{ IBAN }} / {{Bic}}', buildValues())).toBe(
      'DE02120300000000202051 / BYLADEM1001',
    );
  });

  it('lässt Variablen ohne Wert sichtbar stehen', () => {
    expect(resolveDocumentVariables('IBAN {{iban}}', buildValues({ iban: '' }))).toBe(
      'IBAN {{iban}}',
    );
  });
});

describe('findUnresolvedDocumentVariables', () => {
  it('meldet Variablen mit leerem Wert über alle Bausteine, ohne Duplikate', () => {
    const unresolved = findUnresolvedDocumentVariables(
      ['Hallo {{kundenname}}, IBAN {{iban}}', 'BIC {{bic}} und nochmal {{iban}}'],
      buildValues({ iban: '', bic: '' }),
    );
    expect(unresolved).toEqual(['iban', 'bic']);
  });

  it('meldet unbekannte Variablen', () => {
    expect(findUnresolvedDocumentVariables(['{{zahlungsziel}}'], buildValues())).toEqual([
      'zahlungsziel',
    ]);
  });

  it('meldet nichts, wenn alle Werte vorhanden sind (null-Texte erlaubt)', () => {
    expect(
      findUnresolvedDocumentVariables([null, 'IBAN {{iban}}, BIC {{bic}}'], buildValues()),
    ).toEqual([]);
  });
});

describe('collectContentBlockTexts + Bausteine (Addendum-Integration)', () => {
  const paymentBlock: ContentBlock = {
    id: 'b1',
    kind: 'payment_terms',
    title: 'Zahlungsbedingungen',
    body_type: 'paragraph',
    text: 'IBAN {{iban}}, BIC {{bic}}, Kontoinhaber {{kontoinhaber}}',
    items: [],
    enabled: true,
  };
  const disabledBlock: ContentBlock = {
    id: 'b2',
    kind: 'custom',
    title: 'Deaktiviert {{iban}}',
    body_type: 'paragraph',
    text: 'Sollte nicht gescannt werden {{unbekannt}}',
    items: [],
    enabled: false,
  };

  it('sammelt nur Texte aktivierter Bausteine (und aktivierter Stichpunkte)', () => {
    const withBullets: ContentBlock = {
      id: 'b3',
      kind: 'included',
      title: 'Enthalten',
      body_type: 'bullets',
      text: '',
      items: [
        { text: 'Aktiver Punkt {{firmenname}}', enabled: true },
        { text: 'Inaktiver Punkt {{iban}}', enabled: false },
      ],
      enabled: true,
    };
    const texts = collectContentBlockTexts([paymentBlock, disabledBlock, withBullets]);
    expect(texts).toContain('IBAN {{iban}}, BIC {{bic}}, Kontoinhaber {{kontoinhaber}}');
    expect(texts).toContain('Aktiver Punkt {{firmenname}}');
    // Deaktivierter Baustein und deaktivierter Stichpunkt fließen nicht ein
    expect(texts).not.toContain('Sollte nicht gescannt werden {{unbekannt}}');
    expect(texts).not.toContain('Inaktiver Punkt {{iban}}');
  });

  it('meldet fehlende iban/bic aus einem payment_terms-Baustein', () => {
    const unresolved = findUnresolvedDocumentVariables(
      collectContentBlockTexts([paymentBlock]),
      buildValues({ iban: '', bic: '' }),
    );
    expect(unresolved).toEqual(['iban', 'bic']);
  });

  it('friert Bausteintexte mit aufgelösten iban/bic in den Snapshot ein', () => {
    const snapshot = composeDocumentSnapshot({
      type: 'invoice',
      number: 'R-2026-001',
      issuer: ISSUER,
      recipient: {
        name: 'Malerbetrieb Weber',
        contact_person: null,
        address: 'Wandweg 3',
        email: null,
      },
      line_items: [{ description: 'Website-Erstellung', quantity: 1, unit_price: 1200 }],
      content_blocks: [paymentBlock],
      issue_date: '2026-07-10',
      due_date: '2026-07-24',
      valid_until: null,
      service_date: 'Juli 2026',
      intro_text: null,
      outro_text: null,
      layout: 'polygrid',
      accent_color: '#0A6ED1',
      logo: null,
      related_document_number: null,
      variable_values: buildValues(),
    });

    expect(snapshot.content_blocks[0].text).toBe(
      'IBAN DE02120300000000202051, BIC BYLADEM1001, Kontoinhaber Marco Kromer',
    );
    expect(JSON.stringify(snapshot)).not.toContain('{{');
  });
});

describe('composeDocumentSnapshot (Snapshot-Fall)', () => {
  it('friert Intro und Schlusstext mit aufgelösten iban/bic ein', () => {
    const snapshot = composeDocumentSnapshot({
      type: 'invoice',
      number: 'R-2026-001',
      issuer: ISSUER,
      recipient: {
        name: 'Malerbetrieb Weber',
        contact_person: null,
        address: 'Wandweg 3',
        email: null,
      },
      line_items: [{ description: 'Website-Erstellung', quantity: 1, unit_price: 1200 }],
      content_blocks: [],
      issue_date: '2026-07-10',
      due_date: '2026-07-24',
      valid_until: null,
      service_date: 'Juli 2026',
      intro_text: 'Sehr geehrte Damen und Herren von {{kundenname}},',
      outro_text: 'Zahlbar an IBAN {{iban}}, BIC {{bic}}.',
      layout: 'modern',
      accent_color: '#0A6ED1',
      logo: null,
      related_document_number: null,
      variable_values: buildValues(),
    });

    expect(snapshot.intro_text).toBe('Sehr geehrte Damen und Herren von Malerbetrieb Weber,');
    expect(snapshot.outro_text).toBe(
      'Zahlbar an IBAN DE02120300000000202051, BIC BYLADEM1001.',
    );
    expect(JSON.stringify(snapshot)).not.toContain('{{');
  });
});
