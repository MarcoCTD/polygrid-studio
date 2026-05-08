# Modul 09: Entscheidungen

PolyGrid Studio Business OS | Mai 2026

Dieses Dokument dokumentiert alle Architektur- und Design-Entscheidungen für Modul 09 (Aufgaben-Modul). Es muss zusammen mit der Spec gelesen werden.

---

## E-01: Datenmodell-Erweiterungen

**Kontext:** Die `tasks`-Tabelle in DATABASE_SCHEMA.md v1.1 hat weder `deleted_at` noch `parent_task_id`.

**Entscheidung:**
- `deleted_at TEXT (ISO)` wird ergänzt (Soft-Delete, Standard-Konvention aller Tabellen)
- `parent_task_id TEXT (FK → tasks.id)` wird ergänzt (Recurring-Verlauf)
- Beide Felder erfordern eine Migration

**Begründung:** Soft-Delete ist projektweite Konvention. `parent_task_id` ermöglicht eine saubere Kette für wiederkehrende Aufgaben ohne separate Tabelle.

---

## E-02: Keine bidirektionale Integration in andere Module

**Kontext:** Die Original-Spec schlägt vor, Aufgaben auch im Produkt- und Auftrags-Detail-Panel anzuzeigen.

**Entscheidung:** Keine Aufgaben-Tabs oder -Abschnitte in Produkten, Aufträgen oder Listings. Die Verknüpfung ist unidirektional: Aufgabe → Entity.

**Begründung:**
- Hält die Komplexität niedrig (kein Umbau von Modul 02 oder 08)
- Aufgaben sind ein Planungswerkzeug, kein Teil der Entitäts-Logik
- In der Aufgabenliste kann man nach Verknüpfungstyp filtern
- Spätere Erweiterung (Aufgaben-Tab in Produkten) bleibt möglich

---

## E-03: Drag-and-Drop mit dnd-kit

**Kontext:** Die Wochenansicht braucht Drag-and-Drop zwischen Swim-Lanes.

**Entscheidung:** `dnd-kit` verwenden (bereits im Tech-Stack für Listing-Editor und Kanban).

**Implementierung:**
- `DndContext` um die gesamte Wochenansicht
- Jede Tagesspalte ist ein `useDroppable` Container
- Jede Aufgaben-Karte ist ein `useDraggable` Item
- `DragOverlay` für visuelles Feedback während des Drags
- `onDragEnd`: `due_date` auf den Zieltag setzen, DB-Update

**Kollisions-Strategie:** `closestCenter` (wie bei Kanban in Modul 08)

---

## E-04: Wochenansicht Layout

**Kontext:** 8 Spalten (Ungeplant + Mo–So) müssen auf verschiedenen Bildschirmbreiten funktionieren.

**Entscheidung:**
- CSS Grid mit `grid-template-columns: 200px repeat(7, 1fr)`
- Ungeplant-Spalte hat feste Breite (200px)
- Tagesspalten sind gleichmäßig aufgeteilt
- Minimale Content-Breite: 900px (bei schmaleren Screens horizontales Scrollen)
- Aufgaben-Karten haben `min-height: 60px`, truncated Titel

**Begründung:** Die App hat `max-width: 1200px` für den Content-Bereich. Bei 1200px sind die 7 Tagesspalten je ~143px breit, was für Karten ausreicht.

---

## E-05: KW-Navigation (ISO 8601)

**Kontext:** Die Wochenansicht navigiert wochenweise.

**Entscheidung:**
- ISO 8601 Kalenderwochen (Montag = erster Tag)
- State: `currentWeekStart` als ISO-Datumstring (immer ein Montag)
- Navigation: `← KW 19 →` mit Heute-Button
- Heute-Button setzt `currentWeekStart` auf den Montag der aktuellen Woche
- Heutiger Tag bekommt eine visuelle Hervorhebung (accent-primary Border oben)

**Helper-Funktionen:**
```typescript
getWeekStart(date: Date): Date  // Montag der Woche
getWeekNumber(date: Date): number  // ISO KW-Nummer
addWeeks(date: Date, n: number): Date
```

---

## E-06: Überfällige Aufgaben in der Wochenansicht

**Kontext:** Wenn der Nutzer KW 20 ansieht, aber überfällige Aufgaben aus KW 18 hat, wo zeigen wir diese?

**Entscheidung:**
- Überfällige Aufgaben werden NUR in der aktuellen KW angezeigt, und dort im heutigen Tag
- Sie haben einen roten linken Rand und ein "Überfällig"-Badge mit dem Original-Datum
- In vergangenen KW-Ansichten erscheinen sie normal an ihrem ursprünglichen Tag
- In zukünftigen KW-Ansichten erscheinen sie nicht

**Begründung:** Der Nutzer soll überfällige Aufgaben nicht vergessen. Sie "folgen" ihm in die aktuelle Woche, bis sie erledigt oder verschoben werden.

---

## E-07: Sidebar Badge-Counter Mechanismus

**Kontext:** Die Foundation hat einen Badge-Counter Mechanismus vorbereitet.

**Entscheidung:**
- Im `uiStore` (Zustand) gibt es einen `badgeCounts` State
- Modul 09 setzt `badgeCounts.tasks` bei:
  - App-Start
  - Jeder Statusänderung einer Aufgabe
  - Jeder `due_date`-Änderung
- Query: `SELECT COUNT(*) FROM tasks WHERE due_date < DATE('now') AND status IN ('todo', 'in_progress') AND deleted_at IS NULL`
- Badge-Farbe: immer rot (überfällig = dringend)

---

## E-08: KI Task Extractor Agent

**Kontext:** Modul 06 ist fertig und bietet das Provider-Pattern. Der Task Extractor muss sich dort eingliedern.

**Entscheidung:**
- Neuer Agent: `task_extractor` (registriert analog zu `listing_assistant` und `expense_assistant`)
- Eine Aktion: `extractTasks(text: string) → TaskSuggestion[]`
- Nutzt `generateStructured<T>` aus dem AIProvider Interface
- Output-Schema als Zod definiert:
  ```typescript
  const taskSuggestionSchema = z.array(z.object({
    title: z.string(),
    priority: taskPriorityEnum,
    due_date: z.string().optional(),
    description: z.string().optional(),
  }));
  ```
- UI: Dialog mit Textarea → Ergebnis als editierbare Liste → Annehmen/Ablehnen pro Aufgabe
- Logging in `ai_jobs` wie alle anderen KI-Aktionen

**System-Prompt:** Wird aus den Brand-Settings gelesen (Sprache), plus aufgabenspezifische Anweisungen.

---

## E-09: Recurring Rule — Edge Cases

**Kontext:** Wiederkehrende Aufgaben haben mehrere Sonderfälle.

**Entscheidungen:**

| Fall | Verhalten |
|------|-----------|
| Aufgabe ohne `due_date` + recurring_rule | `due_date` wird beim Erledigen auf `heute + Intervall` gesetzt |
| Monatlich, Tag 31, Monat hat nur 30 Tage | Letzter Tag des Monats |
| Monatlich, Tag 29-31, Februar | 28. (oder 29. im Schaltjahr) |
| Aufgabe wird als `cancelled` statt `done` markiert | Keine neue Aufgabe erstellt |
| Aufgabe wird über Drag-and-Drop verschoben | Nur `due_date` ändert sich, `recurring_rule` bleibt |
| Recurring stoppen | `recurring_rule` auf NULL setzen |

---

## E-10: Erledigte Aufgaben Anzeige

**Kontext:** Erledigte Aufgaben sollen nicht die UI verstopfen.

**Entscheidung:**
- **Wochenansicht:** Erledigte Aufgaben der angezeigten Woche werden ausgegraut dargestellt (opacity 0.5, durchgestrichener Titel). Toggle "Erledigte ausblenden" blendet sie komplett aus.
- **Listenansicht:** Erledigte Aufgaben werden standardmäßig ausgeblendet. Toggle "Erledigte anzeigen" zeigt sie an.
- Erledigte Aufgaben sind nicht draggable.

---

## E-11: Ordnerstruktur

**Entscheidung:** Feature-Ordner `src/features/tasks/` mit folgender Struktur:

```
src/features/tasks/
  index.ts                    # Exports
  TasksPage.tsx               # Hauptseite mit Ansichts-Toggle
  components/
    WeekView.tsx              # Wochenansicht mit Swim-Lanes
    WeekColumn.tsx            # Einzelne Tagesspalte
    TaskCard.tsx              # Aufgaben-Karte (draggable)
    ListView.tsx              # Listenansicht (TanStack Table)
    TaskDetailPanel.tsx       # Detail-Panel (rechts)
    NewTaskModal.tsx          # Neues-Aufgabe-Modal
    QuickAddInput.tsx         # Schnellerfassung in Wochenansicht
    TaskExtractorDialog.tsx   # KI-Aufgaben-aus-Text Dialog
    RecurringBadge.tsx        # Wiederkehrend-Indikator
    PriorityBadge.tsx         # Prioritäts-Badge
    EntityLink.tsx            # Verknüpfungs-Anzeige (Produkt/Auftrag/Listing)
  hooks/
    useTasks.ts               # CRUD-Operationen, Queries
    useTaskBadge.ts           # Sidebar Badge-Counter
    useWeekNavigation.ts      # KW-Navigation State
  services/
    taskService.ts            # DB-Operationen
    taskExtractorAgent.ts     # KI Task Extractor
  utils/
    dateHelpers.ts            # KW-Berechnung, Recurring-Logik
    recurringHelpers.ts       # Nächstes Fälligkeitsdatum berechnen
```

---

## E-12: Sub-Session-Aufteilung

| Sub-Session | Inhalt | Gate |
|-------------|--------|------|
| A | DB-Migration (deleted_at, parent_task_id) + Zod Schema + taskService (CRUD) | Build grün + Commit |
| B | TasksPage + WeekView + WeekColumn + KW-Navigation (ohne Drag-and-Drop, ohne Detail-Panel) | Build grün + Commit |
| C | TaskCard + Drag-and-Drop (dnd-kit) + QuickAddInput | Build grün + Commit |
| D | ListView (TanStack Table) + Filter + Sortierung | Build grün + Commit |
| E | NewTaskModal + TaskDetailPanel + Verknüpfungen | Build grün + Commit |
| F | Recurring Tasks (Logik + UI + Verlauf) | Build grün + Commit |
| G | Sidebar Badge-Counter + Überfällige-Logik + Erledigte-Toggle | Build grün + Commit |
| H | KI Task Extractor (Agent + Dialog) + Command Palette + Polish | Build grün + Commit |
