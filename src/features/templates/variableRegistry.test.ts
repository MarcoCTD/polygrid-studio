import { describe, expect, it } from 'vitest';
import { findStandardVariable, orderVariableValue, type OrderPickerRow } from './variableRegistry';

function order(overrides: Partial<OrderPickerRow> = {}): OrderPickerRow {
  return {
    id: 'order-1',
    receipt_number: '2026-0001',
    external_order_id: null,
    customer_name: null,
    tracking_number: null,
    platform: null,
    ...overrides,
  };
}

describe('orderVariableValue', () => {
  it('fällt bei fehlender externer Bestellnummer auf die Belegnummer zurück', () => {
    expect(orderVariableValue(order(), 'order_number')).toBe('2026-0001');
    expect(orderVariableValue(order({ external_order_id: 'ETSY-1' }), 'order_number')).toBe(
      'ETSY-1',
    );
    // Whitespace-only externe Nummer zählt als leer
    expect(orderVariableValue(order({ external_order_id: '   ' }), 'order_number')).toBe(
      '2026-0001',
    );
  });

  it('liefert Leerstring (nie "null") für fehlendes Tracking, fehlende Plattform, fehlenden Kundennamen', () => {
    expect(orderVariableValue(order(), 'tracking_number')).toBe('');
    expect(orderVariableValue(order(), 'platform')).toBe('');
    expect(orderVariableValue(order(), 'customer_name')).toBe('');
  });

  it('mappt bekannte Plattformen auf Labels und lässt unbekannte unverändert', () => {
    expect(orderVariableValue(order({ platform: 'etsy' }), 'platform')).toBe('Etsy');
    expect(orderVariableValue(order({ platform: 'direkt' }), 'platform')).toBe('Direktverkauf');
    expect(orderVariableValue(order({ platform: 'zukunft' }), 'platform')).toBe('zukunft');
  });
});

describe('findStandardVariable', () => {
  it('findet Variablen unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(findStandardVariable(' Produktname ')?.name).toBe('produktname');
  });

  it('liefert undefined für Variablen außerhalb der Registry', () => {
    expect(findStandardVariable('gibt_es_nicht')).toBeUndefined();
  });
});
