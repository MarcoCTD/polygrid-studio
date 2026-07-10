import { describe, expect, it } from 'vitest';
import { numberOrNull } from './form';

describe('numberOrNull', () => {
  it('lässt leere Eingaben null (Regression: Number(null) wäre 0)', () => {
    // React Hook Form reicht den Default-Wert null durch setValueAs –
    // genau dieser Fall machte aus einem leeren Versanderlös 0 EUR.
    expect(numberOrNull(null)).toBeNull();
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull(undefined)).toBeNull();
  });

  it('parst gültige Zahleneingaben', () => {
    expect(numberOrNull('12')).toBe(12);
    expect(numberOrNull('12.34')).toBe(12.34);
    expect(numberOrNull(0)).toBe(0);
    expect(numberOrNull('0')).toBe(0);
  });

  it('behandelt nicht parsbare Eingaben als null', () => {
    expect(numberOrNull('abc')).toBeNull();
    expect(numberOrNull(Number.NaN)).toBeNull();
  });
});
