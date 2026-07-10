import { beforeEach, describe, expect, it } from 'vitest';
import {
  generateDocumentNumber,
  resetDocumentNumberGeneratorForTests,
  type DocumentNumberDatabase,
} from './documentNumber';

interface TestDocument {
  number: string;
}

class DocumentNumberTestDatabase implements DocumentNumberDatabase {
  private readonly documents: TestDocument[];

  constructor(initialNumbers: string[] = []) {
    this.documents = initialNumbers.map((number) => ({ number }));
  }

  async select<T>(_query: string, bindValues?: unknown[]): Promise<T> {
    const prefix = String(bindValues?.[0] ?? '').replace('%', '');
    const maxCounter = this.documents
      .filter((document) => document.number.startsWith(prefix))
      .map((document) => Number(document.number.split('-')[2]))
      .filter((counter) => Number.isFinite(counter))
      .reduce((max, counter) => Math.max(max, counter), 0);

    return [{ max_counter: maxCounter === 0 ? null : maxCounter }] as T;
  }

  async execute(_query: string, _bindValues?: unknown[]): Promise<unknown> {
    return { rowsAffected: 0 };
  }

  insertNumber(number: string): void {
    this.documents.push({ number });
  }
}

describe('generateDocumentNumber', () => {
  beforeEach(() => {
    resetDocumentNumberGeneratorForTests();
  });

  it('erzeugt als erste Rechnungsnummer eines Jahres R-JAHR-001', async () => {
    const db = new DocumentNumberTestDatabase();

    await expect(generateDocumentNumber(db, 'invoice', 2026)).resolves.toBe('R-2026-001');
  });

  it('erzeugt als erste Angebotsnummer eines Jahres A-JAHR-001', async () => {
    const db = new DocumentNumberTestDatabase();

    await expect(generateDocumentNumber(db, 'quote', 2026)).resolves.toBe('A-2026-001');
  });

  it('inkrementiert bestehende Nummern lückenlos', async () => {
    const db = new DocumentNumberTestDatabase(['R-2026-001', 'R-2026-002']);

    await expect(generateDocumentNumber(db, 'invoice', 2026)).resolves.toBe('R-2026-003');
  });

  it('führt Angebote und Rechnungen als getrennte Nummernkreise', async () => {
    const db = new DocumentNumberTestDatabase(['R-2026-005']);

    await expect(generateDocumentNumber(db, 'quote', 2026)).resolves.toBe('A-2026-001');
    await expect(generateDocumentNumber(db, 'invoice', 2026)).resolves.toBe('R-2026-006');
  });

  it('startet pro Jahr neu', async () => {
    const db = new DocumentNumberTestDatabase(['R-2025-999']);

    await expect(generateDocumentNumber(db, 'invoice', 2026)).resolves.toBe('R-2026-001');
  });

  it('erweitert ab 1000 automatisch auf vier Stellen', async () => {
    const db = new DocumentNumberTestDatabase(['R-2026-999']);

    await expect(generateDocumentNumber(db, 'invoice', 2026)).resolves.toBe('R-2026-1000');
  });

  it('vergibt Nummern stornierter Rechnungen nie wieder', async () => {
    const db = new DocumentNumberTestDatabase();
    const first = await generateDocumentNumber(db, 'invoice', 2026);
    db.insertNumber(first);

    await expect(generateDocumentNumber(db, 'invoice', 2026)).resolves.toBe('R-2026-002');
  });

  it('erzeugt bei parallelen Aufrufen keine Duplikate', async () => {
    const db = new DocumentNumberTestDatabase();

    const numbers = await Promise.all([
      generateDocumentNumber(db, 'invoice', 2026),
      generateDocumentNumber(db, 'invoice', 2026),
      generateDocumentNumber(db, 'invoice', 2026),
    ]);

    expect(numbers).toEqual(['R-2026-001', 'R-2026-002', 'R-2026-003']);
  });

  it('serialisiert auch gemischte Typen ohne Kollision', async () => {
    const db = new DocumentNumberTestDatabase();

    const numbers = await Promise.all([
      generateDocumentNumber(db, 'quote', 2026),
      generateDocumentNumber(db, 'invoice', 2026),
      generateDocumentNumber(db, 'quote', 2026),
      generateDocumentNumber(db, 'invoice', 2026),
    ]);

    expect(numbers).toEqual(['A-2026-001', 'R-2026-001', 'A-2026-002', 'R-2026-002']);
  });
});
