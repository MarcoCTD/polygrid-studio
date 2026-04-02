import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "../types";

interface Settings {
  filament_price_per_kg: number;
  printer_wattage: number;
  electricity_price_per_kwh: number;
  platform_fee_percent: number;
}

const DEFAULT_SETTINGS: Settings = {
  filament_price_per_kg: 20,
  printer_wattage: 200,
  electricity_price_per_kwh: 0.3,
  platform_fee_percent: 6.5,
};

interface MarginResult {
  material_cost: number;
  electricity_cost: number;
  packaging_cost: number;
  shipping_cost: number;
  platform_fee: number;
  total_cost: number;
  margin_percent: number;
  profit: number;
}

function calcMargin(
  product: Product,
  salePrice: number,
  settings: Settings,
  shippingOverride: number
): MarginResult {
  const material_cost =
    (product.material_grams ?? 0) * (settings.filament_price_per_kg / 1000);
  const electricity_cost =
    ((product.print_time_minutes ?? 0) / 60) *
    (settings.printer_wattage / 1000) *
    settings.electricity_price_per_kwh;
  const packaging_cost = product.packaging_cost ?? 0;
  const shipping_cost = shippingOverride;
  const platform_fee = salePrice * (settings.platform_fee_percent / 100);
  const total_cost =
    material_cost + electricity_cost + packaging_cost + shipping_cost + platform_fee;
  const profit = salePrice - total_cost;
  const margin_percent = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  return {
    material_cost,
    electricity_cost,
    packaging_cost,
    shipping_cost,
    platform_fee,
    total_cost,
    margin_percent,
    profit,
  };
}

function fmt(n: number, digits = 2) {
  return n.toFixed(digits).replace(".", ",");
}

interface MarginRowProps {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
}

function MarginRow({ label, value, muted, bold }: MarginRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-1", bold && "border-t border-[--border] pt-2 mt-1")}>
      <span className={cn("text-sm", muted ? "text-[--muted-foreground]" : "text-[--foreground]", bold && "font-semibold")}>
        {label}
      </span>
      <span className={cn("font-mono text-sm tabular-nums", muted ? "text-[--muted-foreground]" : "text-[--foreground]", bold && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}

interface MarginCalculatorProps {
  product: Product;
  onSaveMargin?: (margin: number) => void;
  isSaving?: boolean;
}

export function MarginCalculator({ product, onSaveMargin, isSaving = false }: MarginCalculatorProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [salePrice, setSalePrice] = useState<number>(product.target_price ?? 0);
  const [shipping, setShipping] = useState<number>(3.99);
  const [showSettings, setShowSettings] = useState(false);

  const result = useMemo(
    () => calcMargin(product, salePrice, settings, shipping),
    [product, salePrice, settings, shipping]
  );

  const marginColor =
    result.margin_percent >= 50
      ? "text-[--accent-success]"
      : result.margin_percent >= 25
      ? "text-[--accent-warning]"
      : "text-[--accent-danger]";

  function setSetting(key: keyof Settings, val: string) {
    const n = parseFloat(val);
    if (!isNaN(n)) setSettings((s) => ({ ...s, [key]: n }));
  }

  return (
    <div className="space-y-4">
      {/* Sale price input */}
      <div className="space-y-1.5">
        <Label>Verkaufspreis</Label>
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={salePrice}
            onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
            className="pr-8"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[--muted-foreground]">
            €
          </span>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-lg border border-[--border] bg-[--muted] p-3">
        <MarginRow label="Material" value={`${fmt(result.material_cost)} €`} muted />
        <MarginRow label="Strom" value={`${fmt(result.electricity_cost)} €`} muted />
        <MarginRow label="Verpackung" value={`${fmt(result.packaging_cost)} €`} muted />
        <MarginRow
          label="Versand"
          value={
            <span className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={shipping}
                onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                className="h-6 w-20 px-2 py-0 text-xs font-mono"
              />
              <span className="text-xs text-[--muted-foreground]">€</span>
            </span>
          }
          muted
        />
        <MarginRow
          label={`Plattformgebühr (${settings.platform_fee_percent}%)`}
          value={`${fmt(result.platform_fee)} €`}
          muted
        />
        <MarginRow label="Gesamtkosten" value={`${fmt(result.total_cost)} €`} bold />
        <div className="mt-3 flex items-center justify-between rounded-md bg-[--background] px-3 py-2">
          <span className="text-sm font-medium">Marge</span>
          <span className={cn("font-mono text-lg font-bold tabular-nums", marginColor)}>
            {fmt(result.margin_percent, 1)} %
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between px-1">
          <span className="text-xs text-[--muted-foreground]">Gewinn</span>
          <span className={cn("font-mono text-xs tabular-nums", marginColor)}>
            {fmt(result.profit)} €
          </span>
        </div>
      </div>

      {/* Calculator settings (collapsible) */}
      <button
        onClick={() => setShowSettings((s) => !s)}
        className="flex items-center gap-1 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors no-select"
      >
        <span>{showSettings ? "▲" : "▼"}</span>
        <span>Kalkulations-Einstellungen</span>
      </button>

      {showSettings && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-[--border] p-3">
          <div className="space-y-1">
            <Label className="text-xs">Filament (€/kg)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={settings.filament_price_per_kg}
              onChange={(e) => setSetting("filament_price_per_kg", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Drucker (Watt)</Label>
            <Input
              type="number"
              step="10"
              min="0"
              value={settings.printer_wattage}
              onChange={(e) => setSetting("printer_wattage", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Strom (€/kWh)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={settings.electricity_price_per_kwh}
              onChange={(e) => setSetting("electricity_price_per_kwh", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plattformgebühr (%)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={settings.platform_fee_percent}
              onChange={(e) => setSetting("platform_fee_percent", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      {onSaveMargin && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onSaveMargin(result.margin_percent)}
          disabled={isSaving}
        >
          {isSaving
            ? "Speichert..."
            : `Marge speichern (${fmt(result.margin_percent, 1)} %)`}
        </Button>
      )}
    </div>
  );
}
