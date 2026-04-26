# Modul 03: Dateimanager

**PolyGrid Studio Business OS**
Anforderungsdokument | Version 1.0 | April 2026

---

## 1. Scope und Ziel

Dieses Modul implementiert die OneDrive-Integration und den Dateimanager. Die App greift direkt auf den lokalen OneDrive-Sync-Ordner zu (kein API-Zugriff). Der Nutzer kann Dateien browsen, Produktordner anlegen, Dateien umbenennen/verschieben und Dateien mit Entitäten verknüpfen.

### 1.1 Lieferergebnisse

- OneDrive-Ordner-Konfiguration (einmaliges Setzen des Basispfads)
- Zweispaltiger Dateimanager (links: Ordnerbaum, rechts: Dateiliste)
- Produktordner automatisch anlegen mit Standardunterordnern
- Dateien umbenennen, verschieben, kopieren via Tauri-Commands
- Dateiverknüpfungen (`file_links` Tabelle) zu Produkten, Ausgaben etc.
- Bildvorschau für PNG/JPG/WEBP
- Soft-Delete: Dateien werden nach `/09_Archiv` verschoben statt gelöscht
- Operations-Log für alle Dateiaktionen

### 1.2 Abhängigkeiten

- Foundation-Modul (App Shell, DB, Routing)
- Produktverwaltung (Modul 02) für Produktordner-Erstellung und Dateiverknüpfung
- Tauri Rust-Backend für Dateioperationen (Commands müssen geschrieben werden)

---

## 2. OneDrive-Integration

### 2.1 Architektur

Die App greift NICHT über die OneDrive-API zu. OneDrive synchronisiert Dateien in einen lokalen Ordner. Die App behandelt diesen wie ein normales Verzeichnis. Bei Wechsel des Cloud-Anbieters muss nur der Basispfad geändert werden.

### 2.2 Ersteinrichtung

- Beim ersten Start prüft die App, ob ein OneDrive-Pfad konfiguriert ist
- Falls nicht, zeigt sie einen Einrichtungs-Dialog mit nativem Verzeichnis-Auswahlfeld (Tauri Dialog-API)
- Der gewählte Pfad wird in `app_settings` gespeichert (key: `onedrive_base_path`)
- Bei jedem Start wird geprüft, ob der Ordner noch existiert. Falls nicht: Warnhinweis mit Option zur Neukonfiguration

### 2.3 Standard-Ordnerstruktur

Bei Ersteinrichtung bietet die App an, die folgende Struktur im gewählten Ordner anzulegen:

```
/PolyGrid Studio/
  /01_Finanzen/
    /Belege_2026/
    /Exporte/
  /02_Produkte/
  /03_Listings/
  /04_Auftraege/
  /05_Vorlagen/
  /06_Rechtliches/
  /07_Marktrecherche/
  /08_Content/
  /09_Archiv/
```

### 2.4 Produktordner

Wenn ein neues Produkt erstellt wird (aus Modul 02), bietet die App an, automatisch einen Ordner unter `/02_Produkte/{produktname}/` mit folgenden Unterordnern anzulegen:

- `STL`
- `Slicer`
- `Bilder`
- `Listings`
- `Verpackung`
- `Lizenz`

**Ordnername-Normalisierung:** Sonderzeichen entfernt, Leerzeichen durch Bindestriche, Kleinbuchstaben.

---

## 3. Tauri-Commands (Rust-Backend)

Folgende Tauri-Commands müssen im Rust-Backend implementiert werden:

| Command | Beschreibung |
| --- | --- |
| `list_directory(path)` | Verzeichnis auflisten (Name, Typ, Größe, Datum) |
| `create_directory(path)` | Ordner erstellen (rekursiv) |
| `rename_file(old_path, new_path)` | Datei/Ordner umbenennen |
| `move_file(source, target)` | Datei verschieben |
| `copy_file(source, target)` | Datei kopieren |
| `delete_to_archive(path)` | Datei nach `/09_Archiv` verschieben |
| `get_file_info(path)` | Metadaten lesen (Größe, Datum, Typ) |
| `read_image_thumbnail(path, size)` | Thumbnail für Bildvorschau generieren |
| `open_in_explorer(path)` | Ordner im nativen Dateimanager öffnen |

Alle Operationen müssen in einem Operations-Log protokolliert werden (Aktion, Quelle, Ziel, Zeitstempel, Erfolg/Fehler). Bei Fehlern wird die Operation zurückgerollt und der Nutzer informiert.

---

## 4. UI-Spezifikation

### 4.1 Layout

Zweispaltig: Links Ordnerbaum (240px, scrollbar), rechts Dateiliste mit Toolbar oben und optionaler Vorschau.

### 4.2 Ordnerbaum (links)

- Baumansicht mit aufklappbaren Ordnern
- Lazy Loading: Unterordner werden erst beim Aufklappen geladen
- Klick auf Ordner zeigt Inhalt rechts
- Kontextmenü (Rechtsklick): Neuer Unterordner, Umbenennen, Im Explorer öffnen

### 4.3 Dateiliste (rechts)

- Spalten: Icon (nach Dateityp), Name, Größe, Geändert am, Verknüpfung (Produkt/Ausgabe)
- Sortierung nach jeder Spalte
- Doppelklick öffnet Datei mit Standardprogramm (Tauri `shell.open`)
- Kontextmenü: Umbenennen, Verschieben, Kopieren, Archivieren, Verknüpfen mit...
- Drag-and-Drop zwischen Ordnern (innerhalb der App)
- Bildvorschau: Bei Auswahl einer PNG/JPG/WEBP Datei erscheint ein Vorschaubereich

### 4.4 Toolbar

- Neuer Ordner (Button)
- Produktordner anlegen (Dropdown mit Produktauswahl)
- Ansicht umschalten (Liste/Grid)
- Pfad-Breadcrumb oben

---

## 5. Dateiverknüpfungen (file_links)

Dateien können mit Entitäten verknüpft werden (Produkte, Ausgaben, Aufträge etc.). Die `file_links` Tabelle wurde bereits in Foundation angelegt.

### 5.1 Verknüpfungs-Dialog

Beim Kontextmenü "Verknüpfen mit..." erscheint ein Dialog mit:

- Entity-Typ Auswahl (Produkt, Ausgabe, Auftrag)
- Suchfeld für die Entität
- Dateityp (STL, Slicer, Bild, Mockup, Beleg etc.)
- Optionale Notiz

Die Verknüpfung wird in `file_links` gespeichert.

### 5.2 Integration in andere Module

Im Dateien-Tab des Produkt-Detail-Panels (Modul 02) werden jetzt die verknüpften Dateien angezeigt statt des Platzhalters. Dort können auch neue Verknüpfungen erstellt werden.

---

## 6. Sicherheit

- Keine endgültige Löschung. Dateien werden immer nach `/09_Archiv` verschoben.
- Bestätigungs-Dialog vor jeder Verschiebung/Umbenennung
- Undo für die letzte Dateioperation (im Operations-Log gespeichert)
- Pfad-Validierung: Keine Operationen außerhalb des OneDrive-Basispfads erlaubt

---

## 7. Akzeptanzkriterien

- OneDrive-Ordner kann konfiguriert werden (nativer Verzeichnis-Dialog)
- Ordnerstruktur wird korrekt angezeigt (Baumansicht lazy-loaded)
- Dateien können umbenannt, verschoben, kopiert und archiviert werden
- Produktordner mit Unterordnern werden korrekt erstellt
- Dateiverknüpfungen funktionieren und erscheinen im Produkt-Detail-Panel
- Bildvorschau für PNG/JPG/WEBP funktioniert
- Operations-Log zeichnet alle Aktionen auf
- Fehlermeldung wenn OneDrive-Ordner nicht erreichbar
- Alle Tauri-Commands laufen fehlerfrei auf macOS
