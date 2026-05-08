# Modul 07: Entscheidungen

PolyGrid Studio Business OS | Mai 2026

---

## E-01: Kein externes Syntax-Highlighting-Package

**Entscheidung:** Das `{{variablen}}`-Highlighting wird mit der Textarea+Overlay-Technik umgesetzt. Ein transparentes Textarea liegt über einem div mit identischem Styling. Der div rendert den Text mit `{{variablen}}` als `<mark>`-Elemente.

**Begründung:** CodeMirror oder Monaco wären massive Dependencies für einen simplen Use-Case. Die Overlay-Technik ist bewährt und braucht null neue Packages.

**Implementierung:**
```
<div style="position: relative">
  <div class="highlight-layer">  ← rendert HTML mit <mark> für {{vars}}
  <textarea class="input-layer"> ← transparent, liegt oben, nimmt Input
</div>
Beide Layer: identisches font, size, padding, line-height, white-space
```

---

## E-02: Zweispaltiges Layout statt Detail-Panel

**Entscheidung:** Kein Foundation Detail-Panel (400px rechts). Stattdessen eigenes zweispaltiges Layout: Liste links (350px fix), Editor rechts (flex). Der Editor hat genug Platz für Textarea + Variablen-Seitenleiste.

**Begründung:** Vorlagen brauchen viel vertikalen Platz für den Editor. Das Standard-Detail-Panel ist zu schmal.

---

## E-03: Variablen automatisch aus Content erkennen

**Entscheidung:** Variablen werden per Regex aus dem Content extrahiert: `/\{\{([^}]+)\}\}/g`. Die erkannten Variablen werden mit den manuell gespeicherten `variables` gemergt. Neue erkannte Variablen ohne Beschreibung werden mit leerem description-Feld angezeigt.

---

## E-04: DATABASE_SCHEMA braucht keine Änderung

Die `templates`-Tabelle in v1.2 ist vollständig. Keine Migration nötig.

---

## E-05: Ordnerstruktur

```
src/features/templates/
  index.ts
  TemplatesPage.tsx
  components/
    TemplateList.tsx          # Linke Spalte: Liste + Tabs + Suche
    TemplateListItem.tsx      # Einzelner Listeneintrag
    TemplateEditor.tsx        # Rechte Spalte: Editor-Hauptkomponente
    HighlightTextarea.tsx     # Textarea mit {{variablen}}-Highlighting
    VariablesSidebar.tsx      # Rechte Seitenleiste im Editor
    CopyDialog.tsx            # Kopieren mit Variablenersetzung
    NewTemplateModal.tsx      # Neue Vorlage erstellen
    LegalWarningBanner.tsx    # Warnbanner für Rechtstexte
  hooks/
    useTemplates.ts           # CRUD-Operationen
  services/
    templateService.ts        # DB-Operationen
    templateAssistantAgent.ts # KI-Agent
  utils/
    variableParser.ts         # Regex-Extraktion von {{variablen}}
```

---

## E-06: Sub-Session-Aufteilung

| Sub-Session | Inhalt | Gate |
|-------------|--------|------|
| A | DB-Service + Zod Schema + templateService (CRUD) | Build grün + Commit |
| B | TemplatesPage + TemplateList + Kategorie-Tabs + Suche + NewTemplateModal | Build grün + Commit |
| C | TemplateEditor + HighlightTextarea + VariablesSidebar | Build grün + Commit |
| D | CopyDialog + Versionierung + LegalWarningBanner + Command Palette | Build grün + Commit |
| E | KI-Integration (template_assistant Agent + DiffView + alle 4 Aktionen) | Build grün + Commit |
