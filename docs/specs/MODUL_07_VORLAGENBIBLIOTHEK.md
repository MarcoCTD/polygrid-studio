# Modul 07: Vorlagenbibliothek

PolyGrid Studio Business OS
Anforderungsdokument | Version 2.0 | Mai 2026

> **Änderungen in v2.0 gegenüber Original-Spec (v1.0):**
>
> - KI-Integration nicht mehr optional (Modul 06 ist fertig)
> - `deleted_at` ergänzt (Standard-Konvention Soft-Delete)
> - `created_at` und `updated_at` ergänzt (fehlen in Original-Spec)
> - Syntax-Highlighting präzisiert (kein externes Highlighting-Package, CSS-basiert)
> - Sub-Session-Aufteilung ergänzt
> - Command Palette Erweiterungen ergänzt

---

## 1. Scope und Ziel

Dieses Modul implementiert eine Bibliothek für wiederkehrende Texte: Impressum, Widerruf, Versandinfos, FAQ, Kundenservice-Antworten, Beilagentexte und Reklamationsvorlagen. Vorlagen enthalten Platzhaltervariablen die beim Kopieren automatisch ersetzt werden.

### 1.1 Lieferergebnisse

- Kategorisierte Vorlagenliste mit Suche und Kategorie-Tabs
- Vorlagen-Editor mit visueller Hervorhebung von `{{variablen}}`
- Platzhaltervariablen-System (`{{produktname}}`, `{{bestellnummer}}` etc.)
- Warnbanner bei Rechtstexten
- Versionierung (automatisch hochgezählt bei jeder Speicherung)
- Kopieren-Funktion mit automatischer Variablenersetzung (Dialog)
- KI-Aktionen: Text kürzen, verlängern, umformulieren, für andere Plattform anpassen (nutzt Modul 06)
- Command Palette Erweiterungen

### 1.2 Abhängigkeiten

| Modul | Status | Nutzung |
|-------|--------|---------|
| Foundation (01) | ✅ Fertig | App Shell, DB, Routing, Command Registry |
| KI-Architektur (06) | ✅ Fertig | Text kürzen, verlängern, umformulieren, anpassen |

### 1.3 Explizit NICHT im Scope

- Kein Rich-Text-Editor (reines Textarea mit CSS-Highlighting)
- Keine Versionierungshistorie (nur aktuelle Versionsnummer, kein Changelog)
- Kein externes Syntax-Highlighting-Package (kein CodeMirror, kein Monaco)
- Keine automatische Befüllung von Variablen aus der DB (manuell im Kopieren-Dialog)

---

## 2. Datenmodell

Die `templates`-Tabelle ist bereits im Schema angelegt (Foundation). Vollständige Felddefinition:

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| name | TEXT | Ja | Name der Vorlage |
| category | TEXT | Ja | impressum, widerruf, versand, faq, antwort, kundenservice, beilage, reklamation, sonstiges |
| content | TEXT | Ja | Vorlagentext mit `{{variablen}}` |
| platforms | TEXT (JSON) | Nein | Array: etsy, ebay, kleinanzeigen (für welche Plattformen gilt die Vorlage) |
| variables | TEXT (JSON) | Nein | Array `[{name: "produktname", description: "Name des Produkts"}]` |
| version | INTEGER | Ja | Default: 1, wird bei jedem Speichern um 1 erhöht |
| is_legal | BOOLEAN | Ja | Default: false. True = Rechtstext |
| notes | TEXT | Nein | Interne Notizen |
| created_at | TEXT (ISO) | Ja | Erstellungszeitpunkt |
| updated_at | TEXT (ISO) | Ja | Letzte Änderung |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete Timestamp |

### 2.1 Zod Schema

```typescript
export const templateCategoryEnum = z.enum([
  'impressum', 'widerruf', 'versand', 'faq',
  'antwort', 'kundenservice', 'beilage', 'reklamation', 'sonstiges'
]);

export const templateVariableSchema = z.object({
  name: z.string(), // z.B. "produktname"
  description: z.string(), // z.B. "Name des Produkts"
});

export const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  category: templateCategoryEnum,
  content: z.string().min(1),
  platforms: z.array(z.enum(['etsy', 'ebay', 'kleinanzeigen'])).optional(),
  variables: z.array(templateVariableSchema).optional(),
  version: z.number().int().min(1),
  is_legal: z.boolean(),
  notes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().optional(),
});
```

---

## 3. UI-Spezifikation

### 3.1 Seitenstruktur

Die Vorlagenseite (`/templates`) hat ein zweispaltiges Layout:

- **Links (350px):** Vorlagenliste mit Suchfeld + Kategorie-Tabs
- **Rechts (flex):** Editor — öffnet sich wenn eine Vorlage ausgewählt wird, sonst leerer Zustand

### 3.2 Vorlagenliste (links)

**Suchfeld** oben (über den Tabs), sucht über Name und Content.

**Kategorie-Tabs:**

| Tab | Kategorie-Wert |
|-----|----------------|
| Alle | — |
| Impressum | impressum |
| Widerruf | widerruf |
| Versand | versand |
| FAQ | faq |
| Kundenservice | kundenservice, antwort |
| Beilagen | beilage |
| Reklamation | reklamation |
| Sonstiges | sonstiges |

**Jeder Listeneintrag zeigt:**
- Name (fett)
- Plattform-Badges (Etsy, eBay, Kleinanzeigen — falls gesetzt)
- Version (klein, z.B. "v3")
- Rechtstext-Badge (rot, "Rechtstext") falls `is_legal = true`
- Letztes Update (relatives Datum)

**Button "Neue Vorlage"** oben rechts in der Liste.

Klick auf Eintrag öffnet den Editor rechts.

### 3.3 Editor (rechts)

**Header:**
- Vorlagenname (editierbar inline, H1-Style)
- Speichern-Button + Löschen-Button (Soft-Delete mit Bestätigung)
- Versionsnummer (read-only, z.B. "Version 3")

**Warnbanner** (wenn `is_legal = true`):
```
⚠️ Dies ist ein Rechtstext. Nicht als juristisch geprüft verwenden.
```
Immer sichtbar, nicht ausblendbar, accent-warning Hintergrund.

**Zweispaltiges Editor-Layout:**

*Links (70%): Textarea*
- Großes Textarea für den Vorlageninhalt
- `{{variablen}}` werden farblich hervorgehoben (accent-primary Farbe, leicht hinterlegt)
- Das Highlighting erfolgt über einen überlagerten div mit identischem Styling (Textarea + Highlight-Overlay Technik, kein externes Package)

*Rechts (30%): Variablen-Seitenleiste*
- Titel "Variablen"
- Liste aller `{{variablen}}` die im aktuellen Content vorkommen (automatisch erkannt via Regex)
- Plus manuell hinzugefügte Variablen (aus `variables`-Feld)
- Jede Variable zeigt: Name, Beschreibung (editierbar), "Einfügen"-Button (fügt `{{name}}` an Cursor-Position ein)
- "Variable hinzufügen" Button für manuelle Ergänzungen

**Footer-Leiste:**
- **Plattformen:** Checkbox-Gruppe (Etsy, eBay, Kleinanzeigen)
- **Kategorie:** Dropdown
- **Rechtstext:** Toggle
- **Notizen:** Klappbares Textarea

**Aktionsleiste** (unter dem Editor, vor dem Footer):
- **"Kopieren"** Button (primär) — öffnet Kopieren-Dialog
- **KI-Buttons** (nur wenn Provider verfügbar, sonst ausgegraut mit Tooltip):
  - "Text kürzen"
  - "Text verlängern"
  - "Umformulieren"
  - "Für andere Plattform anpassen"

### 3.4 Kopieren-Dialog

Öffnet sich beim Klick auf "Kopieren":

1. Liste aller erkannten `{{variablen}}` im Vorlagentext
2. Pro Variable: Eingabefeld mit Label (Variablenname + Beschreibung)
3. Vorschau des fertigen Textes (live aktualisiert während Eingabe)
4. Button "In Zwischenablage kopieren" — ersetzt alle `{{variablen}}` und kopiert
5. Button "Abbrechen"

### 3.5 Neue Vorlage (Modal)

Einfaches Modal mit:
- Name (Pflicht)
- Kategorie (Dropdown, Pflicht)
- Rechtstext (Toggle)
- Plattformen (Checkboxen)
- Erstellen-Button

Nach Erstellung öffnet sich der Editor mit der neuen leeren Vorlage.

---

## 4. KI-Integration

Alle KI-Aktionen nutzen das bestehende Provider-Pattern aus Modul 06. Jede Aktion öffnet den DiffView (vorher/nachher) aus Modul 06 — der Nutzer muss annehmen oder ablehnen.

| Aktion | Agent | Beschreibung |
|--------|-------|--------------|
| Text kürzen | template_assistant | Kürzt den Text auf ~50% ohne Informationsverlust |
| Text verlängern | template_assistant | Erweitert den Text mit sinnvollen Ergänzungen |
| Umformulieren | template_assistant | Schreibt den Text im Brand-Stil um (Brand-Settings aus Modul 06) |
| Für andere Plattform anpassen | template_assistant | Öffnet zuerst Dialog: Ziel-Plattform auswählen, dann anpassen |

**Wichtig:** `{{variablen}}` dürfen bei KI-Aktionen NICHT ersetzt oder entfernt werden. Der System-Prompt muss das explizit verbieten.

Logging in `ai_jobs` wie alle anderen Agents (Agent: `template_assistant`).

---

## 5. Versionierung

Bei jedem Speichern wird `version` um 1 erhöht. Es gibt keine Versionierungshistorie (kein Rollback). Die Version dient nur als Indikator dass sich etwas geändert hat.

---

## 6. Command Palette Erweiterungen

| Command | Kategorie | Aktion |
|---------|-----------|--------|
| Neue Vorlage | Aktionen | Öffnet Neue-Vorlage-Modal |
| Zu Vorlagen | Navigation | Navigiert zu /templates |

---

## 7. Akzeptanzkriterien

- [ ] Vorlagen können angelegt, bearbeitet und soft-deleted werden
- [ ] Kategorien-Tabs filtern korrekt
- [ ] Suche funktioniert über Name und Content
- [ ] `{{variablen}}` werden im Editor farblich hervorgehoben
- [ ] Variablen-Seitenleiste zeigt erkannte Variablen automatisch
- [ ] "Einfügen"-Button fügt Variable an Cursor-Position ein
- [ ] Kopieren-Dialog ersetzt alle Variablen korrekt
- [ ] Vorschau im Kopieren-Dialog aktualisiert sich live
- [ ] Warnbanner erscheint bei `is_legal = true`, nicht ausblendbar
- [ ] Versionsnummer wird bei jedem Speichern erhöht
- [ ] KI-Aktionen öffnen DiffView (Annehmen/Ablehnen)
- [ ] `{{variablen}}` bleiben bei KI-Aktionen erhalten
- [ ] KI-Buttons deaktiviert wenn kein Provider verfügbar
- [ ] Command Palette enthält "Neue Vorlage"
- [ ] Kein TypeScript-Fehler im strict mode
- [ ] `npm run tauri dev` startet ohne Fehler
