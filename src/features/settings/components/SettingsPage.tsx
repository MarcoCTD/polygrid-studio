import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/ui.store";
import de from "@/i18n/de.json";

type Theme = "light" | "dark" | "system";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[--foreground]">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-[--muted-foreground]">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8 rounded-lg border border-[--border] bg-[--card] px-4 py-3">
      <div className="min-w-0">
        <span className="text-sm font-medium text-[--foreground]">{label}</span>
        {description && (
          <p className="mt-0.5 text-xs text-[--muted-foreground]">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useUIStore();

  // Default calculation values (would be persisted in a real settings store)
  const [calcDefaults, setCalcDefaults] = useState({
    filament_price_per_kg: "20",
    printer_wattage: "200",
    electricity_price_per_kwh: "0.30",
    platform_fee_percent: "6.5",
  });

  // AI provider settings (placeholder for now)
  const [aiProvider, setAiProvider] = useState<string>("none");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[--border] px-6 py-4">
        <h1 className="text-base font-semibold text-[--foreground]">{de.settings.title}</h1>
        <p className="text-xs text-[--muted-foreground]">{de.settings.subtitle}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl space-y-8 p-6">
          {/* Appearance */}
          <Section title="Darstellung" description="Erscheinungsbild der Anwendung">
            <SettingRow
              label="Theme"
              description="Hell, Dunkel oder automatisch nach Systemeinstellung"
            >
              <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{de.theme.light}</SelectItem>
                  <SelectItem value="dark">{de.theme.dark}</SelectItem>
                  <SelectItem value="system">{de.theme.system}</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </Section>

          {/* Calculation Defaults */}
          <Section
            title="Kalkulationseinstellungen"
            description="Standardwerte für die Margenberechnung"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Filamentpreis (€/kg)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={calcDefaults.filament_price_per_kg}
                  onChange={(e) =>
                    setCalcDefaults((s) => ({ ...s, filament_price_per_kg: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Druckerleistung (Watt)</Label>
                <Input
                  type="number"
                  step="10"
                  value={calcDefaults.printer_wattage}
                  onChange={(e) =>
                    setCalcDefaults((s) => ({ ...s, printer_wattage: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Strompreis (€/kWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={calcDefaults.electricity_price_per_kwh}
                  onChange={(e) =>
                    setCalcDefaults((s) => ({ ...s, electricity_price_per_kwh: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plattformgebühr (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={calcDefaults.platform_fee_percent}
                  onChange={(e) =>
                    setCalcDefaults((s) => ({ ...s, platform_fee_percent: e.target.value }))
                  }
                />
              </div>
            </div>
          </Section>

          {/* AI Provider */}
          <Section
            title="KI-Integration"
            description="Konfiguriere den KI-Anbieter für Textgenerierung"
          >
            <SettingRow
              label="KI-Anbieter"
              description="API-Keys werden sicher im System-Keychain gespeichert"
            >
              <Select value={aiProvider} onValueChange={setAiProvider}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keiner</SelectItem>
                  <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="ollama">Ollama (Lokal)</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {aiProvider !== "none" && (
              <div className="rounded-lg border border-[--border] bg-[--card] p-4 space-y-3">
                {aiProvider === "ollama" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ollama Server-URL</Label>
                    <Input
                      placeholder="http://localhost:11434"
                      defaultValue="http://localhost:11434"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      API-Key ({aiProvider === "claude" ? "Anthropic" : "OpenAI"})
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={aiProvider === "claude" ? "sk-ant-..." : "sk-..."}
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm">
                        Speichern
                      </Button>
                    </div>
                    <p className="text-[10px] text-[--muted-foreground]">
                      Der Key wird im OS-Keychain gespeichert, nicht im Klartext.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Modell</Label>
                  <Select defaultValue="default">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiProvider === "claude" && (
                        <>
                          <SelectItem value="default">Claude Sonnet (Standard)</SelectItem>
                          <SelectItem value="claude-3-5-haiku-latest">Claude Haiku (Schnell)</SelectItem>
                          <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                        </>
                      )}
                      {aiProvider === "openai" && (
                        <>
                          <SelectItem value="default">GPT-4o (Standard)</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini (Schnell)</SelectItem>
                        </>
                      )}
                      {aiProvider === "ollama" && (
                        <>
                          <SelectItem value="default">llama3.1 (Standard)</SelectItem>
                          <SelectItem value="mistral">Mistral</SelectItem>
                          <SelectItem value="phi3">Phi-3</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  Verbindung testen
                </Button>
              </div>
            )}
          </Section>

          {/* Data */}
          <Section title="Daten" description="Datenverwaltung und Export">
            <SettingRow
              label="Datenbank"
              description="SQLite-Datenbank im lokalen App-Verzeichnis"
            >
              <Badge variant="outline">SQLite</Badge>
            </SettingRow>
            <SettingRow
              label="Export"
              description="Produkte, Aufträge und Ausgaben als CSV exportieren"
            >
              <Button variant="outline" size="sm">
                Exportieren
              </Button>
            </SettingRow>
          </Section>

          {/* About */}
          <Section title="Info">
            <div className="rounded-lg border border-[--border] bg-[--card] px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-[--foreground]">PolyGrid Studio</span>
                  <p className="text-xs text-[--muted-foreground]">
                    Business OS für 3D-Druck-Gewerbe
                  </p>
                </div>
                <Badge variant="secondary">v0.1.0</Badge>
              </div>
            </div>
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}
