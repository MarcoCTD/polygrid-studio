# PolyGrid Studio Business OS — Design System

**Version 1.0 | April 2026 | Verbindlich für Modul 01 (Foundation) und alle Folgemodule**

Dieses Dokument ersetzt Abschnitt 4 (Theme-System) im Anforderungsdokument von Modul 01. Es ist die Single Source of Truth für alle visuellen Entscheidungen in PolyGrid Studio Business OS.

---

## 1. Designphilosophie

PolyGrid Studio orientiert sich an **SAP Sales Cloud v2** und **Salesforce Trailhead**: ruhige, neutrale Grundfläche mit gezielter Farbsetzung für Aktionen, aktive Zustände und Status. Maximal aufgeräumt, niemals bunt.

### Grundstimmung

- **Kühl & technisch**: Off-White mit leichtem Blaustich im Hellmodus, tiefes Marineblau-Anthrazit im Dark Mode.
- **Hierarchie durch Erhebung**, nicht durch Sättigung. Wichtige Elemente liegen "höher", nicht "knalliger".
- **Eine einzige anpassbare Akzentfarbe** als Marken-Anker. Default: SAP-Blau.
- **Status-Farben sind semantisch** (rot = Verlust, grün = Erfolg) und werden nie vom Nutzer überschrieben.

### Drei Regeln, die immer gelten

1. 90% der Fläche ist neutral. Farbe ist Akzent, nicht Dekoration.
2. Hellmodus und Dark Mode sind eigenständig gestaltet, nicht invertiert.
3. Hover macht im Hellmodus dunkler, im Dark Mode heller.

---

## 2. Farbpalette — Hellmodus

### 2.1 Hintergründe

| Token | Hex | Verwendung |
|---|---|---|
| `--bg-primary` | `#F5F7FA` | Haupthintergrund (Main Content) |
| `--bg-secondary` | `#EDF1F6` | Sidebar, Panels |
| `--bg-elevated` | `#FFFFFF` | Karten, Modals, Detail-Panel |
| `--bg-hover` | `#E4EAF2` | Hover-States |
| `--bg-active` | `#DCE4EE` | Aktive Sidebar-Items (ohne Akzent) |

### 2.2 Text

| Token | Hex | Verwendung |
|---|---|---|
| `--text-primary` | `#1A2332` | Haupttext (kühles Anthrazit) |
| `--text-secondary` | `#5A6B7F` | Labels, sekundärer Text |
| `--text-muted` | `#8A99AC` | Platzhalter |
| `--text-disabled` | `#B8C2CF` | Deaktivierte Elemente |

### 2.3 Borders

| Token | Hex | Verwendung |
|---|---|---|
| `--border-subtle` | `#E4EAF2` | Tabellen-Zeilentrenner |
| `--border-default` | `#D8DEE7` | Standard-Rahmen, Inputs |
| `--border-strong` | `#B8C2CF` | Inputs im Fokus |

### 2.4 Akzentfarbe (anpassbar — Default: SAP-Blau)

| Token | Hex | Verwendung |
|---|---|---|
| `--accent-primary` | `#0070F2` | Primäre Aktionen, aktive Zustände |
| `--accent-primary-hover` | `#0058C2` | Hover auf primären Buttons |
| `--accent-primary-subtle` | `#E6F0FE` | Hintergrund für aktive Tabs/Items |
| `--accent-primary-border` | `#7FB4FF` | Rahmen für Akzent-Container |

### 2.5 Status-Farben (fix, nicht anpassbar)

| Token | Hex | Subtle-Variante | Verwendung |
|---|---|---|---|
| `--accent-success` | `#16A34A` | `#DCFCE7` | Gute Marge, Erfolg |
| `--accent-warning` | `#D97706` | `#FEF3C7` | Kritische Marge, Warnungen |
| `--accent-danger` | `#DC2626` | `#FEE2E2` | Verlust, Löschen, Fehler |
| `--accent-info` | `#0891B2` | `#CFFAFE` | KI-Hinweise, Info-Banner |

### 2.6 Shadows & Overlays

| Token | Wert | Verwendung |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,0.06)` | Subtile Tiefe |
| `--shadow-md` | `0 4px 12px rgba(15,23,42,0.08)` | Karten, Popovers |
| `--shadow-lg` | `0 12px 32px rgba(15,23,42,0.12)` | Modals, Dialoge |
| `--overlay-backdrop` | `rgba(15,23,42,0.4)` | Modal-Backdrop |

---

## 3. Farbpalette — Dark Mode

Der Dark Mode arbeitet mit einem **Elevation-System**: Je höher die Ebene, desto heller. Karten "schweben" über dem Hintergrund. Dies ersetzt die simple Hell/Dunkel-Hierarchie des Light Modes.

### 3.1 Hintergründe (Elevation-System)

| Token | Hex | Verwendung |
|---|---|---|
| `--bg-base` | `#0B0F1A` | Tiefste Ebene — App-Hintergrund |
| `--bg-primary` | `#11172A` | Standard-Arbeitsfläche (Main Content) |
| `--bg-secondary` | `#161D33` | Sidebar |
| `--bg-elevated-1` | `#1B233D` | Karten, Tabellen-Header |
| `--bg-elevated-2` | `#222B47` | Detail-Panel, Popovers |
| `--bg-elevated-3` | `#2A3454` | Modals, Dialoge (höchste Ebene) |
| `--bg-hover` | `#2D3756` | Hover über bg-elevated-1 |
| `--bg-active` | `#36426A` | Aktiver Sidebar-Eintrag (ohne Akzent) |

### 3.2 Text

WCAG-konform: Kein reines Weiß auf reinem Schwarz, das erzeugt Halation und Augenermüdung.

| Token | Hex | Kontrast auf bg-primary |
|---|---|---|
| `--text-primary` | `#E6EAF2` | 14.2:1 — Haupttext |
| `--text-secondary` | `#A8B3C7` | 7.8:1 — Labels |
| `--text-muted` | `#6E7A92` | 4.6:1 — Platzhalter |
| `--text-disabled` | `#4A5468` | 2.8:1 — Deaktiviert |

### 3.3 Borders

| Token | Hex | Verwendung |
|---|---|---|
| `--border-subtle` | `#1F2940` | Tabellen-Zeilentrenner |
| `--border-default` | `#2C3852` | Standard-Rahmen, Inputs |
| `--border-strong` | `#43507040` | Inputs im Fokus (mit Alpha) |

### 3.4 Akzentfarbe (anpassbar — Default: SAP-Blau Dark)

Im Dark Mode wird die Akzentfarbe **aufgehellt und entsättigt**, sonst vibriert sie auf dunklem Grund.

| Token | Hex | Verwendung |
|---|---|---|
| `--accent-primary` | `#5B9DFF` | Primäre Aktionen, aktive Zustände |
| `--accent-primary-hover` | `#7AB1FF` | Hover (heller, nicht dunkler!) |
| `--accent-primary-subtle` | `#1A2A4A` | Hintergrund für aktive Tabs/Items |
| `--accent-primary-border` | `#2D4A7C` | Rahmen für Akzent-Container |

### 3.5 Status-Farben (fix, im Dark Mode entsättigt)

| Token | Hex | Subtle-Variante | Verwendung |
|---|---|---|---|
| `--accent-success` | `#4ADE80` | `#0F2A1B` | Gute Marge, Erfolg |
| `--accent-warning` | `#FBBF24` | `#2A1F0A` | Kritische Marge |
| `--accent-danger` | `#F87171` | `#2A1212` | Verlust, Löschen |
| `--accent-info` | `#22D3EE` | `#0E2A30` | KI-Hinweise |

### 3.6 Shadows, Overlays & Spezial-Tokens

| Token | Wert | Verwendung |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtile Tiefe |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Karten, Popovers |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.5)` | Modals |
| `--overlay-backdrop` | `rgba(8,12,22,0.75)` | Modal-Backdrop |
| `--scrollbar-track` | `#161D33` | Eigene Scrollbar |
| `--scrollbar-thumb` | `#36426A` | Scrollbar-Daumen |
| `--code-bg` | `#0B0F1A` | Code-Blöcke |
| `--divider` | `#1F294040` | Mit Alpha — weichere Trenner |

---

## 4. Anpassbare Akzentfarbe

### 4.1 Konzept

Nur drei Tokens werden vom Nutzer geändert: `--accent-primary`, `--accent-primary-hover`, `--accent-primary-subtle`, `--accent-primary-border`. Alles andere bleibt fix.

Die Auswahl erfolgt in den Settings (Modul 11). Die App liest beim Start die Wahl aus `app_settings` (Key: `accent_color`) und setzt die Custom Properties auf dem `:root` Element.

### 4.2 Vordefinierte Presets

| Name | Hellmodus | Dark Mode |
|---|---|---|
| **SAP-Blau** (Default) | `#0070F2` | `#5B9DFF` |
| **Indigo** | `#4F46E5` | `#818CF8` |
| **Petrol** | `#0D9488` | `#2DD4BF` |
| **Orange** | `#EA580C` | `#FB923C` |
| **Violett** | `#7C3AED` | `#A78BFA` |
| **Graphit** | `#475569` | `#94A3B8` |

Pro Preset werden die Hover- und Subtle-Varianten programmatisch berechnet:
- **Hover (Hell)**: ~20% dunkler in HSL
- **Hover (Dark)**: ~15% heller in HSL
- **Subtle (Hell)**: Sättigung -20%, Helligkeit auf ~95%
- **Subtle (Dark)**: Sättigung -30%, Helligkeit auf ~15%

### 4.3 Custom Color Picker

Optional in Modul 11: Color-Picker für eine eigene Akzentfarbe. Die Hover- und Subtle-Varianten werden nach derselben Logik berechnet.

---

## 5. Typografie

| Element | Font | Größe | Gewicht | Tailwind |
|---|---|---|---|---|
| Display | Inter | 24px | 600 | `text-2xl font-semibold` |
| H1 | Inter | 20px | 600 | `text-xl font-semibold` |
| H2 | Inter | 16px | 600 | `text-base font-semibold` |
| Body | Inter | 14px | 400 | `text-sm` |
| Small | Inter | 12px | 500 | `text-xs font-medium` |
| Mono | JetBrains Mono | 13px | 400 | `font-mono text-[13px]` |

**Line-Heights:** Display/H1/H2 = 1.3, Body = 1.5, Small = 1.4, Mono = 1.5.

**Font-Loading:** Inter und JetBrains Mono via lokale `@font-face` Definition oder via `npm install @fontsource/inter @fontsource/jetbrains-mono`. Keine Google Fonts CDN (Datenschutz, Offline-First).

---

## 6. Spacing & Layout

- **Basis-Unit:** 4px. Alle Abstände als Vielfache.
- **Standard-Padding Karten:** 16px (`p-4`).
- **Standard-Gap:** 8px (`gap-2`).
- **Tabellenzeilen:** 44px Höhe.
- **Content-Max-Width:** 1200px (`max-w-7xl`).
- **Border-Radius:** 8px Standard (`rounded-lg`), 6px für kleine Elemente (Badges, Inputs), 12px für Modals.

---

## 7. Anwendung in Komponenten

### 7.1 Sidebar-Eintrag

**Inaktiv:** Transparenter Hintergrund, `--text-secondary`, Hover → `--bg-hover`.

**Aktiv:** `--accent-primary-subtle` als Hintergrund, `--accent-primary` als 3px linker Strich, `--text-primary` als Schriftfarbe.

### 7.2 Buttons

| Variante | Hintergrund | Text | Border |
|---|---|---|---|
| Primary | `--accent-primary` | `#FFFFFF` (beide Modi) | keine |
| Secondary | `--bg-elevated` | `--text-primary` | `--border-default` |
| Ghost | transparent | `--text-primary` | keine, Hover: `--bg-hover` |
| Danger | `--accent-danger` | `#FFFFFF` | keine |

Hover-Logik: Im Hellmodus dunkler werden, im Dark Mode heller.

### 7.3 Status-Badges (Margen-Ampel etc.)

Hintergrund = Subtle-Variante, Text = Hauptvariante, kein Border.

Beispiel Marge >50%: `background: var(--accent-success-subtle); color: var(--accent-success);`

### 7.4 Karten

**Hellmodus:** `--bg-elevated` + `--shadow-sm` + optional `--border-default`.

**Dark Mode:** `--bg-elevated-1` + `--shadow-md`, **ohne** Border. Die Erhebung erzeugt die Trennung.

### 7.5 Modals

**Hellmodus:** `--bg-elevated` + `--shadow-lg` + `--overlay-backdrop`.

**Dark Mode:** `--bg-elevated-3` (höchste Ebene) + `--shadow-lg` + `--overlay-backdrop`.

### 7.6 Charts (Modul 10)

- Hauptserie: `--accent-primary`
- Vergleichsserie: `--text-secondary`
- Negativwerte: `--accent-danger`
- Grid-Linien: `--border-subtle`

---

## 8. Implementierung — globals.css

Die Foundation legt die folgende Struktur in `src/styles/globals.css` an. Der Theme-Switch erfolgt über `data-theme` auf dem `<html>` Element.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* === Hellmodus (Default) === */
:root,
[data-theme="light"] {
  /* Hintergründe */
  --bg-primary: #F5F7FA;
  --bg-secondary: #EDF1F6;
  --bg-elevated: #FFFFFF;
  --bg-hover: #E4EAF2;
  --bg-active: #DCE4EE;

  /* Text */
  --text-primary: #1A2332;
  --text-secondary: #5A6B7F;
  --text-muted: #8A99AC;
  --text-disabled: #B8C2CF;

  /* Borders */
  --border-subtle: #E4EAF2;
  --border-default: #D8DEE7;
  --border-strong: #B8C2CF;

  /* Akzent (Default: SAP-Blau, anpassbar) */
  --accent-primary: #0070F2;
  --accent-primary-hover: #0058C2;
  --accent-primary-subtle: #E6F0FE;
  --accent-primary-border: #7FB4FF;

  /* Status (fix) */
  --accent-success: #16A34A;
  --accent-success-subtle: #DCFCE7;
  --accent-warning: #D97706;
  --accent-warning-subtle: #FEF3C7;
  --accent-danger: #DC2626;
  --accent-danger-subtle: #FEE2E2;
  --accent-info: #0891B2;
  --accent-info-subtle: #CFFAFE;

  /* Shadows & Overlays */
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.12);
  --overlay-backdrop: rgba(15, 23, 42, 0.4);
}

/* === Dark Mode === */
[data-theme="dark"] {
  /* Hintergründe (Elevation-System) */
  --bg-base: #0B0F1A;
  --bg-primary: #11172A;
  --bg-secondary: #161D33;
  --bg-elevated: #1B233D;
  --bg-elevated-1: #1B233D;
  --bg-elevated-2: #222B47;
  --bg-elevated-3: #2A3454;
  --bg-hover: #2D3756;
  --bg-active: #36426A;

  /* Text */
  --text-primary: #E6EAF2;
  --text-secondary: #A8B3C7;
  --text-muted: #6E7A92;
  --text-disabled: #4A5468;

  /* Borders */
  --border-subtle: #1F2940;
  --border-default: #2C3852;
  --border-strong: rgba(67, 80, 112, 0.4);

  /* Akzent (Default: SAP-Blau Dark) */
  --accent-primary: #5B9DFF;
  --accent-primary-hover: #7AB1FF;
  --accent-primary-subtle: #1A2A4A;
  --accent-primary-border: #2D4A7C;

  /* Status (entsättigt) */
  --accent-success: #4ADE80;
  --accent-success-subtle: #0F2A1B;
  --accent-warning: #FBBF24;
  --accent-warning-subtle: #2A1F0A;
  --accent-danger: #F87171;
  --accent-danger-subtle: #2A1212;
  --accent-info: #22D3EE;
  --accent-info-subtle: #0E2A30;

  /* Shadows & Overlays */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);
  --overlay-backdrop: rgba(8, 12, 22, 0.75);

  /* Spezial */
  --scrollbar-track: #161D33;
  --scrollbar-thumb: #36426A;
  --code-bg: #0B0F1A;
  --divider: rgba(31, 41, 64, 0.4);
}

/* Smooth Theme-Transition */
* {
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease;
}

/* Body-Defaults */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
```

### 8.1 Tailwind-Konfiguration

In `tailwind.config.js` müssen die CSS Custom Properties als Tailwind-Farben verfügbar gemacht werden:

```js
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-primary-hover)',
          subtle: 'var(--accent-primary-subtle)',
          border: 'var(--accent-primary-border)',
        },
        success: {
          DEFAULT: 'var(--accent-success)',
          subtle: 'var(--accent-success-subtle)',
        },
        warning: {
          DEFAULT: 'var(--accent-warning)',
          subtle: 'var(--accent-warning-subtle)',
        },
        danger: {
          DEFAULT: 'var(--accent-danger)',
          subtle: 'var(--accent-danger-subtle)',
        },
        info: {
          DEFAULT: 'var(--accent-info)',
          subtle: 'var(--accent-info-subtle)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
```

### 8.2 Theme-Hook (Foundation)

`src/hooks/useTheme.ts` muss:
1. Beim Start die Theme-Wahl aus `app_settings` lesen (Key: `theme` mit Werten `light`/`dark`/`system`).
2. Bei `system` den OS-Modus via `matchMedia('(prefers-color-scheme: dark)')` ermitteln.
3. Das Ergebnis als `data-theme` Attribut auf `<html>` setzen.
4. Bei OS-Änderung (System-Modus) automatisch reagieren.
5. Die Akzentfarbe analog aus `app_settings` (Key: `accent_color`) lesen und die vier Akzent-Properties setzen.

---

## 9. Akzeptanzkriterien (ergänzt zu Modul 01, Abschnitt 9)

Zusätzlich zu den bestehenden Kriterien aus Modul 01:

- Alle CSS Custom Properties aus diesem Dokument sind in `globals.css` definiert.
- Hellmodus und Dark Mode haben **eigenständige Werte**, keine algorithmische Inversion.
- Theme-Wechsel erfolgt smooth (200ms Transition).
- Sidebar-Aktiv-State nutzt `--accent-primary-subtle` + linken 3px-Strich in `--accent-primary`.
- Im Dark Mode wirken Karten als "schwebend" durch Elevation, nicht durch Border.
- Hover wird im Hellmodus dunkler, im Dark Mode heller.
- Status-Badges (Margen-Ampel, Auftrags-Status) nutzen Subtle-Hintergrund + Hauptfarbe als Text.
- Default-Akzentfarbe ist SAP-Blau (`#0070F2` hell / `#5B9DFF` dark).
- Akzentfarbe ist über `--accent-primary` etc. von einem zentralen Setter (Theme-Hook) änderbar.

---

## 10. Was dieses Dokument NICHT regelt

- Komponenten-Verhalten (Tabs, Modals, Dropdowns) → wird von shadcn/ui übernommen, nutzt aber automatisch unsere CSS Custom Properties.
- Animation/Motion-Design → wird ggf. später ergänzt.
- Icon-Stil → Lucide-Icons in `--text-secondary`, aktive in `--accent-primary`. Größe: 16px Standard, 20px in Sidebar.
- Mobile/Responsive-Verhalten → Out of Scope (Desktop-only).

**Bei Widersprüchen zwischen diesem Dokument und Abschnitt 4 von MODUL_01_FOUNDATION.docx gilt dieses Dokument.**
