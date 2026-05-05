# Modul 06: KI-Architektur — Entscheidungsdokument

PolyGrid Studio Business OS
Version 1.0 | Mai 2026

---

## 1. Spec-Review-Ergebnis

### 1.1 Was unverändert übernommen wird

- Provider-Pattern mit `AIProvider` Interface
- `ai_jobs`-Tabelle (Schema liegt bereits in DB, Modul 01)
- Diff-View für alle KI-Vorschläge (vorher/nachher mit Annehmen/Ablehnen/Bearbeiten)
- Listing Assistant mit 5 Aktionen (generateTitle, generateDescription, generateTags, generateBulletPoints, rewriteForPlatform)
- Expense Assistant mit 3 Aktionen (classifyExpense, detectDuplicate, suggestPurpose)
- KI-Logging in ai_jobs (jeder Call wird protokolliert)
- Betriebsmodus MVP: immer "Vorschlag + Bestätigung"
- Brand-Settings aus app_settings in System-Prompts injizieren

### 1.2 Was angepasst wird

| Thema | Original-Spec | Entscheidung | Begründung |
|-------|--------------|-------------|------------|
| HTTP-Layer | Nicht spezifiziert | Tauri HTTP Plugin (Rust) | API-Keys bleiben im Rust-Layer, kein CORS |
| Keychain | "OS-Keychain via Tauri" | Eigenes Rust-Command mit `keyring` crate | Kein Community-Plugin nötig, volle Kontrolle |
| Ollama | Vollständig | Vollständig (alle 3 Provider) | Vom User gewünscht |
| Product Analyst | In Spec erwähnt | Nicht in Modul 06, kommt in Modul 10 | Gehört zum Dashboard, braucht alle Module |
| Template Agent | In Modul 07 Spec | Nur Interface vorbereiten, Stub | Modul 07 noch nicht gebaut |
| Modellpreise | Nicht spezifiziert | Hardcoded Lookup-Table mit Settings-Override | Pragmatisch, updatebar |
| Brand-Settings UI | Keine (erst Modul 11) | Minimale UI in Settings-Platzhalter | Sonst sind Brand-Settings nicht konfigurierbar |

### 1.3 KI-Platzhalter in bestehenden Modulen (Inventar)

Diese Platzhalter müssen von Modul 06 mit echten Funktionen ersetzt werden:

| Modul | Ort | Platzhalter | Aktion |
|-------|-----|-------------|--------|
| 02 Produkte | Detail-Panel → KI-Tab | "KI-Assistent wird in Modul 06 implementiert" | Titel generieren, Beschreibung erstellen, Tags vorschlagen (über Listing Assistant, da produktbasiert) |
| 04 Ausgaben | Schnellerfassung / Detail-Panel | KI-Klassifikation Stub | Kategorie+Unterkategorie vorschlagen (Expense Assistant) |
| 05 Listings | 7-Tab-Editor → KI-Toolbar | "KI-Funktionen werden in einem späteren Update verfügbar" | Titel, Beschreibung, Tags, Bullets generieren; Plattform-Rewrite (Listing Assistant) |
| 08 Aufträge | Keine KI-Platzhalter | — | Kein KI-Bedarf im MVP |

**Hinweis Modul 02 KI-Tab:** Die Spec sagt "Titel generieren, Beschreibung erstellen, Tags vorschlagen". Das sind Listing-Aktionen, die hier aber produktbasiert aufgerufen werden (ohne konkretes Listing). Lösung: Der KI-Tab im Produkt-Detail-Panel nutzt den Listing Assistant mit dem Produktkontext, generiert aber "freistehende" Vorschläge, die der User dann in ein Listing übernehmen kann. Alternativ: Quick-Create Listing aus dem KI-Vorschlag.

---

## 2. Architektur-Entscheidungen

### 2.1 HTTP-Requests via Tauri HTTP Plugin

```
Frontend (React)                    Rust Backend (Tauri)
     │                                    │
     │  invoke("ai_generate_text",        │
     │    { provider, prompt, options })   │
     │ ──────────────────────────────────> │
     │                                    │── 1. Key aus Keychain lesen
     │                                    │── 2. HTTP Request via reqwest/plugin-http
     │                                    │── 3. Response parsen
     │                                    │── 4. ai_jobs Eintrag schreiben
     │  <──────────────────────────────── │
     │  AIResponse { text, tokens, ... }  │
```

**Warum nicht Frontend fetch():**
- API-Keys müssten per IPC ans Frontend → Sicherheitsrisiko
- Ollama localhost hat CORS-Restrictions im Tauri WebView
- Einheitlicher Code-Pfad für alle Provider

**Konsequenz:** Alle 3 Provider werden als Rust-Commands implementiert. Das Frontend ruft nur `invoke()` auf und bekommt strukturierte Responses zurück.

### 2.2 Keychain via eigenes Rust-Command

Drei Tauri-Commands:

```rust
#[tauri::command]
fn keychain_set(service: &str, key: &str, value: &str) -> Result<(), String>

#[tauri::command]
fn keychain_get(service: &str, key: &str) -> Result<Option<String>, String>

#[tauri::command]
fn keychain_delete(service: &str, key: &str) -> Result<(), String>
```

Service-Name: `"polygrid-studio"`. Keys: `"claude_api_key"`, `"openai_api_key"`.
Crate: `keyring` (Rust, stabil, nutzt OS-native Stores).

### 2.3 Provider-Architektur (Rust-Seite)

```
src-tauri/src/
  ai/
    mod.rs              // AI-Modul Einstiegspunkt
    provider.rs         // AIProvider Trait + AIResponse struct
    claude.rs           // ClaudeProvider (Anthropic Messages API)
    openai.rs           // OpenAIProvider (Chat Completions API)
    ollama.rs           // OllamaProvider (Ollama REST API)
    keychain.rs         // Keychain-Commands
    commands.rs         // Tauri-Commands (ai_generate_text, ai_test_connection, etc.)
    prompts.rs          // System-Prompt-Templates
    cost.rs             // Kosten-Lookup und Berechnung
```

### 2.4 Provider-Architektur (Frontend-Seite)

```
src/features/ai-assistant/
  services/
    aiService.ts        // Frontend-Wrapper um invoke() Calls
    promptBuilder.ts    // System-Prompts zusammenbauen (Brand-Settings etc.)
    costTracker.ts      // Monatskosten aus ai_jobs summieren
  agents/
    listingAssistant.ts // Listing-spezifische Aktionen
    expenseAssistant.ts // Ausgaben-spezifische Aktionen
  components/
    DiffView.tsx        // Vorher/Nachher mit Accept/Reject/Edit
    AIStatusBadge.tsx   // Provider-Status Anzeige
    AIToolbar.tsx       // Wiederverwendbare KI-Toolbar für Listings etc.
    ProviderSettings.tsx // Minimale Provider-Config UI
    BrandSettings.tsx   // Minimale Brand-Config UI
  hooks/
    useAI.ts            // Hook für KI-Aufrufe mit Loading/Error State
    useAIStatus.ts      // Prüft welcher Provider verfügbar ist
  stores/
    aiStore.ts          // Zustand: aktiver Provider, Status, Loading
  types/
    index.ts            // AIProvider, AIResponse, AIOptions etc.
```

### 2.5 Diff-View Komponente

Wird als shared Component gebaut (`src/components/shared/DiffView.tsx`), da sie in mehreren Modulen genutzt wird (Produkte KI-Tab, Listings KI-Toolbar, Ausgaben Klassifikation).

Layout:
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

### 2.6 Kosten-Tracking

Hardcoded Lookup-Table (updatebar in Zukunft über Settings):

| Provider | Modell | Input $/1M Tokens | Output $/1M Tokens |
|----------|--------|-------------------|-------------------|
| Claude | claude-sonnet-4-20250514 | 3.00 | 15.00 |
| Claude | claude-haiku-4-5-20251001 | 0.80 | 4.00 |
| OpenAI | gpt-4o | 2.50 | 10.00 |
| OpenAI | gpt-4o-mini | 0.15 | 0.60 |
| Ollama | * | 0.00 | 0.00 |

Kosten werden in EUR umgerechnet (Wechselkurs hardcoded, Default 0.92 EUR/USD).
Monatslimit wird bei jedem Call geprüft: Summe `estimated_cost` aus ai_jobs WHERE created_at im aktuellen Monat.

### 2.7 Ollama-Integration

Ollama läuft lokal und hat eine einfache REST API:
- Endpoint: `http://localhost:11434/api/generate` (Text) bzw. `/api/chat` (Chat)
- Kein API-Key nötig
- Verfügbarkeit prüfen: `GET /api/tags` (listet installierte Modelle)
- JSON Mode: `"format": "json"` im Request

Ollama wird als vollwertiger Provider implementiert. Bei `generateStructured<T>` wird der JSON-Output manuell gegen das Zod-Schema validiert (kein natives Structured Output wie bei Claude/OpenAI).

### 2.8 System-Prompt-Strategie

Jeder Agent hat einen Base-Prompt. Darauf werden dynamisch gestapelt:

```
1. Agent Base Prompt (z.B. "Du bist ein SEO-Experte für Etsy...")
2. Brand Injection (Schreibstil, Brand-Wörter, No-Go-Phrasen, Referenztext)
3. Plattform-Kontext (Limits, Regeln pro Plattform)
4. Produkt-Kontext (Name, Material, Beschreibung, Preise)
5. Sprach-Kontext (DE/EN)
6. Task-spezifischer Prompt (z.B. "Erstelle 5 Titel-Vorschläge")
```

Die Brand-Settings werden aus `app_settings` gelesen. Falls keine gesetzt: sinnvolle Defaults (sachlich-minimalistisch, keine Emojis, keine Werbesprache).

### 2.9 Minimale Settings-UI für Modul 06

In der bestehenden Settings-Platzhalterseite (oder als erweiterte Sektion) werden zwei Bereiche ergänzt:

**KI-Provider:**
- Claude API-Key (maskiert, Set/Delete/Test)
- OpenAI API-Key (maskiert, Set/Delete/Test)
- Ollama Endpoint (Default localhost:11434, Test-Button)
- Bevorzugter Provider (Dropdown)
- Monatslimit EUR (Input, Default 10)

**Markenstil:**
- Schreibstil (Dropdown: sachlich-minimalistisch, technisch-präzise, freundlich-professionell)
- Brand-Wörter (Textarea, kommasepariert)
- No-Go-Phrasen (Textarea, kommasepariert)
- Referenztext (Textarea)

Diese UI wird in Modul 11 polished, hier nur funktional.

---

## 3. Scope-Abgrenzung

### Im Scope Modul 06

- [x] Rust: AI Provider Trait + Claude/OpenAI/Ollama Implementierung
- [x] Rust: Keychain-Commands (set/get/delete)
- [x] Rust: Tauri-Commands für AI (generate_text, generate_structured, test_connection)
- [x] Frontend: AI Service Layer (invoke-Wrapper)
- [x] Frontend: Listing Assistant Agent (5 Aktionen)
- [x] Frontend: Expense Assistant Agent (3 Aktionen)
- [x] Frontend: DiffView-Komponente (shared)
- [x] Frontend: KI-Tab in Produkt-Detail-Panel ausfüllen
- [x] Frontend: KI-Toolbar in Listing-Editor ausfüllen
- [x] Frontend: KI-Klassifikation in Ausgaben ausfüllen
- [x] Frontend: AI Status Badge (aktiver Provider, Verfügbarkeit)
- [x] Frontend: AI Store (Zustand)
- [x] Frontend: Minimale Settings-UI (Provider + Brand)
- [x] ai_jobs Logging (jeder Call)
- [x] Kosten-Tracking mit Monatslimit
- [x] Fallback-Logik (bevorzugt → nächster → Ollama → deaktiviert)
- [x] Command Palette erweitern: "KI fragen"

### Nicht im Scope Modul 06

- Product Analyst Agent (Modul 10)
- Template Agent / Umformulierung (Modul 07)
- KI-Log-Viewer (Modul 11 Settings)
- Vollständige Settings-UI (Modul 11)
- Auto-Modus ohne Bestätigung (Post-MVP)

---

## 4. Sub-Session-Aufteilung

### Sub-Session A: Rust Backend — Keychain + AI Provider Infrastruktur

**Ziel:** Rust-Seite komplett: Keychain-Commands, AI Provider Trait, alle 3 Provider-Implementierungen, Tauri-Commands. Noch keine Frontend-Anbindung.

**Pflichtlektüre für Codex:**
1. `AGENTS.md` (Repo-Root)
2. `docs/specs/MODUL_06_ENTSCHEIDUNGEN.md` (dieses Dokument, Abschnitt 2.1–2.7)
3. `docs/specs/MODUL_06_KI_ARCHITEKTUR.md` (Original-Spec, Abschnitt 2 Provider-Pattern)
4. `docs/specs/DATABASE_SCHEMA.md` (ai_jobs Tabelle)
5. `src-tauri/src/main.rs` (bestehende Command-Registrierung)
6. `src-tauri/Cargo.toml` (bestehende Dependencies)

**Zu erstellende / ändernde Dateien:**
```
src-tauri/Cargo.toml                    # Neue deps: keyring, reqwest (falls nicht via plugin-http), serde_json
src-tauri/src/ai/mod.rs                 # AI-Modul
src-tauri/src/ai/provider.rs            # AIProvider Trait, AIRequest, AIResponse structs
src-tauri/src/ai/claude.rs              # ClaudeProvider
src-tauri/src/ai/openai.rs              # OpenAIProvider
src-tauri/src/ai/ollama.rs              # OllamaProvider
src-tauri/src/ai/keychain.rs            # Keychain get/set/delete Commands
src-tauri/src/ai/commands.rs            # Tauri Commands: ai_generate_text, ai_generate_structured, ai_test_connection, ai_list_ollama_models
src-tauri/src/ai/cost.rs                # Kosten-Lookup-Table, Berechnung
src-tauri/src/main.rs                   # Commands registrieren
```

**Akzeptanzkriterien Sub-Session A:**
- `cargo build` kompiliert ohne Fehler
- `npm run tauri dev` startet
- Keychain: `keychain_set("polygrid-studio", "test", "value")` + `keychain_get` funktioniert (manuell via DevTools invoke testen)
- AI Commands sind registriert (invoke aufrufbar, gibt strukturierte Fehler zurück wenn kein Key gesetzt)
- Ollama: `ai_test_connection` erkennt ob Ollama lokal läuft
- Git Commit: `feat(mod-06): rust AI provider infrastructure + keychain`

---

### Sub-Session B: Frontend AI Service Layer + Store + Types

**Ziel:** TypeScript-Infrastruktur: Types, AI Service (invoke-Wrapper), AI Store (Zustand), Prompt Builder, Cost Tracker. Noch keine UI-Komponenten.

**Pflichtlektüre für Codex:**
1. `AGENTS.md`
2. `docs/specs/MODUL_06_ENTSCHEIDUNGEN.md` (Abschnitt 2.4, 2.6, 2.8)
3. `docs/specs/MODUL_06_KI_ARCHITEKTUR.md` (Abschnitt 2 Interface, 3 Listing Assistant, 4 Expense Assistant)
4. `src/features/ai-assistant/` (bestehende Platzhalter-Seite)
5. `src/stores/` (bestehende Store-Patterns)
6. `src/services/database/` (DB-Service Pattern für ai_jobs Queries)

**Zu erstellende / ändernde Dateien:**
```
src/features/ai-assistant/types/index.ts          # AIProvider, AIResponse, AIOptions, Agent-Types
src/features/ai-assistant/services/aiService.ts    # invoke() Wrapper für alle Rust AI Commands
src/features/ai-assistant/services/promptBuilder.ts # System-Prompt Zusammenbau mit Brand-Settings
src/features/ai-assistant/services/costTracker.ts   # Monatskosten aus ai_jobs, Limit-Check
src/features/ai-assistant/agents/listingAssistant.ts # 5 Aktionen mit Prompt-Templates
src/features/ai-assistant/agents/expenseAssistant.ts # 3 Aktionen mit Prompt-Templates
src/features/ai-assistant/stores/aiStore.ts         # Zustand: Provider-Status, Loading, Errors
src/features/ai-assistant/hooks/useAI.ts            # Hook: KI-Call mit Loading/Error/Result
src/features/ai-assistant/hooks/useAIStatus.ts      # Hook: Provider-Verfügbarkeit prüfen
```

**Akzeptanzkriterien Sub-Session B:**
- Alle TypeScript-Files kompilieren ohne Fehler (strict mode)
- `npm run tauri dev` startet
- AI Store ist funktional (Provider-Status lesbar)
- aiService.ts kann invoke() aufrufen (Error wenn kein Key, das ist OK)
- Prompt Builder liest Brand-Settings aus app_settings (mit Defaults)
- Cost Tracker summiert ai_jobs korrekt (leere Tabelle = 0)
- Git Commit: `feat(mod-06): frontend AI service layer, agents, stores`

---

### Sub-Session C: DiffView + KI-Settings-UI

**Ziel:** Shared DiffView-Komponente und minimale KI-Settings (Provider-Config + Brand-Settings). Damit können erstmals API-Keys gesetzt und Provider getestet werden.

**Pflichtlektüre für Codex:**
1. `AGENTS.md`
2. `docs/specs/MODUL_06_ENTSCHEIDUNGEN.md` (Abschnitt 2.5 DiffView, 2.9 Settings-UI)
3. `src/features/settings/` (bestehende Settings-Seite mit Theme-Toggle)
4. `src/components/shared/` (bestehende Shared-Patterns)
5. `src/components/ui/` (verfügbare shadcn Komponenten)

**Zu erstellende / ändernde Dateien:**
```
src/components/shared/DiffView.tsx                        # Shared: Vorher/Nachher/Accept/Reject/Edit
src/features/ai-assistant/components/AIStatusBadge.tsx     # Provider-Status Indikator
src/features/ai-assistant/components/ProviderSettings.tsx  # API-Key Eingabe, Test-Button, Ollama-Config
src/features/ai-assistant/components/BrandSettings.tsx     # Schreibstil, Brand-Wörter, No-Go
src/features/settings/                                     # Settings-Seite erweitern um KI-Tab/Sektion
```

**Akzeptanzkriterien Sub-Session C:**
- DiffView rendert korrekt mit Mock-Daten
- In Settings: API-Key für Claude/OpenAI setzen → wird im Keychain gespeichert
- In Settings: "Verbindung testen" Button → zeigt Erfolg/Fehler
- In Settings: Ollama Endpoint konfigurieren + testen
- In Settings: Brand-Einstellungen speichern → landen in app_settings
- AIStatusBadge zeigt aktiven Provider oder "Kein Provider"
- `npm run tauri dev` startet und alles rendert
- Git Commit: `feat(mod-06): DiffView component + AI settings UI`

---

### Sub-Session D: Listing Assistant Integration (Modul 05 KI-Toolbar)

**Ziel:** KI-Toolbar im Listing-Editor mit echten Funktionen ausfüllen. Alle 5 Listing-Assistant-Aktionen funktional mit DiffView.

**Pflichtlektüre für Codex:**
1. `AGENTS.md`
2. `docs/specs/MODUL_06_ENTSCHEIDUNGEN.md` (Abschnitt 2.8 System-Prompts)
3. `docs/specs/MODUL_06_KI_ARCHITEKTUR.md` (Abschnitt 3 Listing Assistant, 5 Diff-View)
4. `docs/specs/MODUL_05_LISTING_VERWALTUNG.md` (Editor-Spec, KI-Toolbar-Platzhalter)
5. `src/features/listings/` (bestehender Listing-Editor Code)
6. `src/features/ai-assistant/agents/listingAssistant.ts` (aus Sub-Session B)
7. `src/components/shared/DiffView.tsx` (aus Sub-Session C)

**Zu erstellende / ändernde Dateien:**
```
src/features/ai-assistant/components/AIToolbar.tsx     # Wiederverwendbare KI-Aktions-Leiste
src/features/listings/components/[Editor-Datei]        # KI-Toolbar Platzhalter → echte AIToolbar
src/features/ai-assistant/agents/listingAssistant.ts   # Prompt-Templates finalisieren
```

**Akzeptanzkriterien Sub-Session D:**
- Im Listing-Editor: "Titel generieren" → Claude/OpenAI Call → DiffView → Annehmen überschreibt Titel
- "Beschreibung generieren" funktioniert (kurz + lang)
- "Tags generieren" funktioniert (mit Plattform-Limit z.B. max 13 für Etsy)
- "Bullet Points generieren" funktioniert
- "Für andere Plattform umschreiben" funktioniert
- Jeder Call wird in ai_jobs geloggt
- Bei keinem Provider: Buttons deaktiviert mit Tooltip
- Brand-Settings werden in Prompts berücksichtigt
- Git Commit: `feat(mod-06): listing assistant integration in editor`

---

### Sub-Session E: Expense Assistant (Modul 04) + Produkt KI-Tab (Modul 02)

**Ziel:** KI-Klassifikation in Ausgaben ausfüllen. KI-Tab im Produkt-Detail-Panel ausfüllen. Command Palette erweitern.

**Pflichtlektüre für Codex:**
1. `AGENTS.md`
2. `docs/specs/MODUL_06_ENTSCHEIDUNGEN.md`
3. `docs/specs/MODUL_06_KI_ARCHITEKTUR.md` (Abschnitt 4 Expense Assistant)
4. `docs/specs/MODUL_04_AUSGABENVERWALTUNG.md` (KI-Stubs)
5. `docs/specs/MODUL_02_PRODUKTVERWALTUNG.md` (KI-Tab Platzhalter)
6. `src/features/expenses/` (bestehender Ausgaben-Code)
7. `src/features/products/` (bestehender Produkt-Code, Detail-Panel Tabs)
8. `src/features/ai-assistant/agents/expenseAssistant.ts` (aus Sub-Session B)

**Zu erstellende / ändernde Dateien:**
```
src/features/expenses/components/[Schnellerfassung]   # KI-Suggest Button für Kategorie
src/features/expenses/components/[Detail-Panel]        # KI-Klassifikation integrieren
src/features/products/components/[KI-Tab]              # Platzhalter → echte KI-Aktionen
src/features/ai-assistant/agents/expenseAssistant.ts   # Prompt-Templates finalisieren
src/components/layout/CommandPalette.tsx                # "KI fragen" Command hinzufügen
```

**Akzeptanzkriterien Sub-Session E:**
- Ausgaben: Bei Eingabe von Händler+Betrag → "KI-Vorschlag" Button → schlägt Kategorie+Unterkategorie vor
- Ausgaben: Duplikaterkennung zeigt Warnung wenn ähnliche Ausgabe existiert
- Produkte: KI-Tab zeigt Buttons für Titel/Beschreibung/Tags → generiert Vorschläge im DiffView
- Produkte: Vorschläge können in ein neues Listing übernommen werden (Button "Als Listing erstellen")
- Command Palette: "KI fragen" ist registriert (öffnet AI-Seite oder fokussiert KI-Panel)
- Alle Calls werden in ai_jobs geloggt
- `npm run tauri dev` startet, alles funktioniert
- Git Commit: `feat(mod-06): expense assistant + product AI tab + command palette`

---

### Sub-Session F: Polish, Fallback-Logik, Kosten-Limit, Abschluss

**Ziel:** Fallback-Logik testen, Monatslimit durchsetzen, Edge Cases abfangen, alles aufräumen.

**Pflichtlektüre für Codex:**
1. `AGENTS.md`
2. `docs/specs/MODUL_06_ENTSCHEIDUNGEN.md` (Abschnitt 2.6 Kosten, 2.7 Ollama Fallback)
3. `docs/specs/MODUL_06_KI_ARCHITEKTUR.md` (Abschnitt 8 Betriebsmodus, 9 Akzeptanzkriterien)
4. Alle Dateien aus Sub-Sessions A–E

**Aufgaben:**
```
1. Fallback-Logik verifizieren:
   - Bevorzugter Provider offline → nächster wird versucht
   - Kein Cloud-Provider → Ollama wird versucht
   - Gar nichts → alle KI-Buttons deaktiviert + Tooltip

2. Monatslimit durchsetzen:
   - Bei jedem Call: Summe estimated_cost aus ai_jobs für aktuellen Monat prüfen
   - Bei 80%: Warnung anzeigen ("Du hast X von Y EUR KI-Budget verbraucht")
   - Bei 100%: Call blockieren, Info-Dialog

3. Edge Cases:
   - Leere Responses von Provider → sinnvolle Fehlermeldung
   - Timeout (Provider antwortet nicht in 30s) → Abbruch + Fehler in ai_jobs
   - Ollama nicht installiert → klare Meldung
   - API-Key ungültig → bei Test-Button UND bei erstem echten Call melden

4. ESLint + TypeScript Check:
   - Keine any-Types (außer begründet)
   - Alle try/catch vorhanden
   - Keine unused imports

5. Code-Cleanup:
   - Alte Platzhalter-Texte entfernen
   - Konsistente Fehlermeldungen (deutsch)
   - Loading States überall korrekt
```

**Akzeptanzkriterien Sub-Session F (= Modul 06 Akzeptanzkriterien):**
- Mindestens ein Provider (Claude oder OpenAI) kann konfiguriert und getestet werden
- API-Key wird im OS-Keychain gespeichert, NICHT in der DB
- Listing Assistant generiert Titel, Beschreibungen und Tags
- Generierte Texte erscheinen im DiffView mit Annehmen/Ablehnen/Bearbeiten
- Expense Assistant schlägt Kategorien vor
- KI-Buttons werden deaktiviert wenn kein Provider verfügbar
- Jeder KI-Aufruf wird in ai_jobs geloggt
- Generierte Texte enthalten keine verbotenen Formulierungen (Brand No-Go-Phrasen)
- Fallback-Logik funktioniert wenn bevorzugter Provider offline
- Monatslimit wird angezeigt und bei Überschreitung blockiert
- Ollama-Provider funktioniert wenn Ollama lokal läuft
- Ollama-Modelle werden aufgelistet
- `npm run tauri dev` startet ohne Fehler
- TypeScript kompiliert im strict mode
- ESLint + Prettier ohne Fehler
- Git Commit: `feat(mod-06): polish, fallback logic, cost limit`
- Tag: `module-06-complete`

---

## 5. Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|-----------|
| Tauri HTTP Plugin funktioniert nicht wie erwartet | Mittel | Fallback: `reqwest` crate direkt im Rust-Backend |
| `keyring` crate funktioniert nicht auf macOS | Niedrig | macOS hat guten Keychain-Support, crate ist stabil |
| Ollama-API ändert sich | Niedrig | API ist stabil seit >1 Jahr |
| Claude/OpenAI API-Änderungen | Niedrig | Wir nutzen Standard-Endpoints |
| Kosten-Tracking ungenau | Mittel | Ist nur Schätzung, reicht für Budget-Warnung |
| DiffView wird zu komplex | Mittel | Im MVP simpel halten: Feld-für-Feld Vergleich, kein Inline-Diff |

---

## 6. Offene Punkte für spätere Module

- **Modul 07 (Vorlagen):** Template Agent mit Aktionen: kürzen, verlängern, umformulieren, Plattform anpassen. Nutzt AI Service aus Modul 06.
- **Modul 10 (Dashboard):** Product Analyst Agent für Klartextanalysen. Nutzt AI Service + Daten aus allen Modulen.
- **Modul 11 (Settings):** Vollständige KI-Settings-UI (KI-Log-Viewer, erweiterte Provider-Config, Modellauswahl pro Provider).
