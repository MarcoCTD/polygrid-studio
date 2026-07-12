import { describe, expect, it } from 'vitest';
import { getBelegeYear, getImportTargetFolder } from './importTarget';

describe('getImportTargetFolder', () => {
  it('Produkt: Bilder-Unterordner fuer Produktbild und Mockup', () => {
    expect(getImportTargetFolder({ kind: 'product', productName: 'Spiral-Vase' }, 'image')).toBe(
      '02_Produkte/spiral-vase/Bilder',
    );
    expect(getImportTargetFolder({ kind: 'product', productName: 'Spiral-Vase' }, 'mockup')).toBe(
      '02_Produkte/spiral-vase/Bilder',
    );
  });

  it('Produkt: STL- und Slicer-Unterordner nach Dateityp', () => {
    expect(getImportTargetFolder({ kind: 'product', productName: 'Spiral-Vase' }, 'stl')).toBe(
      '02_Produkte/spiral-vase/STL',
    );
    expect(getImportTargetFolder({ kind: 'product', productName: 'Spiral-Vase' }, 'slicer')).toBe(
      '02_Produkte/spiral-vase/Slicer',
    );
  });

  it('Produkt: sonstige Dateitypen landen im Produktordner-Root', () => {
    expect(
      getImportTargetFolder({ kind: 'product', productName: 'Spiral-Vase' }, 'sonstiges'),
    ).toBe('02_Produkte/spiral-vase');
    expect(getImportTargetFolder({ kind: 'product', productName: 'Spiral-Vase' }, 'beleg')).toBe(
      '02_Produkte/spiral-vase',
    );
  });

  it('Produkt: Ordnername wird wie bei productFolders normalisiert (Umlaute, Sonderzeichen)', () => {
    expect(
      getImportTargetFolder({ kind: 'product', productName: 'Drachen-Ei "Größe L"' }, 'image'),
    ).toBe('02_Produkte/drachen-ei-groesse-l/Bilder');
  });

  it('Ausgabe: Belege-Ordner mit Jahr aus dem Ausgabendatum', () => {
    expect(getImportTargetFolder({ kind: 'expense', expenseDate: '2025-03-14' }, 'beleg')).toBe(
      '01_Finanzen/Belege_2025',
    );
  });

  it('Ausgabe: Fallback auf aktuelles Jahr bei fehlendem oder kaputtem Datum', () => {
    const currentYear = new Date().getFullYear();
    expect(getImportTargetFolder({ kind: 'expense', expenseDate: null }, 'beleg')).toBe(
      `01_Finanzen/Belege_${currentYear}`,
    );
    expect(getImportTargetFolder({ kind: 'expense', expenseDate: 'kein-datum' }, 'beleg')).toBe(
      `01_Finanzen/Belege_${currentYear}`,
    );
  });

  it('Auftrag: fester Auftraege-Ordner', () => {
    expect(getImportTargetFolder({ kind: 'order' }, 'sonstiges')).toBe('04_Auftraege');
  });
});

describe('getBelegeYear', () => {
  it('liest das Jahr aus einem ISO-Datum', () => {
    expect(getBelegeYear('2024-12-31')).toBe(2024);
  });

  it('faellt bei ungueltigen Werten auf das aktuelle Jahr zurueck', () => {
    expect(getBelegeYear(null)).toBe(new Date().getFullYear());
    expect(getBelegeYear('31.12.2024')).toBe(new Date().getFullYear());
  });
});
