/**
 * HSL-basierte Farbberechnungen für das Akzentfarben-System.
 * Berechnet Hover-, Subtle- und Border-Varianten aus einer Basisfarbe.
 */

interface HSL {
  h: number;
  s: number;
  l: number;
}

interface AccentColors {
  light: {
    primary: string;
    hover: string;
    subtle: string;
    border: string;
  };
  dark: {
    primary: string;
    hover: string;
    subtle: string;
    border: string;
  };
}

/**
 * Konvertiert Hex (#RRGGBB) zu HSL.
 */
export function hexToHSL(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Konvertiert HSL zu Hex (#RRGGBB).
 */
export function hslToHex(hsl: HSL): string {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return `#${val.toString(16).padStart(2, "0").repeat(3)}`;
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Berechnet alle Akzent-Varianten aus einer Hellmodus-Basisfarbe.
 *
 * Regeln aus dem Design-System:
 * - Hover (Hell): ~20% dunkler in HSL
 * - Hover (Dark): ~15% heller in HSL
 * - Subtle (Hell): Saettigung -20%, Helligkeit auf ~95%
 * - Subtle (Dark): Saettigung -30%, Helligkeit auf ~15%
 * - Border: Mittlere Helligkeit mit reduzierter Saettigung
 */
export function computeAccentVariants(hexLight: string, hexDark: string): AccentColors {
  const hslLight = hexToHSL(hexLight);
  const hslDark = hexToHSL(hexDark);

  return {
    light: {
      primary: hexLight,
      hover: hslToHex({
        h: hslLight.h,
        s: hslLight.s,
        l: Math.max(0, hslLight.l - 20),
      }),
      subtle: hslToHex({
        h: hslLight.h,
        s: Math.max(0, hslLight.s - 20),
        l: 95,
      }),
      border: hslToHex({
        h: hslLight.h,
        s: Math.max(0, hslLight.s - 10),
        l: 75,
      }),
    },
    dark: {
      primary: hexDark,
      hover: hslToHex({
        h: hslDark.h,
        s: hslDark.s,
        l: Math.min(100, hslDark.l + 15),
      }),
      subtle: hslToHex({
        h: hslDark.h,
        s: Math.max(0, hslDark.s - 30),
        l: 15,
      }),
      border: hslToHex({
        h: hslDark.h,
        s: Math.max(0, hslDark.s - 20),
        l: 30,
      }),
    },
  };
}

/**
 * Vordefinierte Akzent-Presets.
 * Jedes Preset hat eine Hellmodus- und Dark-Mode-Basisfarbe.
 */
export const ACCENT_PRESETS = {
  sap_blue: { light: "#0070F2", dark: "#5B9DFF", label: "SAP-Blau" },
  indigo: { light: "#4F46E5", dark: "#818CF8", label: "Indigo" },
  petrol: { light: "#0D9488", dark: "#2DD4BF", label: "Petrol" },
  orange: { light: "#EA580C", dark: "#FB923C", label: "Orange" },
  violet: { light: "#7C3AED", dark: "#A78BFA", label: "Violett" },
  graphite: { light: "#475569", dark: "#94A3B8", label: "Graphit" },
} as const;

export type AccentPresetKey = keyof typeof ACCENT_PRESETS;

/**
 * Setzt die vier Akzent-CSS-Custom-Properties auf dem root-Element.
 */
export function applyAccentColors(colors: AccentColors["light"] | AccentColors["dark"]): void {
  const root = document.documentElement;
  root.style.setProperty("--accent-primary", colors.primary);
  root.style.setProperty("--accent-primary-hover", colors.hover);
  root.style.setProperty("--accent-primary-subtle", colors.subtle);
  root.style.setProperty("--accent-primary-border", colors.border);
}
