# Modul 09: Aufgaben-Modul

PolyGrid Studio Business OS
Anforderungsdokument | Version 2.0 | Mai 2026

> **Änderungen in v2.0 gegenüber Original-Spec (v1.0):**
>
> - `deleted_at` ergänzt (Standard-Konvention Soft-Delete)
> - `parent_task_id` ergänzt für Recurring-Verlauf
> - KI-Integration nicht mehr optional (Modul 06 ist fertig)
> - Auftrags-Verknüpfung nicht mehr optional (Modul 08 ist fertig)
> - Listing-Verknüpfung nicht mehr optional (Modul 05 ist fertig)
> - Drag-and-Drop via dnd-kit (im Tech-Stack)
> - Command Palette Erweiterungen spezifiziert
> - KI-Agent "Task Extractor" präzisiert (nutzt bestehende KI-Architektur)
> - Sidebar Badge-Counter Implementierung konkretisiert

---

## 1. Scope und Ziel

Dieses Modul implementiert ein Aufgabensystem mit Wochenansicht als Standard, Listenansicht als Alternative, Prioritäten, Verknüpfungen zu Produkten, Aufträgen und Listings, sowie wiederkehrende Aufgaben.

### 1.1 Lieferergebnisse

- Wochenansicht (Swim-Lanes Mo–So + Ungeplant-Spalte)
- Listenansicht mit Filter und Sortierung (TanStack Table)
- Aufgaben-CRUD mit Prioritäten
- Verknüpfung mit Produkten (Modul 02), Aufträgen (Modul 08) und Listings (Modul 05)
- Wiederkehrende Aufgaben (Tages-, Wochen-, Monatsrhythmus)
- Sidebar Badge-Counter für überfällige Aufgaben
- KI-Integration: Aufgaben aus Freitext extrahieren (nutzt Modul 06 Provider-Pattern)
- Command Palette Erweiterungen

### 1.2 Abhängigkeiten

| Modul | Status | Nutzung |
|-------|--------|---------|
| Foundation (01) | ✅ Fertig | App Shell, DB, Routing, Command Registry, Shortcut Registry, Sidebar Badge Counter |
| Produktverwaltung (02) | ✅ Fertig | Produktverknüpfung (product_id FK) |
| Listing-Verwaltung (05) | ✅ Fertig | Listing-Verknüpfung (listing_id FK) |
| KI-Architektur (06) | ✅ Fertig | Task Extractor Agent, Provider-Pattern |
| Auftragsverwaltung (08) | ✅ Fertig | Auftragsverknüpfung (order_id FK) |

### 1.3 Explizit NICHT im Scope

- Keine Gantt-Chart-Ansicht
- Keine Kalenderansicht (nur Wochenansicht mit Swim-Lanes)
- Keine Projekt-/Ordner-Gruppierung von Aufgaben
- Keine Aufgaben-Zuweisung an Personen (Single-User-App)
- Keine Zeiterfassung
- Kein Kanban-Board für Aufgaben (Aufträge haben bereits Kanban in Modul 08)

---

## 2. Datenmodell

Die `tasks`-Tabelle ist bereits im Schema angelegt (Foundation). Hier die erweiterte Felddefinition:

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| title | TEXT | Ja | Aufgabentitel |
| description | TEXT | Nein | Beschreibung (Markdown oder Plaintext) |
| priority | TEXT | Ja | low, medium, high, urgent |
| status | TEXT | Ja | todo, in_progress, done, cancelled |
| due_date | TEXT (ISO) | Nein | Fälligkeitsdatum (nur Datum, keine Uhrzeit) |
| product_id | TEXT (FK → products.id) | Nein | Referenz auf Produkt |
| order_id | TEXT (FK → orders.id) | Nein | Referenz auf Auftrag |
| listing_id | TEXT (FK → listings.id) | Nein | Referenz auf Listing |
| recurring_rule | TEXT (JSON) | Nein | `{interval: "daily"|"weekly"|"monthly", day?: number}` |
| parent_task_id | TEXT (FK → tasks.id) | Nein | **Neu**: Referenz auf die Eltern-Aufgabe bei wiederkehrenden Tasks |
| completed_at | TEXT (ISO) | Nein | Abschlusszeitpunkt |
| created_at | TEXT (ISO) | Ja | Erstellungszeitpunkt |
| updated_at | TEXT (ISO) | Ja | Letzte Änderung |
| deleted_at | TEXT (ISO) | Nein | **Neu**: Soft-Delete Timestamp |

**Neue Felder gegenüber DATABASE_SCHEMA.md v1.1:**
- `parent_task_id`: Muss als neues Feld ergänzt werden
- `deleted_at`: Muss als neues Feld ergänzt werden

**Indizes** (bereits angelegt): `status`, `priority`, `due_date`

**Neue Indizes**: `parent_task_id`

### 2.1 Zod Schema

```typescript
export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);

export const recurringRuleSchema = z.object({
  interval: z.enum(['daily', 'weekly', 'monthly']),
  day: z.number().optional(), // Wochentag (0-6) bei weekly, Monatstag (1-31) bei monthly
});

export const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: taskPriorityEnum,
  status: taskStatusEnum,
  due_date: z.string().optional(), // ISO date string (YYYY-MM-DD)
  product_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
  recurring_rule: recurringRuleSchema.optional(),
  parent_task_id: z.string().uuid().optional(),
  completed_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().optional(),
});
```

---

## 3. UI-Spezifikation

### 3.1 Seitenstruktur

Die Aufgabenseite (`/tasks`) hat folgende Struktur:

**Header-Bereich:**
- Titel "Aufgaben"
- Ansichts-Toggle: Wochenansicht (Default) | Listenansicht
- KW-Navigation (nur in Wochenansicht): `← KW 19 →` mit Heute-Button
- Button "Neue Aufgabe" (öffnet Modal)
- KI-Button "Aufgaben aus Text" (öffnet Dialog)

### 3.2 Wochenansicht (Standard)

Horizontales Layout mit Swim-Lanes:

| Ungeplant | Montag | Dienstag | Mittwoch | Donnerstag | Freitag | Samstag | Sonntag |
|-----------|--------|----------|----------|------------|---------|---------|---------|

- **Ungeplant-Spalte** (links, etwas schmaler): Aufgaben ohne `due_date`
- **Tagesspalten** (Mo–So): Aufgaben mit `due_date` am jeweiligen Tag
- Jede Spalte zeigt den Wochentag + Datum (z.B. "Mo 05.05.")
- Heutiger Tag wird mit Akzentfarbe-Border hervorgehoben
- KW-Navigation: Pfeile links/rechts wechseln die Kalenderwoche (ISO 8601)
- "Heute"-Button springt zur aktuellen KW

**Aufgaben-Karten:**
- Titel (1-2 Zeilen, truncated)
- Prioritäts-Badge (farbcodiert, siehe 3.3)
- Verknüpfungs-Icon + Name (Produkt/Auftrag/Listing, falls vorhanden)
- Status-Indikator (Checkbox links: todo/in_progress = leer, done = Haken)
- Klick auf Checkbox markiert als erledigt (setzt status auf `done`, `completed_at` auf jetzt)
- Klick auf Karte öffnet Detail-Panel

**Drag-and-Drop (dnd-kit):**
- Zwischen Tagesspalten: Verschiebt `due_date` auf den Zieltag
- In/aus Ungeplant: Setzt/entfernt `due_date`
- Visuelles Feedback: Drag-Overlay, Drop-Zone-Highlight

### 3.3 Prioritäts-Farben

| Priorität | Farbe | Token | Badge-Stil |
|-----------|-------|-------|------------|
| Urgent | Rot | --accent-danger | Ausgefüllt |
| High | Orange | --accent-warning | Ausgefüllt |
| Medium | Blau | --accent-primary | Outline |
| Low | Grau | --text-muted | Outline |

### 3.4 Listenansicht

TanStack Table mit folgenden Spalten:

| Spalte | Breite | Verhalten |
|--------|--------|-----------|
| Checkbox | 40px | Status toggle (done/todo) |
| Titel | flex | Klickbar, öffnet Detail-Panel |
| Priorität | 100px | Badge farbcodiert |
| Fälligkeit | 120px | Datum, rot wenn überfällig |
| Verknüpfung | 150px | Icon + Name (Produkt/Auftrag/Listing) |
| Status | 100px | Badge |

**Filter:**
- Status (Multi-Select): todo, in_progress, done, cancelled
- Priorität (Multi-Select): urgent, high, medium, low
- Verknüpfungstyp: Produkt, Auftrag, Listing, Keine
- Überfällig: Ja/Nein Toggle
- Wiederkehrend: Ja/Nein Toggle

**Sortierung:** Priorität (urgent zuerst), Fälligkeitsdatum, Erstellung

Erledigte Aufgaben werden standardmäßig ausgeblendet (Toggle "Erledigte anzeigen").

### 3.5 Neue Aufgabe (Modal)

**Schnellerfassung (Inline in Wochenansicht):**
- Eingabefeld am unteren Rand jeder Tagesspalte
- Titel eingeben + Enter = Aufgabe erstellt mit:
  - `priority`: medium
  - `status`: todo
  - `due_date`: Datum der Spalte (oder NULL bei Ungeplant-Spalte)
- Keine weitere UI, sofortige Speicherung

**Vollständiges Formular (Modal):**
- Titel (Pflicht)
- Beschreibung (Textarea)
- Priorität (Dropdown: Low, Medium, High, Urgent)
- Fälligkeitsdatum (Date-Picker)
- Verknüpfung (Typ-Dropdown + Entity-Suche):
  - Produkt (Dropdown mit Suche über Produktnamen)
  - Auftrag (Dropdown mit Suche über Belegnummer oder Kundenname)
  - Listing (Dropdown mit Suche über Listing-Titel)
- Wiederkehrend (Toggle + Konfiguration):
  - Intervall: Täglich, Wöchentlich, Monatlich
  - Bei Wöchentlich: Wochentag
  - Bei Monatlich: Tag im Monat
- Erstellen-Button

### 3.6 Detail-Panel

Das Detail-Panel (400px, rechts) öffnet sich bei Klick auf eine Aufgabe. Inhalt:

- **Header:** Titel (editierbar), Prioritäts-Badge, Status-Dropdown
- **Formular:** Alle Felder editierbar (React Hook Form + Zod)
- **Verknüpfungen:** Klickbare Links zum verknüpften Produkt/Auftrag/Listing (Navigation)
- **Wiederkehrende Aufgabe:** Anzeige der Regel + Link zu vorherigen Instanzen
- **Verlauf** (bei wiederkehrenden Aufgaben): Liste der erledigten Vorgänger-Aufgaben mit Erledigungsdatum
- **Löschen-Button:** Soft-Delete mit Bestätigung
- **Speichern/Abbrechen** oben

### 3.7 Überfällige Aufgaben

Aufgaben mit `due_date < heute` UND `status` = todo oder in_progress gelten als überfällig.

Darstellung:
- Wochenansicht: Überfällige Aufgaben erscheinen in der heutigen Spalte mit rotem Rand
- Listenansicht: Fälligkeitsdatum in rot
- Sidebar: Badge-Counter in rot

---

## 4. Wiederkehrende Aufgaben

### 4.1 Mechanismus

Wenn eine Aufgabe mit `recurring_rule` als `done` markiert wird:

1. `completed_at` wird auf den aktuellen Zeitpunkt gesetzt
2. Eine neue Aufgabe wird erstellt mit:
   - Gleichem Titel, Beschreibung, Priorität, Verknüpfungen
   - Gleicher `recurring_rule`
   - `parent_task_id` = ID der soeben erledigten Aufgabe
   - `status` = todo
   - `due_date` = nächstes Fälligkeitsdatum basierend auf Intervall:
     - **daily**: `due_date + 1 Tag`
     - **weekly**: `due_date + 7 Tage` (oder nächster gewählter Wochentag)
     - **monthly**: Gleicher Tag im nächsten Monat (bei 31. → letzter Tag des Monats)
3. Die erledigte Aufgabe behält ihren Status `done` und bleibt im Verlauf

### 4.2 Verlauf

Über `parent_task_id` lässt sich die Kette aller vergangenen Instanzen einer wiederkehrenden Aufgabe nachvollziehen. Im Detail-Panel wird dieser Verlauf als kompakte Liste angezeigt.

### 4.3 Stoppen

Eine wiederkehrende Aufgabe kann gestoppt werden, indem die `recurring_rule` entfernt wird. Beim nächsten Erledigen wird dann keine neue Aufgabe erstellt.

---

## 5. Sidebar-Integration

Der Badge-Counter in der Sidebar zeigt die Anzahl überfälliger Aufgaben:

```
Aufgaben  [3]
```

Berechnung: `WHERE due_date < DATE('now') AND status IN ('todo', 'in_progress') AND deleted_at IS NULL`

Der Badge-Counter nutzt den bestehenden Sidebar Badge-Counter Mechanismus aus Foundation.

---

## 6. KI-Integration: Task Extractor

### 6.1 Funktion

Ein Dialog mit Textarea, in den der Nutzer Freitext einfügen kann (z.B. Notizen, E-Mails, Meeting-Notes). Der KI-Agent extrahiert daraus strukturierte Aufgaben.

### 6.2 Agent-Spezifikation

```typescript
// Registrierung beim AIService (Modul 06)
const TASK_EXTRACTOR_AGENT = 'task_extractor';

// Aktionen:
// extractTasks(text: string) → TaskSuggestion[]

interface TaskSuggestion {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string; // ISO date, falls aus Text ableitbar
  description?: string;
}
```

### 6.3 UI-Flow

1. Nutzer klickt "Aufgaben aus Text" Button
2. Dialog öffnet sich mit Textarea
3. Nutzer fügt Text ein, klickt "Extrahieren"
4. KI-Agent extrahiert Aufgaben
5. Ergebnisse werden als editierbare Liste angezeigt (DiffView analog Modul 06)
6. Nutzer kann jede Aufgabe einzeln annehmen, ablehnen oder bearbeiten
7. Angenommene Aufgaben werden in die tasks-Tabelle geschrieben
8. ai_jobs wird geloggt

### 6.4 System-Prompt

```
Du extrahierst konkrete, actionable Aufgaben aus dem folgenden Text.
Pro Aufgabe: Titel (kurz, max 100 Zeichen), Priorität (low/medium/high/urgent), 
optionales Fälligkeitsdatum (ISO-Format), optionale Beschreibung.
Ignoriere allgemeine Aussagen die keine Handlungsaufforderung enthalten.
Antworte ausschließlich als JSON-Array.
```

---

## 7. Command Palette Erweiterungen

Folgende Commands werden bei der Command Registry registriert:

| Command | Kategorie | Aktion |
|---------|-----------|--------|
| Neue Aufgabe | Aktionen | Öffnet Neue-Aufgabe-Modal |
| Zu Aufgaben | Navigation | Navigiert zu /tasks |
| Aufgaben aus Text | KI | Öffnet Task-Extractor-Dialog |

---

## 8. Integration mit bestehenden Modulen

### 8.1 Produkt-Detail-Panel (Modul 02)

Im Produkt-Detail-Panel kann ein neuer Tab "Aufgaben" hinzugefügt werden, der alle Aufgaben mit `product_id = dieses Produkt` zeigt. Alternativ: Aufgaben werden im bestehenden Übersicht-Tab als Abschnitt angezeigt. **Entscheidung: Kein neuer Tab. Aufgaben-Verknüpfung ist nur über die Aufgabenseite sichtbar, nicht im Produkt-Detail-Panel. Das hält die Komplexität niedrig.**

### 8.2 Auftrags-Detail-Panel (Modul 08)

Analog zu Produkten: Keine Aufgaben-Anzeige im Auftrags-Detail-Panel. Verknüpfung ist unidirektional (Aufgabe → Auftrag).

### 8.3 Sidebar

Badge-Counter für überfällige Aufgaben (siehe Abschnitt 5).

---

## 9. Akzeptanzkriterien

- [ ] Wochenansicht zeigt Aufgaben korrekt pro Tag und in der Ungeplant-Spalte
- [ ] KW-Navigation funktioniert (vorwärts, rückwärts, Heute)
- [ ] Drag-and-Drop verschiebt Fälligkeitsdatum (dnd-kit)
- [ ] Prioritäten werden farblich korrekt angezeigt
- [ ] Listenansicht mit allen Filtern und Sortierungen funktioniert
- [ ] Schnellerfassung in der Wochenansicht funktioniert (Titel + Enter)
- [ ] Vollständiges Formular (Modal) funktioniert mit Validierung
- [ ] Detail-Panel zeigt alle Felder und ist editierbar
- [ ] Verknüpfung mit Produkten, Aufträgen und Listings funktioniert
- [ ] Wiederkehrende Aufgaben erstellen automatisch Nachfolger
- [ ] Verlauf wiederkehrender Aufgaben ist im Detail-Panel sichtbar
- [ ] Sidebar-Badge zeigt korrekte Anzahl überfälliger Aufgaben
- [ ] KI Task Extractor funktioniert (Text → Aufgaben-Vorschläge)
- [ ] Command Palette enthält "Neue Aufgabe" und "Aufgaben aus Text"
- [ ] Soft-Delete funktioniert
- [ ] Kein TypeScript-Fehler im strict mode
- [ ] `npm run tauri dev` startet ohne Fehler
