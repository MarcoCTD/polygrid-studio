# Modul 06: KI-Architektur

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.1 | Mai 2026

> **Änderungen in v1.1 gegenüber v1.0 (Original-DOCX):**
>
> - Abhängigkeiten aktualisiert (Modul 08 ist jetzt abgeschlossen)
> - HTTP-Layer spezifiziert: Tauri Rust-Backend (nicht Frontend fetch)
> - Keychain-Lösung spezifiziert: eigenes Rust-Command mit `keyring` crate
> - Ollama als vollwertiger Provider (nicht nur Stub)
> - Product Analyst Agent explizit auf Modul 10 verschoben
> - Template Agent explizit auf Modul 07 verschoben
> - KI-Platzhalter-Inventar der bestehenden Module ergänzt
> - Kosten-Tracking mit konkreten Modellpreisen ergänzt
> - Minimale Settings-UI für Provider + Brand im Scope
> - System-Prompt-Strategie konkretisiert

---

## 1. Scope und Ziel

Dieses Modul implementiert die KI-Abstraktionsschicht mit Provider-Pattern, den Listing Assistant und den Expense Assistant. Es füllt die KI-Platzhalter in den bestehenden Modulen (02, 04, 05) mit echten Funktionen.

### 1.1 Lieferergebnisse

- AIProvider Trait (Rust) und Implementierungen (Claude, OpenAI, Ollama)
- Tauri-Commands für KI-Aufrufe (ai_generate_text, ai_generate_structured, ai_test_connection)
- API-Key-Verwaltung im OS-Keychain (eigene Rust-Commands mit `keyring` crate)
- Provider-Auswahl und Fallback-Logik
- Listing Assistant Agent (Titel, Beschreibung, Tags, Bullets, Plattform-Rewrite)
- Expense Assistant Agent (Kategorisierung, Duplikaterkennung, Zweckvorschlag)
- KI-Tab im Produkt-Detail-Panel (Modul 02) funktional
- KI-Toolbar im Listing-Editor (Modul 05) funktional
- KI-Klassifikation in Ausgaben-Schnellerfassung (Modul 04) funktional
- Diff-View für KI-Vorschläge (vorher/nachher mit Annehmen/Ablehnen/Bearbeiten)
- ai_jobs Logging (jeder KI-Aufruf wird protokolliert)
- Kosten-Tracking mit konfigurierbarem Monatslimit
- KI-Status-Anzeige (welcher Provider aktiv, Verfügbarkeit)
- Minimale Settings-UI für Provider-Konfiguration und Markenstil

### 1.2 Abhängigkeiten

- Foundation (Modul 01): DB für ai_jobs Tabelle, app_settings, Command Palette Registry
- Produktverwaltung (Modul 02): KI-Tab im Detail-Panel
- Ausgabenverwaltung (Modul 04): KI-Klassifikation
- Listing-Verwaltung (Modul 05): KI-Toolbar im Editor

### 1.3 Explizit NICHT im Scope

- Product Analyst Agent (kommt in Modul 10: Analysen/Dashboard)
- Template Agent / Umformulierung (kommt in Modul 07: Vorlagenbibliothek)
- KI-Log-Viewer Tabelle (kommt in Modul 11: Settings)
- Vollständige Settings-UI für KI (kommt in Modul 11)
- Auto-Modus ohne Bestätigung (Post-MVP)
- Echte Plattform-API-Calls (Modul 12)

---

## 2. Provider-Pattern

### 2.1 Rust-Seite: AIProvider Trait

```rust
pub trait AIProvider: Send + Sync {
    fn name(&self) -> &str;
    async fn is_available(&self) -> bool;
    async fn generate_text(&self, request: AIRequest) -> Result<AIResponse, AIError>;
    async fn generate_structured(&self, request: AIRequest) -> Result<AIResponse, AIError>;
    async fn test_connection(&self) -> Result<String, AIError>;
}

pub struct AIRequest {
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub json_mode: bool,        // Für structured output
    pub model: Option<String>,  // Override, sonst Default pro Provider
}

pub struct AIResponse {
    pub text: String,
    pub tokens_input: u32,
    pub tokens_output: u32,
    pub model: String,
    pub provider: String,
    pub duration_ms: u64,
}
```

### 2.2 Frontend-Seite: TypeScript Interfaces

```typescript
interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  language?: 'de' | 'en';
  model?: string;
}

interface AIResponse {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  provider: string;
  durationMs: number;
}

interface AIStatus {
  activeProvider: 'claude' | 'openai' | 'ollama' | null;
  availableProviders: string[];
  monthlySpent: number;
  monthlyLimit: number;
  isLimitReached: boolean;
}
```

### 2.3 Provider-Implementierungen

| Provider | Modelle (Default fett) | API | Einsatz |
|----------|----------------------|-----|---------|
| ClaudeProvider | **claude-sonnet-4-20250514**, claude-haiku-4-5-20251001 | Anthropic Messages API v1 | Listings, komplexe Texte |
| OpenAIProvider | **gpt-4o**, gpt-4o-mini | Chat Completions API | Fallback, Alternative |
| OllamaProvider | **llama3**, mistral, phi3 (dynamisch via /api/tags) | Ollama REST API (localhost) | Lokale Klassifikation, kostenlos |

### 2.4 Fallback-Logik

1. Prüfe ob bevorzugter Provider (aus app_settings `ai_preferred_provider`) verfügbar ist
2. Falls nicht: Fallback auf nächsten verfügbaren Cloud-Provider
3. Falls kein Cloud-Provider verfügbar: Versuche Ollama (lokal)
4. Falls gar kein Provider: KI-Buttons deaktivieren mit Tooltip "Kein KI-Provider verfügbar. Bitte in Einstellungen konfigurieren."

Verfügbarkeit = API-Key im Keychain vorhanden UND test_connection erfolgreich. Für Ollama: Endpoint erreichbar UND mindestens ein Modell installiert.

---

## 3. HTTP-Architektur

### 3.1 Alle API-Calls laufen im Rust-Backend

```
Frontend (React)                    Rust Backend (Tauri)
     │                                    │
     │  invoke("ai_generate_text",        │
     │    { provider, prompt, options })   │
     │ ──────────────────────────────────> │
     │                                    │── 1. Key aus Keychain lesen
     │                                    │── 2. HTTP Request via reqwest
     │                                    │── 3. Response parsen
     │                                    │── 4. ai_jobs Eintrag in DB schreiben
     │  <──────────────────────────────── │
     │  AIResponse { text, tokens, ... }  │
```

**Begründung:** API-Keys verlassen nie den Rust-Layer. Kein CORS-Problem mit Ollama localhost. Einheitlicher Code-Pfad für alle Provider.

### 3.2 Tauri-Commands

| Command | Parameter | Rückgabe | Beschreibung |
|---------|-----------|----------|-------------|
| `ai_generate_text` | provider, system_prompt, user_prompt, options | AIResponse | Text generieren |
| `ai_generate_structured` | provider, system_prompt, user_prompt, json_schema, options | AIResponse (JSON im text-Feld) | Strukturierte Ausgabe (Tags, Kategorien) |
| `ai_test_connection` | provider | String (Modellname) | Verbindung testen |
| `ai_list_ollama_models` | — | Vec<String> | Installierte Ollama-Modelle auflisten |
| `keychain_set` | service, key, value | () | API-Key speichern |
| `keychain_get` | service, key | Option<String> | API-Key lesen |
| `keychain_delete` | service, key | () | API-Key löschen |

---

## 4. Listing Assistant

### 4.1 Verfügbare Aktionen

| Aktion | Eingabe | Ausgabe | Structured? |
|--------|---------|---------|-------------|
| generateTitle(product, platform, language) | Produktdaten + Plattform | String (Titel) | Nein |
| generateDescription(product, platform, style, language) | Produktdaten + Stil | String (Kurz- oder Langbeschreibung) | Nein |
| generateTags(product, platform, language) | Produktdaten + Plattform | String[] (Tags) | Ja (JSON) |
| generateBulletPoints(product, language) | Produktdaten | String[] (Bullets) | Ja (JSON) |
| rewriteForPlatform(text, sourcePlatform, targetPlatform) | Bestehender Text | String (umgeschriebener Text) | Nein |

### 4.2 System-Prompt-Anforderungen (KRITISCH)

- Schreibstil: präzise, clean, sachlich-hochwertig
- KEINE Emojis, KEINE übertriebene Werbesprache
- KEINE typischen KI-Formulierungen (Entdecke, Erlebe, Perfekt für...)
- KEINE Gedankenstriche als Stilmittel
- Marke PolyGrid Studio: technisch, minimalistisch, vertrauenswürdig
- Plattform-Limits beachten: Etsy Titel max. 140 Zeichen, Tags max. 13; eBay Titel max. 80 Zeichen
- Bevorzugte Formulierungen: Konkrete Maße, Funktionsbeschreibung statt Emotion

### 4.3 System-Prompt-Aufbau

Jeder Listing-Assistant-Call baut den System-Prompt dynamisch zusammen:

```
1. Agent Base Prompt ("Du bist ein SEO-Experte für E-Commerce-Listings...")
2. Brand Injection (aus app_settings):
   - brand_writing_style
   - brand_preferred_words
   - brand_forbidden_phrases
   - brand_reference_text
3. Plattform-Kontext (Limits, Regeln pro Plattform)
4. Produkt-Kontext (Name, Material, Maße, Beschreibung, Preise)
5. Sprach-Kontext (DE/EN)
6. Task-spezifischer Prompt ("Erstelle 5 Titel-Vorschläge für Etsy...")
```

Brand-Settings werden aus app_settings gelesen. Falls keine gesetzt: Defaults (sachlich-minimalistisch, keine Emojis, keine Werbesprache).

---

## 5. Expense Assistant

| Aktion | Eingabe | Ausgabe | Structured? |
|--------|---------|---------|-------------|
| classifyExpense(vendor, amount, purpose) | Händler + Betrag + opt. Zweck | { category, subcategory, confidence } | Ja (JSON) |
| detectDuplicate(expense, existingExpenses) | Neue Ausgabe + letzte 50 Ausgaben | { isDuplicate, matchId?, reason } | Ja (JSON) |
| suggestPurpose(vendor, category) | Händler + Kategorie | String (Verwendungszweck) | Nein |

Die Klassifikation nutzt bevorzugt Ollama (kostenlos, lokal). Wenn kein Ollama verfügbar: Cloud-Provider als Fallback. Die Expense-Kategorien aus der Spec (Filament, Verpackung, Werkzeuge etc.) werden im Prompt als gültige Optionen mitgegeben.

---

## 6. Diff-View für KI-Vorschläge

JEDE KI-Aktion, die Daten verändert, muss im Diff-View angezeigt werden.

### 6.1 Layout

```
┌─────────────────────────────────────────────┐
│  KI-Vorschlag  ·  Agent: Listing Assistant  │
│  Provider: Claude (claude-sonnet-4)              │
├─────────────────────────────────────────────┤
│  Feld        │  Aktuell      │  Vorschlag   │
│──────────────│───────────────│──────────────│
│  Titel       │  "Alter Text" │  "Neuer Text"│
│  Tags        │  [tag1, tag2] │  [tag1, new] │
├─────────────────────────────────────────────┤
│  [Ablehnen]        [Bearbeiten]  [Annehmen] │
└─────────────────────────────────────────────┘
```

### 6.2 Verhalten

- **Annehmen:** Vorgeschlagene Werte werden in das Formular/die DB übernommen
- **Ablehnen:** Nichts passiert, Dialog schließt sich
- **Bearbeiten:** Vorgeschlagene Werte werden editierbar, dann kann der User manuell anpassen und übernehmen
- Der ai_jobs-Eintrag wird mit status `success` (Annehmen), `cancelled` (Ablehnen) aktualisiert

### 6.3 Implementierung

Shared Component unter `src/components/shared/DiffView.tsx`. Wird genutzt in:
- Listing-Editor (Modul 05 KI-Toolbar)
- Produkt-Detail KI-Tab (Modul 02)
- Ausgaben-Klassifikation (Modul 04)

---

## 7. KI-Logging

Jeder KI-Aufruf wird in der `ai_jobs`-Tabelle protokolliert:

| Feld | Beschreibung |
|------|-------------|
| provider | claude, openai, ollama |
| model | Konkretes Modell (z.B. claude-sonnet-4-20250514) |
| agent | listing_assistant, expense_assistant |
| action | generate_title, classify_expense, etc. |
| input | User-Prompt (gekürzt auf 500 Zeichen) |
| output | Response-Text (gekürzt auf 1000 Zeichen) |
| tokens_used | input + output Tokens |
| duration_ms | Gesamtdauer |
| status | success, error, cancelled |
| error_message | Fehlermeldung bei status=error |
| estimated_cost | Geschätzte Kosten in EUR |

Das Logging passiert im Rust-Backend direkt nach dem API-Call (vor der Rückgabe ans Frontend). Der KI-Log-Viewer wird in Modul 11 (Settings) implementiert.

---

## 8. Kosten-Tracking

### 8.1 Modellpreise (Lookup-Table, hardcoded)

| Provider | Modell | Input ($/1M Tokens) | Output ($/1M Tokens) |
|----------|--------|--------------------|--------------------|
| Claude | claude-sonnet-4-20250514 | 3.00 | 15.00 |
| Claude | claude-haiku-4-5-20251001 | 0.80 | 4.00 |
| OpenAI | gpt-4o | 2.50 | 10.00 |
| OpenAI | gpt-4o-mini | 0.15 | 0.60 |
| Ollama | * | 0.00 | 0.00 |

Wechselkurs: 0.92 EUR/USD (hardcoded, kann in Zukunft in Settings übersteuerbar sein).

### 8.2 Monatslimit

- Konfigurierbar in app_settings: `ai_monthly_limit_eur` (Default: 10 EUR)
- Bei jedem Call: Summe `estimated_cost` aus ai_jobs WHERE `created_at` im aktuellen Monat
- Bei 80% des Limits: Warnung im AI Status Badge
- Bei 100%: Call wird blockiert, Info-Dialog "KI-Budget für diesen Monat erreicht. Limit in Einstellungen anpassen oder nächsten Monat abwarten."
- Ollama-Calls zählen nicht gegen das Limit (Kosten = 0)

---

## 9. API-Key-Verwaltung

API-Keys werden im OS-Keychain gespeichert (macOS Keychain, Windows Credential Manager, Linux Secret Service).

### 9.1 Rust-Implementierung

Drei Tauri-Commands mit der `keyring` crate:
- `keychain_set(service: "polygrid-studio", key: "claude_api_key", value: "sk-ant-...")`
- `keychain_get(service: "polygrid-studio", key: "claude_api_key")` → `Option<String>`
- `keychain_delete(service: "polygrid-studio", key: "claude_api_key")`

Keys: `claude_api_key`, `openai_api_key`. Ollama braucht keinen Key.

### 9.2 Frontend-UI

Maskiertes Eingabefeld (Typ: password). Buttons: "Speichern", "Löschen", "Verbindung testen". Der Test-Button ruft `ai_test_connection` auf und zeigt Erfolg (Modellname) oder Fehler.

Keys werden NIEMALS in der SQLite-DB, in app_settings oder in Config-Dateien gespeichert.

---

## 10. Minimale Settings-UI

In der bestehenden Settings-Seite werden zwei neue Sektionen ergänzt (vollständiges Design in Modul 11):

### 10.1 KI-Provider

- Claude: API-Key (maskiert) + Set/Delete/Test
- OpenAI: API-Key (maskiert) + Set/Delete/Test
- Ollama: Endpoint-URL (Default: http://localhost:11434) + Test + Modell-Dropdown
- Bevorzugter Provider: Dropdown (Claude, OpenAI, Ollama)
- Monatslimit: Eingabefeld in EUR (Default: 10)
- Aktueller Monatsverbrauch: Anzeige (X von Y EUR)

### 10.2 Markenstil

- Schreibstil: Dropdown (sachlich-minimalistisch, technisch-präzise, freundlich-professionell)
- Brand-Wörter: Textarea (kommasepariert)
- No-Go-Formulierungen: Textarea (kommasepariert)
- Referenztext: Textarea

---

## 11. KI-Platzhalter in bestehenden Modulen

### 11.1 Modul 02: Produkt-Detail-Panel → KI-Tab

**Aktuell:** Platzhalter "KI-Assistent wird in Modul 06 implementiert"

**Wird ersetzt durch:**
- Button "Titel-Vorschläge generieren" → Listing Assistant generateTitle → DiffView
- Button "Beschreibung generieren" → Listing Assistant generateDescription → DiffView
- Button "Tags vorschlagen" → Listing Assistant generateTags → DiffView
- Plattform-Dropdown (Etsy/eBay/Kleinanzeigen) für plattformspezifische Generierung
- Sprach-Toggle (DE/EN)
- Optional: "Als neues Listing erstellen" Button nach Annahme eines Vorschlags

Die Aktionen nutzen den Listing Assistant mit dem Produktkontext (ohne konkretes Listing).

### 11.2 Modul 04: Ausgaben → KI-Klassifikation

**Aktuell:** Kein expliziter KI-Platzhalter, aber Expense Assistant in Spec vorgesehen

**Wird ergänzt:**
- In der Schnellerfassung: "KI-Vorschlag" Button neben Kategorie-Dropdown
- Bei Eingabe von Händler + Betrag → classifyExpense → schlägt Kategorie + Unterkategorie vor
- Im Detail-Panel: "Zweck vorschlagen" Button
- Duplikaterkennung: Automatisch bei Speichern, Warnung wenn ähnliche Ausgabe existiert
- Alle Vorschläge im DiffView (Annehmen setzt Kategorie, Ablehnen lässt sie leer)

### 11.3 Modul 05: Listing-Editor → KI-Toolbar

**Aktuell:** Platzhalter "KI-Funktionen werden in einem späteren Update verfügbar"

**Wird ersetzt durch:**
- Toolbar mit Buttons: Titel generieren, Beschreibung generieren, Tags generieren, Bullet Points generieren, Für andere Plattform umschreiben
- Jeder Button → entsprechende Listing-Assistant-Aktion → DiffView
- Plattform und Sprache werden aus dem aktuellen Listing gelesen
- Produktdaten werden über product_id geladen

---

## 12. Betriebsmodus

Im MVP startet die App immer im Modus "Vorschlag + Bestätigung" (`ai_mode = "suggest_confirm"` in app_settings). Jede KI-Aktion zeigt den Diff-View und wartet auf explizite Bestätigung durch den User. Automatische Übernahme ohne Bestätigung wird in Post-MVP implementiert.

---

## 13. Akzeptanzkriterien

- [ ] Mindestens ein Provider (Claude oder OpenAI) kann konfiguriert und getestet werden
- [ ] Ollama-Provider funktioniert wenn Ollama lokal läuft, Modelle werden aufgelistet
- [ ] API-Keys werden im OS-Keychain gespeichert, NICHT in der DB
- [ ] Verbindungstest für alle drei Provider funktioniert
- [ ] Listing Assistant generiert Titel, Beschreibungen, Tags und Bullet Points
- [ ] Generierte Texte erscheinen im Diff-View mit Annehmen/Ablehnen/Bearbeiten
- [ ] Expense Assistant schlägt Kategorien vor
- [ ] Duplikaterkennung warnt bei ähnlichen Ausgaben
- [ ] KI-Buttons werden deaktiviert wenn kein Provider verfügbar (mit Tooltip)
- [ ] Jeder KI-Aufruf wird in ai_jobs geloggt (Provider, Modell, Tokens, Kosten, Status)
- [ ] Generierte Texte enthalten keine verbotenen Formulierungen (Brand No-Go-Phrasen)
- [ ] Fallback-Logik funktioniert: bevorzugt → nächster Cloud → Ollama → deaktiviert
- [ ] Monatslimit wird angezeigt, bei 80% Warnung, bei 100% Blockierung
- [ ] Brand-Settings (Schreibstil, Wörter, No-Go) werden in System-Prompts injiziert
- [ ] Minimale Settings-UI für Provider und Brand funktioniert
- [ ] KI-Tab im Produkt-Detail-Panel (Modul 02) ist funktional
- [ ] KI-Toolbar im Listing-Editor (Modul 05) ist funktional
- [ ] KI-Klassifikation in Ausgaben (Modul 04) ist funktional
- [ ] Command Palette enthält "KI fragen"
- [ ] TypeScript kompiliert ohne Fehler im strict mode
- [ ] ESLint und Prettier laufen ohne Fehler
- [ ] `npm run tauri dev` startet ohne Fehler auf macOS
