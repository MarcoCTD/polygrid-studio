import { useEffect, useCallback } from 'react';
import { useUIStore } from '@/stores';
import { getSetting, setSetting } from '@/services/database';
import {
  ACCENT_PRESETS,
  computeAccentVariants,
  applyAccentColors,
  type AccentPresetKey,
} from '@/utils/colors';
import type { Theme, AccentColor } from '@/types';

/**
 * Ermittelt den aufgeloesten Theme-Modus.
 */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Setzt data-theme auf <html> und wendet die Akzentfarbe an.
 */
function applyThemeToDOM(resolved: 'light' | 'dark', accentColor: AccentColor) {
  document.documentElement.setAttribute('data-theme', resolved);

  const preset = ACCENT_PRESETS[accentColor as AccentPresetKey];
  if (preset) {
    const variants = computeAccentVariants(preset.light, preset.dark);
    applyAccentColors(resolved === 'dark' ? variants.dark : variants.light);
  }
}

/**
 * useTheme Hook
 *
 * - Liest theme und accent_color aus app_settings beim Mount
 * - Setzt data-theme auf <html>
 * - Reagiert auf prefers-color-scheme bei mode=system
 * - Schreibt Aenderungen zurueck in die DB
 */
export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const accentColor = useUIStore((s) => s.accentColor);
  const setTheme = useUIStore((s) => s.setTheme);
  const setResolvedTheme = useUIStore((s) => s.setResolvedTheme);
  const setAccentColor = useUIStore((s) => s.setAccentColor);
  const dbReady = useUIStore((s) => s.dbReady);

  // Beim Mount: Settings aus DB laden
  useEffect(() => {
    if (!dbReady) return;

    async function loadSettings() {
      try {
        const savedTheme = await getSetting<Theme>('theme');
        if (savedTheme) setTheme(savedTheme);

        const savedAccent = await getSetting<AccentColor>('accent_color');
        if (savedAccent) setAccentColor(savedAccent);
      } catch {
        // Defaults bleiben bestehen
      }
    }

    void loadSettings();
  }, [dbReady, setTheme, setAccentColor]);

  // Theme auf DOM anwenden wenn theme oder accentColor sich aendern
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved, accentColor);
  }, [theme, accentColor, setResolvedTheme]);

  // Bei system-Modus: auf OS-Aenderung reagieren
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyThemeToDOM(resolved, accentColor);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, accentColor, setResolvedTheme]);

  // Theme wechseln + in DB persistieren
  const changeTheme = useCallback(
    async (newTheme: Theme) => {
      setTheme(newTheme);
      try {
        await setSetting('theme', newTheme);
      } catch {
        // Stille Fehler bei Persistierung – UI funktioniert trotzdem
      }
    },
    [setTheme],
  );

  // Akzentfarbe wechseln + in DB persistieren
  const changeAccentColor = useCallback(
    async (newColor: AccentColor) => {
      setAccentColor(newColor);
      try {
        await setSetting('accent_color', newColor);
      } catch {
        // Stille Fehler bei Persistierung
      }
    },
    [setAccentColor],
  );

  return {
    theme,
    accentColor,
    resolvedTheme: useUIStore((s) => s.resolvedTheme),
    changeTheme,
    changeAccentColor,
  };
}
