# Modul 12: Platform Sync — Entscheidungsdokument

PolyGrid Studio Business OS | Mai 2026

Dieses Dokument klärt alle offenen Fragen vor der Implementierung von Modul 12 (Platform Sync). Jede Entscheidung hat eine klare Empfehlung. Die Sub-Session-Aufteilung am Ende basiert auf diesen Entscheidungen.

---

## E01: OAuth-Redirect-Strategie (Loopback vs. Custom URL Scheme)

**Frage:** Wie fangen wir den OAuth-Redirect in einer Desktop-App ab?

**Option A: Temporärer Localhost-Server (`tauri-plugin-oauth`)**
- Vorteile: Funktioniert mit beiden Plattformen (Etsy verlangt HTTPS oder localhost), gut getestetes Tauri-Plugin, kein OS-spezifisches Deep-Link-Setup
- Nachteile: Port muss frei sein, Firewall kann blockieren

**Option B: Custom URL Scheme (Deep-Link, z.B. `polygrid://callback`)**
- Vorteile: Kein offener Port nötig
- Nachteile: Etsy erlaubt nur HTTPS oder localhost als Redirect-URI, eBay braucht eine registrierte RuName mit echtem URL-Schema. Beide Plattformen unterstützen keine Custom Schemes

**Option C: Eingebetteter WebView**
- Vorteile: Alles in der App
- Nachteile: macOS blockiert WebView-Redirects auf Nicht-HTTPS-Protokolle, Sicherheitsbedenken, von Plattformen teilweise untersagt

**Empfehlung: Option A.** `tauri-plugin-oauth` startet einen temporären localhost-Server, öffnet den System-Browser für den OAuth-Flow und empfängt den Authorization Code via Redirect auf `http://localhost:{port}/callback`. Das Plugin wird zum Tech-Stack hinzugefügt. Für Etsy wird `http://localhost:{port}/callback` als Redirect-URI registriert. Für eBay wird die RuName mit Accept-URL auf `http://localhost:{port}/callback` konfiguriert.

---

## E02: Token-Refresh-Strategie

**Frage:** Wann werden abgelaufene Tokens erneuert?

**Option A: Proaktiver Refresh vor jedem API-Call**
- Vorteile: Kein Call schlägt wegen abgelaufenem Token fehl
- Nachteile: Overhead bei jedem Call, Token-Ablaufzeit muss lokal gespeichert werden

**Option B: Reaktiver Refresh bei 401-Antwort**
- Vorteile: Einfacher zu implementieren, weniger Aufwand
- Nachteile: Erster Call schlägt fehl, muss wiederholt werden

**Option C: Hybrid (proaktiv mit 5-Minuten-Puffer + reaktiver Fallback)**
- Vorteile: Best of both worlds, kaum 401-Fehler, aber trotzdem Failsafe
- Nachteile: Etwas mehr Code

**Empfehlung: Option C.** Token-Ablaufzeit wird beim Empfang gespeichert (Keychain: Token + Ablauf-Timestamp). Vor jedem API-Call prüft der Provider, ob der Token in weniger als 5 Minuten abläuft, und refresht proaktiv. Falls trotzdem ein 401 kommt (z.B. weil der Token serverseitig revoked wurde), wird ein Refresh versucht. Bei Refresh-Fehler wird der Nutzer zur Re-Authentifizierung aufgefordert.

Token-Gültigkeiten:
- Etsy: Access Token 1h, Refresh Token 90 Tage
- eBay: Access Token 2h, Refresh Token 18 Monate

---

## E03: Sync-Konflikt-Strategie

**Frage:** Was passiert, wenn ein Listing lokal UND auf der Plattform geändert wurde?

**Option A: Local-Wins (PolyGrid überschreibt Plattform)**
- Vorteile: Konsistent mit "PolyGrid ist Single Source of Truth"
- Nachteile: Plattform-Änderungen gehen verloren

**Option B: Remote-Wins (Plattform überschreibt PolyGrid)**
- Vorteile: Plattform-Daten bleiben immer aktuell
- Nachteile: Widerspricht Single-Source-of-Truth-Prinzip

**Option C: Manuell entscheiden (Conflict-UI)**
- Vorteile: Nutzer hat volle Kontrolle, keine Datenverluste
- Nachteile: Mehr UI-Aufwand, unterbricht den Workflow

**Empfehlung: Option C mit Push-Bias.** Bei einem Push von PolyGrid zur Plattform zeigt ein Diff-View die lokalen vs. Remote-Daten. Der Nutzer kann wählen: "Meine Version pushen" (überschreibt Remote) oder "Plattform-Version übernehmen" (überschreibt lokal). Bei einem Pull (Order-Import) werden Remote-Daten immer als neue Einträge angelegt, nie bestehende überschrieben. Der sync_status wird auf `conflict` gesetzt, wenn ein Unterschied erkannt wird.

---

## E04: Bild-Upload-Workflow (Etsy)

**Frage:** Wie werden Bilder auf Etsy hochgeladen? Und was passiert bei Reihenfolge-Änderungen?

**Option A: Immer kompletter Re-Upload aller Bilder**
- Vorteile: Einfach, garantiert konsistent
- Nachteile: Langsam, verbraucht API-Calls, kann Bild-IDs ändern

**Option B: Delta-Upload (nur neue/geänderte Bilder)**
- Vorteile: Schneller, weniger API-Calls
- Nachteile: Komplex, Reihenfolge-Tracking nötig, Etsy-Image-IDs müssen in `platform_metadata` gespeichert werden

**Empfehlung: Option A für MVP.** Beim Push eines Listings werden zuerst alle bestehenden Bilder gelöscht, dann alle aktuellen Bilder in der richtigen Reihenfolge hochgeladen. Das ist maximal 10 Bilder (Etsy-Limit), also überschaubar. Die Bild-IDs werden in `platform_metadata.etsy_image_ids` gespeichert. Für ein späteres Update kann auf Delta-Upload umgestellt werden, wenn die API-Call-Limits zum Problem werden.

Bilder kommen aus dem Dateimanager (Modul 03). Der Bild-Upload liest die verknüpften Bilder aus `file_links` (entity_type = listing, file_type = image) und lädt sie in Reihenfolge hoch.

---

## E05: Bild-Upload-Workflow (eBay)

**Frage:** Wie werden Bilder auf eBay hochgeladen?

eBay verwendet einen separaten Bild-Hosting-Service. Bilder werden via Trading API `UploadSiteHostedPictures` hochgeladen und liefern eine URL zurück. Diese URL wird dann im `createOrReplaceInventoryItem` referenziert.

**Option A: Trading API für Bild-Upload**
- Vorteile: Offiziell unterstützt, stabile URLs
- Nachteile: Braucht Trading API Token (separater Auth-Scope), ältere XML-basierte API

**Option B: Bild-URL extern hosten (z.B. OneDrive Public Link)**
- Vorteile: Kein separater Upload nötig
- Nachteile: OneDrive-Links können sich ändern, sind nicht zuverlässig

**Empfehlung: Option A.** Die Trading API wird nur für `UploadSiteHostedPictures` verwendet. Die Upload-Funktion ist XML-basiert, aber gut dokumentiert. Die resultierende eBay-gehostete URL wird in `platform_metadata.ebay_image_urls` gespeichert. Das ist der einzige Ort, an dem die Trading API benötigt wird; alle anderen Operationen laufen über die Sell Inventory API (REST).

---

## E06: Variant-Handling (eBay Inventory Item Groups)

**Frage:** Wie werden Produktvarianten auf eBay abgebildet?

**Option A: Jede Variante als separates Listing**
- Vorteile: Einfach, kein Inventory Item Group nötig
- Nachteile: Mehr Listings, schlechtere UX für Käufer

**Option B: Inventory Item Group (Multi-Variation Listing)**
- Vorteile: Professionelles Listing mit Varianten-Auswahl
- Nachteile: Komplexer Flow (createOrReplaceInventoryItem pro SKU + createOrReplaceInventoryItemGroup + publishOfferByInventoryItemGroup)

**Empfehlung: Option A für MVP, Option B als Post-MVP-Erweiterung.** Im MVP wird jede Variante als eigenes Inventory Item + eigenes Offer behandelt. Die Varianten-Info aus dem Listing wird im SKU-Suffix codiert (z.B. `PG-001-ROT`, `PG-001-BLAU`). Das Inventory-Item-Group-Konzept wird in `platform_metadata` vorbereitet (Feld `ebay_inventory_item_group_key`), aber erst nach dem MVP implementiert.

---

## E07: Diff-View vor Push

**Frage:** Soll vor jedem Push an eine Plattform ein Diff-View angezeigt werden?

**Option A: Immer Diff-View anzeigen**
- Vorteile: Volle Kontrolle, keine versehentlichen Pushes
- Nachteile: Kann bei vielen Listings nervig werden

**Option B: Diff-View nur bei erstem Push oder bei Konflikten**
- Vorteile: Weniger Klicks bei Updates
- Nachteile: Weniger Kontrolle

**Empfehlung: Option A.** Konsistent mit dem bestehenden KI-Pattern (Modul 06: jede Änderung durch Diff-View bestätigen). Der Diff-View zeigt: Was wird geändert (lokal vs. aktuell auf der Plattform), welche Felder werden übertragen, welche Bilder werden hochgeladen. Buttons: "Push bestätigen", "Abbrechen", "Einzelne Felder abwählen". Das ist besonders wichtig, weil ein Push reale Auswirkungen auf live Listings hat.

---

## E08: Auftragsimport (Pull) — Manuell vs. Automatisch

**Frage:** Sollen Bestellungen automatisch von den Plattformen importiert werden?

**Option A: Nur manuell per Button**
- Vorteile: Volle Kontrolle, kein Risiko doppelter Aufträge
- Nachteile: Nutzer muss regelmäßig dran denken

**Option B: Automatisch im Hintergrund (z.B. alle 30 Min)**
- Vorteile: Aufträge sind immer aktuell
- Nachteile: Kann zu Race-Conditions führen, wenn der Nutzer gleichzeitig manuell Aufträge eingibt

**Option C: Manuell mit optionalem Auto-Sync**
- Vorteile: Flexibel, Nutzer entscheidet
- Nachteile: Etwas mehr UI-Aufwand

**Empfehlung: Option C.** Im MVP ist Order-Pull nur manuell per Button auf der `/sync` Seite. Ein Setting `sync_pull_orders_enabled` (Default: false) wird vorbereitet. Wenn aktiviert, werden Bestellungen im eingestellten Intervall automatisch abgerufen. Bei jedem Import wird gegen `external_order_id` geprüft, ob der Auftrag bereits existiert, um Duplikate zu vermeiden. Importierte Aufträge werden als `external_synced = true` markiert.

---

## E09: Behandlung gelöschter Plattform-Listings

**Frage:** Was passiert, wenn ein Listing auf der Plattform gelöscht oder deaktiviert wurde, aber in PolyGrid noch existiert?

**Option A: Automatisch lokal als "paused" markieren**
- Vorteile: Lokal immer aktuell
- Nachteile: Nutzer weiß evtl. nicht warum

**Option B: Warnung anzeigen, Nutzer entscheidet**
- Vorteile: Volle Kontrolle
- Nachteile: Mehr Aufwand

**Empfehlung: Option B.** Beim nächsten Sync-Check (manuell oder automatisch) wird geprüft, ob das Listing auf der Plattform noch existiert. Falls nicht: `sync_status = conflict`, `sync_error_message = "Listing auf Plattform nicht mehr vorhanden"`. Der Nutzer sieht das in der Sync-Übersicht und kann entscheiden: Listing lokal archivieren, Listing erneut pushen, oder ignorieren. Kein automatisches Ändern des lokalen Status.

---

## E10: Versand-Profile / Business Policies Setup-Prozess

**Frage:** Etsy braucht Shipping Profiles (jetzt Processing Profiles), eBay braucht Fulfillment/Payment/Return Policies. Werden diese in PolyGrid verwaltet?

**Option A: Komplett in PolyGrid verwalten (CRUD für Profiles/Policies)**
- Vorteile: Alles in einer App
- Nachteile: Extrem aufwändig, Plattform-UIs sind dafür besser geeignet, API-Endpoints teilweise eingeschränkt

**Option B: Auf der Plattform erstellen, in PolyGrid nur referenzieren (ID-basiert)**
- Vorteile: Deutlich weniger Aufwand, Profile/Policies ändern sich selten, Plattform-UI ist besser geeignet
- Nachteile: Nutzer muss einmalig Profile auf der Plattform erstellen und IDs manuell eintragen oder per Pull abrufen

**Empfehlung: Option B.** Der Nutzer erstellt Shipping/Processing Profiles auf Etsy und Business Policies auf eBay direkt auf den Plattformen. In den Settings (Tab "Plattformen") gibt es pro Plattform einen Button "Profile von Plattform laden", der die verfügbaren Profile abruft und in einem Dropdown zur Auswahl anbietet. Die gewählte Default-ID wird in `app_settings` gespeichert. Beim Push wird diese ID mitgeschickt. Falls kein Default gesetzt ist, wird der Push blockiert mit Hinweis "Bitte erst Versandprofil in den Settings konfigurieren".

---

## E11: Etsy Taxonomy-ID

**Frage:** Etsy verlangt eine `taxonomy_id` für jedes Listing. Sollen wir ein Kategorie-Mapping bauen?

**Option A: Vollständiger Kategorie-Browser (Etsy hat ~24.000 Kategorien)**
- Vorteile: Professionell
- Nachteile: Riesiger Aufwand, komplexe UI

**Option B: Freitext-Suche über Etsy-Taxonomie-API**
- Vorteile: Einfacher als voller Browser
- Nachteile: Immer noch komplex

**Option C: Default-Taxonomy-ID in Settings, pro Listing optional override**
- Vorteile: Für ein 3D-Druck-Shop mit ähnlichen Produkten reicht oft eine Kategorie
- Nachteile: Nicht ideal wenn Produktpalette sehr divers wird

**Empfehlung: Option C für MVP, Option B als Post-MVP.** 3D-Druck-Produkte fallen meist in wenige Etsy-Kategorien. In den Settings wird eine `etsy_default_taxonomy_id` konfiguriert (initial per manuellem Lookup auf Etsy oder per API-Abruf der Top-Kategorien). Pro Listing kann optional eine abweichende Taxonomy-ID in `platform_metadata` gespeichert werden. Im MVP wird kein Kategorie-Browser gebaut.

---

## E12: Rate-Limit-Handling

**Frage:** Wie gehen wir mit API-Rate-Limits um?

Rate-Limits:
- Etsy: 10 Calls/Sekunde, kein Tageslimit mehr (Stand 2025)
- eBay: Variiert nach Call-Typ, typisch 5000 Calls/Tag für Standard-Apps

**Option A: Einfaches Sleep zwischen Calls**
- Vorteile: Einfach zu implementieren
- Nachteile: Nicht präzise, kann zu langsam sein

**Option B: Token-Bucket mit Retry und Exponential Backoff**
- Vorteile: Optimal, respektiert Limits, nutzt Kapazität gut aus
- Nachteile: Mehr Code

**Empfehlung: Option B.** Implementierung eines Token-Bucket-Rate-Limiters pro Plattform. Pro API-Call wird geprüft, ob genug Budget vorhanden ist. Wenn nicht, wird gewartet. Bei 429-Responses (Rate Limited) wird mit Exponential Backoff (1s, 2s, 4s, max 30s) erneut versucht, maximal 3 Retries. Der Retry-Count wird in `sync_jobs.retry_count` protokolliert. Bei eBay werden die Rate-Limit-Header (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) ausgewertet.

---

## E13: Listing-Status-Mapping

**Frage:** Wie werden die lokalen Listing-Statustexte auf Plattform-Aktionen abgebildet?

| PolyGrid Status | Etsy-Aktion                        | eBay-Aktion                     |
|-----------------|------------------------------------|---------------------------------|
| draft           | Kein Push möglich                  | Kein Push möglich               |
| online          | createDraftListing + set active    | createOffer + publishOffer      |
| paused          | updateListing state=inactive       | withdrawOffer                   |
| archived        | deleteListing (oder inactive)      | withdrawOffer + deleteOffer     |

**Empfehlung:** Push ist nur möglich, wenn der lokale Status `online` oder `paused` ist. Draft-Listings können nicht gepusht werden (Warnung: "Listing muss mindestens den Status 'online' haben"). Beim Archivieren eines bereits gepushten Listings wird der Nutzer gefragt, ob das Listing auch auf der Plattform deaktiviert werden soll.

---

## E14: eBay Item Specifics (Pflichtfelder)

**Frage:** eBay verlangt je nach Kategorie bestimmte Item Specifics (z.B. "Marke", "Material", "Farbe"). Wie bilden wir das ab?

**Option A: Automatisches Mapping von PolyGrid-Produktfeldern auf Item Specifics**
- Vorteile: Wenig manueller Aufwand
- Nachteile: Nicht alle Item Specifics sind aus Produktdaten ableitbar

**Option B: Manuelles Eingabeformular für Item Specifics pro Listing**
- Vorteile: Volle Kontrolle
- Nachteile: Aufwändig

**Option C: Hybrid (Auto-Mapping + manuelle Ergänzung in platform_metadata)**
- Vorteile: Best of both worlds
- Nachteile: UI muss beide Fälle abdecken

**Empfehlung: Option C.** Beim Push wird automatisch gemappt: `material_type` → "Material", Produktname → "Titel", `brand_preferred_words[0]` oder `company_name` → "Marke". Zusätzliche oder abweichende Item Specifics werden in `platform_metadata.ebay_item_aspects` gespeichert (JSON-Objekt). Im Listing-Editor (Tab oder Abschnitt "eBay-Details") können diese manuell bearbeitet werden. Fehlende Pflicht-Item-Specifics blockieren den Push mit klarer Fehlermeldung.

---

## E15: Scope und Reihenfolge der Plattform-Implementierung

**Frage:** Implementieren wir Etsy und eBay gleichzeitig oder nacheinander?

**Option A: Beide gleichzeitig (gemeinsames Provider-Interface)**
- Vorteile: Provider-Pattern erzwingt saubere Abstraktion
- Nachteile: Höheres Risiko, mehr gleichzeitige Komplexität

**Option B: Etsy zuerst, dann eBay**
- Vorteile: Einfacherer Start (Etsy API ist simpler), Learnings für eBay
- Nachteile: Ohne eBay-Erfahrung könnte das Interface nicht gut genug passen

**Empfehlung: Option B.** Das Provider-Interface wird in Sub-Session A definiert. In Sub-Session B wird Etsy implementiert (OAuth + Listing Push/Pull). In Sub-Session C wird eBay implementiert. So können Erkenntnisse aus Etsy in das eBay-Setup einfließen. Die Sync-UI wird parallel in Sub-Session D gebaut und funktioniert plattformübergreifend.

---

## Sub-Session-Aufteilung

### Sub-Session A: Foundation (Backend-Infrastruktur)

**Scope:**
- `tauri-plugin-oauth` installieren und konfigurieren
- `PlatformSyncProvider` Interface definieren (TypeScript)
- `sync_jobs` Tabelle: Drizzle-Schema, Migration, Service-Layer
- Listings-Schema erweitern: `external_id`, `sync_status`, `sync_error_message`, `last_synced_at`, `platform_metadata`
- Orders-Schema erweitern: `external_synced`
- Token-Management-Service: Keychain lesen/schreiben für OAuth-Tokens, Ablaufzeit-Tracking
- Rate-Limiter-Utility: Token-Bucket mit Exponential Backoff
- HTTP-Client-Wrapper: Zentraler Fetch mit Token-Injection, Rate-Limiting, Error-Handling, Logging nach sync_jobs
- Settings-Keys anlegen (Defaults)
- Neue Tauri-Commands: `start_oauth_server`, `stop_oauth_server`, `get_keychain_token`, `set_keychain_token`, `delete_keychain_token`

**Gate:** `npm run tauri dev` grün, alle neuen Schemas kompilieren, Tauri-Commands aufrufbar

---

### Sub-Session B: Etsy-Provider (OAuth + Listing Sync)

**Scope:**
- `EtsyProvider` implementiert `PlatformSyncProvider`
- OAuth 2.0 Flow: Authorization Code Grant mit PKCE, `tauri-plugin-oauth` für Redirect
- Token Exchange + Token Refresh
- `getShop()` zum Abrufen der Shop-ID nach Auth
- `pushListing()`: createDraftListing → uploadListingImage (alle Bilder) → updateListing (state=active)
- `updateListing()`: updateListing (Felder) + Bild-Re-Upload wenn geändert
- `pauseListing()`: updateListing state=inactive
- `deleteListing()`: deleteListing
- `pullOrders()`: getShopReceipts (transactions_r Scope) → Mapping auf lokales Order-Schema
- Scopes: `listings_r listings_w listings_d shops_r transactions_r`
- Processing Profiles: `getShopReadinessStateDefinitions()` zum Laden der verfügbaren Profile in Settings

**Gate:** OAuth-Flow funktioniert (Token im Keychain), ein Listing kann auf Etsy als Draft gepusht werden

---

### Sub-Session C: eBay-Provider (OAuth + Listing Sync)

**Scope:**
- `EbayProvider` implementiert `PlatformSyncProvider`
- OAuth 2.0 Flow: Authorization Code Grant (RuName, kein PKCE)
- Token Exchange + Token Refresh (Base64-encoded Credentials)
- `pushListing()`: UploadSiteHostedPictures (Trading API, XML) → createOrReplaceInventoryItem → createOffer → publishOffer
- `updateListing()`: createOrReplaceInventoryItem (PUT, vollständiger Replace) → updateOffer
- `pauseListing()`: withdrawOffer
- `deleteListing()`: deleteOffer + deleteInventoryItem
- `pullOrders()`: Sell Fulfillment API getOrders → Mapping auf lokales Order-Schema
- `loadPolicies()`: Fulfillment, Payment, Return Policies laden für Settings-Dropdown
- Item Specifics Auto-Mapping + manuelle Ergänzung

**Gate:** OAuth-Flow funktioniert, ein Listing kann auf eBay als Inventory Item + Offer erstellt werden

---

### Sub-Session D: Sync-UI (Frontend)

**Scope:**
- Neue Route `/sync` mit Sync-Übersicht:
  - Tabelle aller Listings mit Sync-Status pro Plattform
  - Letzte Sync-Zeit pro Listing
  - Batch-Push-Button (alle geänderten Listings pushen)
  - Einzelner Push-Button pro Listing
  - Order-Pull-Button pro Plattform
- Diff-View vor Push (analog KI-DiffView aus Modul 06): Lokale Version vs. Plattform-Version
- Sync-Status-Badges in der Listing-Liste (Modul 05 Erweiterung)
- Sync-Log-Viewer (analog KI-Log): Tabelle mit letzten 50 Sync-Jobs
- Fehlermeldungen und Retry-Button bei sync_status=error
- Conflict-Resolution-UI: Bei sync_status=conflict zeigt ein Dialog die Unterschiede

**Gate:** Sync-UI rendert, Listings können per Button gepusht werden, Sync-Log zeigt Einträge

---

### Sub-Session E: Settings-Erweiterung + Integration + Cleanup

**Scope:**
- Settings-Tab "Plattformen" erweitern:
  - Etsy-Verbindung: OAuth-Button "Mit Etsy verbinden", Verbindungsstatus, Shop-Name anzeigen, "Verbindung trennen" Button
  - eBay-Verbindung: OAuth-Button "Mit eBay verbinden", Verbindungsstatus, "Verbindung trennen" Button
  - Default-Profile pro Plattform (Dropdowns, befüllt via API-Pull)
  - Etsy: Default Taxonomy-ID, who_made, when_made
  - eBay: Marketplace-ID, Inventory Location, Default-Kategorie
  - Sync-Intervall, Auto-Sync Toggle
- Sidebar Badge-Counter für Sync-Fehler (sync_status=error Anzahl)
- Command Palette Erweiterung: "Sync starten", "Zu Sync"
- Listing-Editor erweitern: "Push to Etsy" / "Push to eBay" Buttons (ersetzen die Stub-Buttons aus Modul 05)
- eBay-spezifischer Bereich im Listing-Editor: Item Specifics bearbeiten
- Auftragsimport: Importierte Aufträge in der Kanban-Ansicht (Modul 08) mit "extern importiert" Badge
- Gesamttest aller Flows
- Code-Cleanup, TypeScript-Check, Linter

**Gate:** Alle Flows funktionieren End-to-End, Settings speichern korrekt, keine TypeScript-Fehler, `npm run tauri dev` grün
