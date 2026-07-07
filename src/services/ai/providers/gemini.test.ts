import { describe, expect, it } from 'vitest';
import { GEMINI_MODELS, normalizeGeminiModel } from './gemini';

describe('normalizeGeminiModel', () => {
  it('migriert veraltete Modellnamen auf aktuelle Modelle', () => {
    expect(normalizeGeminiModel('gemini-2.0-flash')).toBe('gemini-3.5-flash');
    expect(normalizeGeminiModel('gemini-1.5-flash')).toBe('gemini-3.5-flash');
    expect(normalizeGeminiModel('gemini-2.0-flash-lite')).toBe('gemini-3.1-flash-lite');
    expect(normalizeGeminiModel('gemini-1.5-pro')).toBe('gemini-3.1-pro-preview');
  });

  it('migriert gemini-3.1-pro auf die verfügbare Preview-Variante', () => {
    // "gemini-3.1-pro" existiert in der Google-API nur als Preview (sonst 404)
    expect(normalizeGeminiModel('gemini-3.1-pro')).toBe('gemini-3.1-pro-preview');
  });

  it('lässt aktuelle Modellnamen unverändert', () => {
    for (const model of GEMINI_MODELS) {
      expect(normalizeGeminiModel(model)).toBe(model);
    }
  });

  it('fällt bei leerem oder fehlendem Wert auf das Default-Modell zurück', () => {
    expect(normalizeGeminiModel('')).toBe(GEMINI_MODELS[0]);
    expect(normalizeGeminiModel('  ')).toBe(GEMINI_MODELS[0]);
    expect(normalizeGeminiModel(null)).toBe(GEMINI_MODELS[0]);
    expect(normalizeGeminiModel(undefined)).toBe(GEMINI_MODELS[0]);
  });

  it('alle migrierten Zielwerte sind in der aktuellen Modellliste enthalten', () => {
    const legacy = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-3.1-pro',
    ];
    const allowed: readonly string[] = GEMINI_MODELS;
    for (const model of legacy) {
      expect(allowed).toContain(normalizeGeminiModel(model));
    }
  });
});
