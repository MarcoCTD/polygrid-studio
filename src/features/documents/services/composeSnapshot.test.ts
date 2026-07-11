/**
 * Unit-Tests Snapshot-Komposition und Variablenersetzung (Auftrag 1b):
 * zentrale Wertetabelle inkl. iban/bic, Erkennung unaufgelöster Variablen
 * und Ersetzung im Snapshot-Compose (kein rohes {{...}} im Ergebnis).
 */
import { describe, expect, it } from 'vitest';
import type { SnapshotIssuer } from '../schemas';
import {
  buildDocumentVariableValues,
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
};

function buildValues(overrides: Partial<SnapshotIssuer> = {}) {
  return buildDocumentVariableValues({
    issuer: { ...ISSUER, ...overrides },
    clientName: 'Malerbetrieb Weber',
    projectName: 'Relaunch Weber',
    issueDateFormatted: '10.07.2026',
  });
}

describe('buildDocumentVariableValues', () => {
  it('liefert alle Bausteinvariablen inkl. iban, bic und bank', () => {
    expect(buildValues()).toEqual({
      kundenname: 'Malerbetrieb Weber',
      projektname: 'Relaunch Weber',
      firmenname: 'PolyGrid Studio',
      datum: '10.07.2026',
      iban: 'DE02120300000000202051',
      bic: 'BYLADEM1001',
      bank: 'Testbank',
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

describe('composeDocumentSnapshot (Snapshot-Fall)', () => {
  it('friert Intro und Schlusstext mit aufgelösten iban/bic ein', () => {
    const snapshot = composeDocumentSnapshot({
      type: 'invoice',
      number: 'R-2026-001',
      issuer: ISSUER,
      recipient: { name: 'Malerbetrieb Weber', contact_person: null, address: 'Wandweg 3' },
      line_items: [{ description: 'Website-Erstellung', quantity: 1, unit_price: 1200 }],
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
