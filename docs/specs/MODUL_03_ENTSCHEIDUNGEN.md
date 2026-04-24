# Modul 03: Entscheidungsdokument

**PolyGrid Studio Business OS** | April 2026
Referenz für alle Sub-Sessions von Modul 03 (Dateimanager).

Dieses Dokument ergänzt `MODUL_03_DATEIMANAGER.md` um konkrete Umsetzungsentscheidungen, die in der Spec offen geblieben sind. Bei Widersprüchen gilt dieses Dokument.

---

## 1. Architektur-Grundsatz

### 1.1 Backend-Layer

- **Alle schreibenden Dateioperationen laufen ausschließlich über eigene Rust-Commands.** Das Tauri FS Plugin wird dafür NICHT genutzt, um die Pfadvalidierung zentral in Rust zu halten.
- **Lesende Operationen** (`list_directory`, `get_file_info`) ebenfalls über eigene Rust-Commands.
- **Datei öffnen mit Standardprogramm** (Doppelklick) läuft über `tauri-plugin-opener`.
- **Verzeichnis-Auswahl-Dialog** (Setup) läuft über `tauri-plugin-dialog` (bereits installiert).

### 1.2 Rust-Crates

- Für MVP **keine neue Cargo-Dependency** nötig.
- Dateisystem-Operationen nutzen `std::fs` und `std::path`.
- Thumbnail-Generierung passiert im Frontend via `convertFileSrc` — keine `image` Crate nötig.

---

## 2. OneDrive-Basispfad

### 2.1 Was wird gespeichert

- `app_settings.onedrive_base_path` enthält **den vollen Pfad inklusive `/PolyGrid Studio/`**.
- Beispiel macOS: `/Users/marco/Library/CloudStorage/OneDrive-Personal/PolyGrid Studio`
- Der User wählt im Setup-Dialog den OneDrive-Root (z.B. `OneDrive-Personal`), die App legt `/PolyGrid Studio/` darin an und speichert diesen kombinierten Pfad.

### 2.2 Ersteinrichtung

- **Setup-Trigger:** Router-Guard auf Route `/files` + optionaler Banner auf Dashboard.
- **App-Start nicht blockieren.** Module ohne OneDrive-Abhängigkeit (Produkte, Ausgaben etc.) funktionieren weiter.
- Sidebar-Item „Dateien" bleibt immer klickbar. Bei fehlendem Pfad zeigt die Files-Seite den Setup-Dialog inline.

### 2.3 Standardstruktur

- App bietet beim ersten Setup an, die Standardstruktur (`01_Finanzen` bis `09_Archiv`) anzulegen.
- Nutzer kann ablehnen, muss dann aber selbst Ordner anlegen.

---

## 3. Pfadvalidierung (kritisch)

### 3.1 Regel

**Jede Dateioperation validiert den Zielpfad gegen den canonicalisierten OneDrive-Basispfad.** Operationen außerhalb werden mit einem Error abgebrochen, bevor irgendetwas passiert.

### 3.2 Implementierung

- Bei existierenden Pfaden: `std::fs::canonicalize()` und Prefix-Check gegen canonicalisierten Basispfad.
- Bei noch nicht existierenden Zielpfaden (z.B. bei `create_directory`): Parent canonicalisieren, dann geplanten Kind-Namen anhängen, dann Prefix-Check.
- **Symlinks innerhalb des Basispfads, die auf Ziele außerhalb zeigen, werden blockiert.** Canonicalize löst Symlinks auf, sodass der Check automatisch greift.

### 3.3 Tauri-Permissions

Minimal halten. Neu hinzuzufügen zu `src-tauri/capabilities/default.json`:
- `dialog:allow-open` (für Verzeichnis-Auswahl beim Setup)

FS Plugin Permissions für Schreiben/Lesen werden NICHT erweitert, weil wir alles über eigene Rust-Commands mit `std::fs` machen.

---

## 4. Operations-Log und Undo

### 4.1 Persistenz

Eigene SQLite-Tabelle **`file_operations`** mit folgendem Schema:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | TEXT (UUID) PK | Primärschlüssel |
| `operation_type` | TEXT | `rename`, `move`, `copy`, `archive`, `create_dir` |
| `source_path` | TEXT | Quellpfad (relativ zu Basispfad) |
| `target_path` | TEXT | Zielpfad (relativ zu Basispfad), kann NULL sein bei `create_dir` |
| `status` | TEXT | `success`, `failed`, `undone` |
| `error_message` | TEXT | NULL bei Erfolg |
| `is_undoable` | INTEGER (bool) | 1 wenn rückgängig machbar, 0 wenn nicht |
| `created_at` | TEXT (ISO) | Zeitstempel der Operation |
| `undone_at` | TEXT (ISO) | NULL wenn nicht rückgängig gemacht |

### 4.2 Undo-Umfang (MVP)

- Nur die **letzte erfolgreiche, undobare Operation** kann rückgängig gemacht werden.
- Nach App-Neustart ist Undo weiterhin möglich (DB-persistent).
- Nach Undo wird der `status` auf `undone` gesetzt; kein Redo im MVP.

### 4.3 Undobare Operationen

| Operation | Undobar? | Wie |
|---|---|---|
| `rename` | Ja | Zurückbenennen |
| `move` | Ja | Zurückverschieben |
| `copy` | Ja | Kopie archivieren |
| `archive` | Ja | Aus Archiv zurückverschieben |
| `create_dir` | Nein (MVP) | Zu komplex (Inhalt?) |

---

## 5. Archivierung

### 5.1 Namenskonflikte

Bei `delete_to_archive`: Wenn Zielname in `/09_Archiv/` existiert, **Timestamp-Suffix anhängen**:

```
datei.stl → datei_2026-04-24_14-30-12.stl
```

**Niemals überschreiben.**

### 5.2 Ordnerstruktur im Archiv

Original-Substruktur wird erhalten:

```
Original: /02_Produkte/mein-produkt/STL/datei.stl
Archiviert: /09_Archiv/02_Produkte/mein-produkt/STL/datei_2026-04-24_14-30-12.stl
```

Nicht-existierende Zwischenordner werden im Archiv automatisch erzeugt.

---

## 6. Datenmodell `file_links` (erweitert)

Die bestehende `file_links` Tabelle wird um folgende Felder erweitert. **Das ist eine Schema-Änderung gegenüber Foundation** und wird in Sub-Session C via Migration umgesetzt.

### 6.1 Bestehende Felder

- `id`, `entity_type`, `entity_id`, `file_path`, `file_type`, `note`, `created_at`, `updated_at`

### 6.2 Neue Felder

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `is_primary` | INTEGER (bool) | 0 | Hauptbild/Haupt-STL eines Produkts |
| `position` | INTEGER | 0 | Reihenfolge für Bilder-Galerie |
| `file_size` | INTEGER | NULL | Dateigröße in Bytes |
| `mime_type` | TEXT | NULL | z.B. `image/png`, `model/stl` |
| `display_name` | TEXT | NULL | Freier Anzeigename, sonst Dateiname |

### 6.3 Pfad-Speicherung

- `file_path` wird **relativ zum OneDrive-Basispfad** gespeichert.
- Beispiel: `02_Produkte/mein-produkt/STL/datei.stl` (nicht der absolute Pfad).
- Begründung: Portabilität bei Pfad-Wechsel.

### 6.4 `products.primary_image_path`

- Bleibt als **relativer Pfad** (kein FK auf file_links).
- Wird gesetzt, wenn im File-Link mit `entity_type = 'product'` und `file_type = 'image'` das Flag `is_primary = 1` steht.
- Consistency-Handling: Nur ein File-Link pro Produkt darf `is_primary = 1` für einen bestimmten `file_type` haben. Beim Setzen eines neuen Primary wird der alte auf 0 gesetzt.

---

## 7. Produktordner-Erstellung

### 7.1 Trigger

**Beides — automatisch UND manuell:**

- **Automatisch:** Nach erfolgreichem Speichern im `NewProductDialog` erscheint ein Follow-up-Dialog „Produktordner jetzt anlegen?" mit Optionen „Ja, anlegen" und „Später".
- **Manuell:** Im `ProductFilesTab` gibt es einen Button „Produktordner anlegen", der nur sichtbar ist, solange der Ordner nicht existiert.

### 7.2 Ordner-Name-Normalisierung

Deutsche Umlaute werden **transliteriert**, nicht entfernt:

| Original | Normalisiert |
|---|---|
| ä | ae |
| ö | oe |
| ü | ue |
| Ä | Ae |
| Ö | Oe |
| Ü | Ue |
| ß | ss |

Zusätzlich:
- Alle Buchstaben auf Kleinschreibung
- Leerzeichen → Bindestrich
- Sonderzeichen (außer `-` und `_`) entfernen
- Mehrfache Bindestriche zu einem zusammenfassen
- Führende/abschließende Bindestriche entfernen

Beispiel: `Süße Ente mit Öhrchen!` → `suesse-ente-mit-oehrchen`

### 7.3 Struktur

Unter `02_Produkte/{normalisierter-name}/`:
- `STL/`
- `Slicer/`
- `Bilder/`
- `Listings/`
- `Verpackung/`
- `Lizenz/`

### 7.4 Produktumbenennung

Wenn ein Produkt umbenannt wird, **bleibt der Ordner unverändert**. Kein automatisches Rename. Post-MVP.

---

## 8. Thumbnails und Bildvorschau

### 8.1 Strategie

- **Frontend-basiert via `convertFileSrc`.**
- Originalbild wird geladen, CSS skaliert für Vorschau.
- Keine Rust-Thumbnail-Generierung im MVP.

### 8.2 Unterstützte Formate

- PNG, JPG, WEBP (macOS-Default)
- Keine Windows-spezifischen Tests im MVP.

### 8.3 Performance-Hinweis

Sehr große Bilder (>10MB) können UI kurzzeitig verzögern. Wird akzeptiert für MVP. Optimierung (Rust-Thumbnails) ist Post-MVP.

---

## 9. Verknüpfungsdialog und Entity-Typen

### 9.1 Aktive Entity-Typen im MVP

- **Nur `product`.**
- Dropdown-Einträge für `expense` und `order` sind vorhanden, aber **disabled mit Tooltip** „Verfügbar ab Modul 04/08".

### 9.2 Globaler Dateimanager

- Erlaubt nur Verknüpfungen zu Produkten, bis Module 04/08 implementiert sind.

---

## 10. UI-Scope-Einschränkungen für MVP

| Feature | Im MVP? | Wann? |
|---|---|---|
| Liste + Ordnerbaum | Ja | Sub-Session D |
| Kontextmenü für Dateiaktionen | Ja | Sub-Session E |
| Bestätigungsdialoge | Ja | Sub-Session E |
| Drag-and-Drop | Nein | Post-MVP (Session G oder später) |
| Grid-Ansicht | Nein | Toggle-Button vorbereiten, disabled |
| Image-Thumbnails | Ja | Sub-Session G, Frontend-basiert |
| Toast-System | Nein | Inline-Error-Banner stattdessen |
| Windows-Support | Nein | Post-MVP, nur macOS testen |

---

## 11. Fehleranzeige

- **Inline-Error-Banner im Files-Modul.** Keine neue Toast-Dependency.
- Fehler-State im Files-Store (Zustand).
- Banner schließbar, verschwindet automatisch nach 5 Sekunden bei Erfolg einer nachfolgenden Operation.

---

## 12. Bekannte Spec-Abweichungen

### 12.1 React 19 statt 18

Das Repo nutzt React 19, obwohl die Spec React 18 nennt. **Wird akzeptiert.** Keine Downgrade-Arbeit nötig. Alle neuen Komponenten nutzen React 19.

### 12.2 Schema-Erweiterung gegenüber Foundation

`file_links` wird um 5 Felder erweitert (siehe Abschnitt 6.2). Das ist eine Schema-Änderung gegenüber Modul 01. **Wird in Sub-Session C via saubere Migration umgesetzt**, nicht durch Bearbeitung des Foundation-Schemas.

### 12.3 Neue DB-Tabelle

`file_operations` (siehe Abschnitt 4.1) ist in Foundation noch nicht angelegt. **Wird in Sub-Session B via Migration ergänzt.**

---

## 13. Sub-Session-Plan

Übernommen von Codex' Analyse, mit unseren Entscheidungen gefüllt:

| Session | Titel | Scope-Kern |
|---|---|---|
| **A** | Analyse | ✅ Erledigt |
| **B** | Backend-Sicherheitskern & Settings | Rust-Commands (list/create/info/open), Pfadvalidierung, `onedrive_base_path` Settings-Zugriff, `file_operations` Tabelle |
| **C** | Dateioperationen & Operations-Log | rename/move/copy/archive Commands, Operations-Log schreiben, Undo-Command, `file_links` Schema-Erweiterung |
| **D** | OneDrive-Setup & globale Files-Seite | Setup-Dialog, Router-Guard, Ordnerbaum, Dateiliste, Breadcrumb |
| **E** | Dateiaktionen in der UI | Kontextmenüs, Bestätigungsdialoge, Fehler-Banner, Operationen aus UI auslösen |
| **F** | Verknüpfungsdialog & Produkt-Dateien-Tab | LinkFileDialog, ProductFilesTab, Produktordner-Erstellung (auto + manuell) |
| **G** | Bildvorschau & Polish | Thumbnails via convertFileSrc, Drag-and-Drop (wenn Zeit), macOS-Polish |
