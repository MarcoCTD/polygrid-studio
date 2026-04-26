# Modul 04: Ausgabenverwaltung

**PolyGrid Studio Business OS**
Anforderungsdokument | Version 1.0 | April 2026

---

## 1. Scope und Ziel

Dieses Modul implementiert die Erfassung und Verwaltung von Geschäftsausgaben. Es ermöglicht die strukturierte Kategorisierung, Belegverknüpfung und Auswertung aller Betriebskosten. Die KI-Klassifikation wird erst in Modul 06 implementiert.

### 1.1 Lieferergebnisse

- Ausgabenliste mit TanStack Table (Sortierung, Filter, Suche)
- Schnellerfassungsformular (Inline über der Tabelle)
- Vollständiges Bearbeitungsformular im Detail-Panel
- Monatssumme und Kategorien-Breakdown als Header-Widget
- Belegverknüpfung über `file_links` (aus Modul 03)
- Optionale Produktzuordnung
- Steuerrelevanz-Markierung
- Dauerhafter Disclaimer: "Ersetzt keine steuerliche Buchführung"
- Soft-Delete
- CSV-Export der Ausgaben (für Steuerberater)

### 1.2 Abhängigkeiten

- Foundation (App Shell, DB, Routing)
- Dateimanager (Modul 03) für Belegverknüpfung (optional, funktioniert auch ohne)
- Produktverwaltung (Modul 02) für optionale Produktzuordnung

---

## 2. Datenmodell

Das Schema wurde bereits in Foundation angelegt. Vollständige Felddefinition:

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | TEXT (UUID) | Ja | Primärschlüssel |
| `date` | TEXT (ISO) | Ja | Datum der Ausgabe |
| `amount_gross` | REAL | Ja | Bruttobetrag in EUR |
| `amount_net` | REAL | Nein | Nettobetrag (berechnet wenn leer) |
| `tax_amount` | REAL | Nein | Steuerbetrag |
| `vendor` | TEXT | Ja | Händler |
| `category` | TEXT | Ja | Hauptkategorie |
| `subcategory` | TEXT | Nein | Unterkategorie |
| `payment_method` | TEXT | Nein | PayPal, Kreditkarte, Überweisung |
| `purpose` | TEXT | Nein | Verwendungszweck |
| `product_id` | TEXT (FK) | Nein | Referenz auf Produkt |
| `receipt_attached` | BOOLEAN | Ja | Default: false |
| `receipt_file_path` | TEXT | Nein | Pfad zur Belegdatei |
| `tax_relevant` | BOOLEAN | Ja | Default: true |
| `recurring` | BOOLEAN | Ja | Default: false |
| `notes` | TEXT | Nein | Freitext |
| `deleted_at` | TEXT (ISO) | Nein | Soft-Delete |

---

## 3. Kategorien

Folgende Kategorien müssen als Enum/Konstante definiert werden:

| Kategorie | Unterkategorien (Beispiele) |
|---|---|
| Filament | PLA, PETG, TPU, ABS, Resin, Sondermaterial |
| Verpackung | Kartons, Füllmaterial, Klebeband, Aufkleber |
| Werkzeuge | Spatel, Pinzette, Cutter, Messinstrumente |
| Druckerzubehör | Düsen, Druckbett, Riemen, Ersatzteile |
| Maschinen/Hardware | Drucker, Enclosure, Upgrades, Computer |
| Software/SaaS | CAD-Software, Slicer-Lizenz, Cloud-Dienste, KI-API |
| Werbung | Etsy Ads, Social Media, Fotografie |
| Versand | Briefmarken, DHL, Hermes |
| Reisekosten | Messen, Abholung, Materialbesorgung |
| Büro | Papier, Tinte, Ordner |
| Sonstiges | Alles andere |

---

## 4. UI-Spezifikation

### 4.1 Header-Widget

Oben auf der Seite: Monatssumme (Brutto) prominent angezeigt, Vergleich zum Vormonat (Pfeil hoch/runter + Prozent), daneben ein Donut-Chart oder horizontales Balkendiagramm mit den Top-5-Kategorien des Monats. Monatsauswahl als Dropdown.

### 4.2 Schnellerfassung (Inline)

Ein kompaktes Formular direkt über der Tabelle mit: Datum (Default: heute), Betrag brutto, Händler, Kategorie (Dropdown), optionaler Produktbezug. Ein Klick auf "Hinzufügen" speichert die Ausgabe. Für erweiterte Felder gibt es einen "Mehr..." Link, der das Detail-Panel öffnet.

### 4.3 Tabelle

| Spalte | Details |
|---|---|
| Datum | Sortierbar, Format: TT.MM.JJJJ |
| Betrag (brutto) | Rechtsbündig, EUR formatiert |
| Händler | Text |
| Kategorie | Badge mit Farbe |
| Produktbezug | Produktname oder leer |
| Beleg | Icon: Haken wenn vorhanden, Warnung wenn nicht |
| Steuerrelevant | Icon: Haken oder X |

### 4.4 Detail-Panel

Bei Klick auf eine Ausgabe öffnet sich das Detail-Panel mit: Vollständigem Bearbeitungsformular, Belegverknüpfung (Datei auswählen aus OneDrive oder Drag-and-Drop), Produktzuordnung (Dropdown mit Suche), Löschen-Button (Soft-Delete mit Bestätigung).

---

## 5. CSV-Export

Button "Ausgaben exportieren" exportiert alle Ausgaben (oder gefilterte Auswahl) als CSV mit folgenden Spalten: Datum, Betrag Brutto, Betrag Netto, Steuer, Händler, Kategorie, Unterkategorie, Verwendungszweck, Steuerrelevant (Ja/Nein), Beleg (Ja/Nein). Dateiname: `ausgaben_JJJJ-MM.csv`. Speicherort: Nativer Speichern-Dialog.

---

## 6. Rechtlicher Hinweis

**Am unteren Rand der Ausgabenseite muss dauerhaft und gut sichtbar stehen:**

*"Dieses Modul unterstützt die Erfassung und Organisation von Ausgaben. Es ersetzt keine steuerliche Buchführung. Bitte konsultiere deinen Steuerberater."*

Dieser Hinweis darf nicht ausblendbar sein.

---

## 7. Akzeptanzkriterien

- Ausgaben können über Schnellerfassung und Detail-Panel angelegt werden
- Alle Filter und Sortierungen funktionieren
- Monatssumme und Kategorien-Breakdown werden korrekt berechnet
- Belegverknüpfung funktioniert (Datei auswählen, Haken-Icon erscheint)
- Produktzuordnung funktioniert (optional)
- CSV-Export generiert korrekte Datei
- Disclaimer ist dauerhaft sichtbar
- Soft-Delete funktioniert
