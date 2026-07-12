# Entscheidungen: Auto-Import beim Datei-Verknüpfen

Branch: `fix/datei-import-beim-verknuepfen`. Ausgangspunkt: Der Datei-Picker
lässt jede Datei zu, das Speichermodell (relative Pfade zum OneDrive-Basisordner)
akzeptiert aber nur Dateien innerhalb der Basis. Bisher wurde außerhalb liegende
Auswahl mit einer roten Sperr-Meldung blockiert. Neu: Die Datei wird beim
Verknüpfen in die Basis KOPIERT (nie verschoben), der Verweis zeigt auf die
Kopie. Das Referenz-Modell (relative Pfade) bleibt unangetastet.

## E-01: Dedizierter Rust-Command `import_file_to_base` statt Aufweichen von `copy_file`

`copy_file` validiert Quelle UND Ziel gegen die Basis – das ist korrekt und
bleibt so. Für den Import gibt es einen eigenen Command
`import_file_to_base(base_path, source, target_folder, file_name)`:

- **Quelle:** absolute, existierende Datei, wird kanonisiert und nur GELESEN.
  Bewusst keine Basis-Validierung (das ist der Zweck des Commands). Ordner
  werden abgelehnt.
- **Ziel:** `target_folder` ist ein relativer Pfad; absolute Pfade, `..` und
  alle Nicht-Normal-Komponenten werden abgelehnt. Nach `create_dir_all` wird
  kanonisiert und geprüft, dass das Ziel in der Basis liegt (fängt auch
  Symlinks ab, die aus der Basis führen).
- Kein genereller Freibrief: Es gibt weiterhin KEINEN Command, der außerhalb
  der Basis schreibt oder löscht.

## E-02: Namenskonflikt löst Suffix `-1`, `-2`, … – nie überschreiben

Suffix vor der Endung (`foto.png` → `foto-1.png`), Abbruch nach 999 Versuchen.
Die Konfliktlösung passiert in Rust direkt vor `fs::copy` (kleinstmögliches
Fenster). Der Dialog zeigt vor dem Bestätigen den Ziel-ORDNER an, nicht den
endgültigen Dateinamen – der stünde wegen möglicher Suffixe erst nach der
Kopie fest.

## E-03: Import ist im Operations-Log, aber NICHT undo-fähig

`operation_type='import'` landet im `file_operations`-Log (Quelle als absoluter
Pfad, Ziel relativ). `is_undoable=false`, denn ein Undo würde die Kopie löschen
und damit einen file_link auf eine nicht existierende Datei hinterlassen.
Fehlgeschlagene Importe werden mit `status='failed'` geloggt (Audit-Spur),
ein file_link wird dann NICHT angelegt.

## E-04: Zielordner-Logik zentral in `src/features/files/importTarget.ts`

Kontextabhängig, rein und unit-getestet:

- **Produkt:** `02_Produkte/{produkt-slug}/{Unterordner}` – Produktbild/Mockup
  → `Bilder`, STL → `STL`, Slicer → `Slicer`, sonst Produktordner-Root.
  Slug über die bestehende `normalizeProductFolderName`-Logik. Fehlt der
  Produktordner, wird er inkl. Standardunterordnern über das bestehende
  `createProductFolderStructure` angelegt.
- **Ausgabe (Beleg):** `01_Finanzen/Belege_{Jahr}`, Jahr aus dem Ausgabendatum,
  Fallback aktuelles Jahr bei fehlendem/kaputtem Datum.
- **Auftrag:** `04_Auftraege`.

## E-05: Auftrags-Kontext nur als Logik, ohne UI-Anbindung

Es gibt aktuell KEINE Stelle, die Dateien mit Aufträgen verknüpft (der
"Auftrag"-Button im LinkFileDialog ist seit jeher deaktiviert). Die
Zielordner-Logik für `order` ist implementiert und getestet, damit sie beim
Anschluss der Auftrags-Verknüpfung fertig ist – UI-Vorgriff gab es nicht.

## E-06: Ausgaben-Beleg nutzt den Import, behält aber sein Speichermodell

Die Ausgaben-Belegverknüpfung verwendet NICHT den LinkFileDialog, sondern einen
eigenen Picker im Beleg-Tab (`receipt_file_path`, absoluter Pfad, kein
file_link). Bisher akzeptierte sie externe Pfade stillschweigend – derselbe
Modell-Bruch wie im Dialog, nur unsichtbar. Neu: Liegt der Beleg außerhalb der
Basis, erscheint ein Bestätigungsdialog mit Zielordner
(`01_Finanzen/Belege_{Jahr}`); nach Bestätigung wird kopiert und der (weiterhin
absolute) Pfad der Kopie gespeichert. `receipt_file_path` auf relative Pfade
umzustellen wäre eine Migration bestehender Daten und Konsumenten
(EÜR-Export, Öffnen-Button) – bewusst nicht Teil dieses Fixes. Belege innerhalb
der Basis werden exakt wie bisher gespeichert.

## E-07: Fehlerbilder

- Kopierfehler (Rechte, Platz, Quelle weg): deutsche Fehlermeldung aus der
  `FsError`-Übersetzung, Toast + Inline-Meldung, KEIN file_link bzw. kein
  Update von `receipt_file_path`.
- Kein OneDrive-Basispfad konfiguriert: Verhalten unverändert (Dialog meldet
  fehlenden Basispfad; Beleg-Picker speichert wie bisher direkt, da ohne Basis
  kein "außerhalb" existiert).
