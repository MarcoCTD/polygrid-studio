# Modul 17 Addendum 2: Dokument-Konfigurator

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026 | Erweitert MODUL_17_ANGEBOTE_RECHNUNGEN.md und MODUL_17_ADDENDUM_BAUSTEINE.md

## 1. Scope und Ziel

Ein zentraler Konfigurator für alle wiederverwendbaren Dokument-Inhalte: Positionsvorlagen (z.B. Komplettpaket 590 EUR, Onepager 390 EUR, Refresh 490 EUR), Baustein-Vorlagen inklusive einzeln aktivierbarer Stichpunkte, und Standard-Einleitungstexte. Bei der Angebots- und Rechnungserstellung wird nur noch ausgewählt statt getippt. Dazu zwei Darstellungskorrekturen: der Optional-Baustein wird als farbiger Kasten gerendert, und das Logo muss im polygrid-Layout oben links erscheinen (aktuell fehlt es, Ursache klären: Bug im Layout oder fehlende Konfiguration, siehe 5).

## 2. Konfigurator

### 2.1 Ort

Eigener Unterbereich im Dokumente-Tab: Button "Vorlagen verwalten" öffnet den Konfigurator als eigene Ansicht (kein Modal, genug Platz). Drei Abschnitte: Positionen, Bausteine, Einleitungstexte.

### 2.2 Positionsvorlagen

Verwaltung: Liste mit Anlegen/Bearbeiten/Löschen/Duplizieren. Felder pro Vorlage: Name (intern, z.B. "Onepager"), Titel (erscheint im Dokument, z.B. "Website-Erstellung Onepager"), Beschreibung (mehrzeilig), Einzelpreis, Standard-Menge (Default 1). Speicherung als JSON in app_settings (Key document_position_templates), keine Migration nötig.

Seed beim ersten Start: drei Vorlagen aus der Referenz des Nutzers: "Komplettpaket" (590 EUR, Beschreibung aus referenz-angebot.pdf übernehmen), "Onepager" (390 EUR, Beschreibung sinngemäß: einseitige Website mit allen Kerninfos, mobil optimiert, Kontaktbereich, technische Grundoptimierung), "Refresh" (490 EUR, Beschreibung sinngemäß: Modernisierung einer bestehenden Website, Design-Überarbeitung, mobile Optimierung, Inhaltsübernahme). Texte editierbar.

Im Editor: Beim Hinzufügen einer Position erscheint zuerst eine Auswahl "Aus Vorlage" (Dropdown mit Suche, zeigt Name und Preis) oder "Leere Position". Vorlage übernimmt Titel, Beschreibung, Preis, Menge; danach frei editierbar (Änderung wirkt nur im Dokument, nie zurück auf die Vorlage).

### 2.3 Baustein-Vorlagen mit einzeln wählbaren Stichpunkten

Die bisherigen "Als Standard speichern"-Keys werden durch den Konfigurator abgelöst (Migration der vorhandenen Keys beim ersten Laden, alte Werte übernehmen). Pro Dokumenttyp (Angebot/Rechnung) verwaltet der Konfigurator die Baustein-Liste: Reihenfolge, Titel, Texte, und pro Baustein ein Flag "standardmäßig aktiviert".

NEU, Kernwunsch: Bullet-Bausteine bestehen aus Stichpunkt-Einträgen, jeder Eintrag hat ein eigenes Flag "standardmäßig aktiviert". Datenstruktur items wird von string[] auf { text: string, enabled: boolean }[] erweitert. Abwärtskompatibilität: beim Parsen alter Dokumente/Snapshots werden nackte Strings als enabled true interpretiert (Zod-Transform, kein Migrationslauf nötig, Snapshots bleiben unangetastet gültig).

Im Editor: Beim Aufklappen eines Bullet-Bausteins erscheint jeder Stichpunkt mit eigener Checkbox. Beispiel Nutzer: im Baustein "Nicht enthalten" den Punkt "Professionelles Fotoshooting" per Häkchen zu- oder abschalten, ohne den Text zu löschen. Deaktivierte Punkte bleiben gespeichert, werden aber nicht gerendert. Neue Punkte hinzufügen wie bisher (Enter), zusätzlich pro Punkt entfernen.

### 2.4 Standard-Einleitungstexte

Konfigurator-Abschnitt drei: je Dokumenttyp ein Standard-intro_text und Standard-outro_text (Textarea, Variablen erlaubt, z.B. "Sehr geehrte/r {{kundenname}}, vielen Dank für Ihr Vertrauen..."). Neue Dokumente werden damit vorbelegt, im Editor frei änderbar.

## 3. Optional-Baustein als Hinweiskasten

Der Baustein optional_offer (und nur dieser) wird im polygrid-Layout als Kasten gerendert: Hintergrund --accent-primary-subtle, linker Rand 3px --accent-primary, Titel in Markenfarbe, abgerundete Ecken, Innenabstand. Druckfest (print-color-adjust: exact, im Print-Stylesheet verifizieren, sonst druckt macOS den Hintergrund weiß). Position: standardmäßig letzter Baustein vor validity_signature. Bestehende Snapshots rendern weiterhin korrekt (der Kasten ist reine Darstellung des kind, keine Datenänderung).

## 4. Editor-Vereinfachung

Durch den Konfigurator wird der Editor schlanker: Bausteine-Abschnitt zeigt die Checkbox-Liste (Baustein an/aus), aufklappen zeigt die Stichpunkt-Checkboxen und Texte. Die Buttons "Als Standard speichern" und "Zurücksetzen" verweisen jetzt auf den Konfigurator ("Standards verwalten" öffnet ihn direkt im passenden Abschnitt).

## 5. Logo-Fehler

Der Nutzer meldet: Logo fehlt oben links in Angebot und Rechnung. Zu klären in dieser Reihenfolge: (a) Rendert das polygrid-Layout das Logo überhaupt (Layout-Bug)? (b) Wird die Data-URL aus app_settings korrekt geladen und in den Snapshot eingefroren (E17-04)? (c) Druck: wird das Bild im Print-Kontext unterdrückt? Fix inklusive Fallback: ist KEIN Logo konfiguriert, wird stattdessen der Firmenname in der Kopfposition gerendert (fett, Markenfarbe), nie eine leere Lücke. E2E-Test: Dokument mit und ohne konfiguriertes Logo, Vorschau enthält img mit Data-URL bzw. Firmenname-Fallback.

## 6. Akzeptanzkriterien

- Konfigurator erreichbar aus dem Dokumente-Tab, drei Abschnitte funktional
- Positionsvorlagen: CRUD, Seed (Komplettpaket 590, Onepager 390, Refresh 490), Auswahl im Editor übernimmt alle Felder, nachträgliche Bearbeitung wirkt nur im Dokument
- Stichpunkte einzeln aktivierbar: Konfigurator setzt Defaults, Editor überschreibt pro Dokument, deaktivierte Punkte werden nicht gerendert aber bleiben erhalten
- Alte Dokumente und Snapshots mit string[]-items laden und rendern fehlerfrei (Kompatibilitäts-Test)
- Standard-Einleitungstexte belegen neue Dokumente vor, Variablen werden ersetzt
- Optional-Baustein erscheint als Markenfarben-Kasten, auch im Druck (print-color-adjust)
- Logo erscheint oben links in Vorschau und Druck; ohne konfiguriertes Logo erscheint der Firmenname, nie eine Lücke
- Migration der alten "Als Standard speichern"-Keys in den Konfigurator ohne Datenverlust
- Ausgestellte Dokumente bleiben unverändert (Snapshot-Isolation, Test)
- Regressionslauf aller Tests zweimal grün, TypeScript strict, ESLint, Prettier, cargo check grün
