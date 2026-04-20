import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Product } from '../schema';
import {
  STATUS_LABELS,
  MATERIAL_LABELS,
  SHIPPING_LABELS,
  LICENSE_TYPE_LABELS,
  LICENSE_RISK_LABELS,
  PLATFORM_LABELS,
} from '../labels';
import { COLUMN_LABELS } from '../columnLabels';
import { useProductsUIStore } from '../productsUiStore';
import { formatEUR } from '../utils';

interface CsvExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

// All exportable columns (excluding select)
const ALL_EXPORT_COLUMNS = [
  'name',
  'status',
  'category',
  'subcategory',
  'collection',
  'material_type',
  'target_price',
  'min_price',
  'price_etsy',
  'price_ebay',
  'price_kleinanzeigen',
  'estimated_margin',
  'print_time_minutes',
  'material_grams',
  'electricity_cost',
  'packaging_cost',
  'shipping_class',
  'platforms',
  'license_source',
  'license_type',
  'license_url',
  'license_risk',
  'color_variants',
  'description_internal',
  'notes',
  'upsell_notes',
  'created_at',
  'updated_at',
] as const;

function formatCsvValue(product: Product, column: string): string {
  const value = product[column as keyof Product];
  if (value === null || value === undefined) return '';

  switch (column) {
    case 'status':
      return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? String(value);
    case 'material_type':
      return MATERIAL_LABELS[value as keyof typeof MATERIAL_LABELS] ?? String(value);
    case 'shipping_class':
      return SHIPPING_LABELS[value as keyof typeof SHIPPING_LABELS] ?? String(value);
    case 'license_type':
      return LICENSE_TYPE_LABELS[value as keyof typeof LICENSE_TYPE_LABELS] ?? String(value);
    case 'license_risk':
      return LICENSE_RISK_LABELS[value as keyof typeof LICENSE_RISK_LABELS] ?? String(value);
    case 'platforms': {
      const platforms = product.platforms;
      if (Array.isArray(platforms)) {
        return platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ');
      }
      return '';
    }
    case 'color_variants': {
      const variants = product.color_variants;
      if (Array.isArray(variants)) {
        return variants.map((v) => `${v.name} (${v.hex})`).join(', ');
      }
      return '';
    }
    case 'target_price':
    case 'min_price':
    case 'price_etsy':
    case 'price_ebay':
    case 'price_kleinanzeigen':
    case 'electricity_cost':
    case 'packaging_cost':
      return formatEUR(value as number);
    case 'estimated_margin':
      return typeof value === 'number' ? `${value.toFixed(1)}%` : '';
    default:
      return String(value);
  }
}

function escapeCsvField(field: string): string {
  if (field.includes(';') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function generateCsv(products: Product[], columns: string[]): string {
  // Header
  const header = columns.map((c) => escapeCsvField(COLUMN_LABELS[c] ?? c)).join(';');
  // Rows
  const rows = products.map((product) =>
    columns.map((col) => escapeCsvField(formatCsvValue(product, col))).join(';'),
  );

  // UTF-8 BOM + content
  return '\uFEFF' + header + '\n' + rows.join('\n');
}

export function CsvExportDialog({ open, onOpenChange, products }: CsvExportDialogProps) {
  const [exportMode, setExportMode] = useState<'visible' | 'all'>('visible');
  const [isExporting, setIsExporting] = useState(false);
  const { columnConfig } = useProductsUIStore();

  async function handleExport() {
    setIsExporting(true);
    try {
      const columns =
        exportMode === 'visible'
          ? columnConfig
              .filter((c) => c.visible && c.id !== 'select')
              .sort((a, b) => a.order - b.order)
              .map((c) => c.id)
          : [...ALL_EXPORT_COLUMNS];

      const csv = generateCsv(products, columns);

      const today = new Date().toISOString().split('T')[0];
      const filePath = await save({
        defaultPath: `produkte_${today}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (filePath) {
        await writeTextFile(filePath, csv);
      }

      onOpenChange(false);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>CSV Export</DialogTitle>
          <DialogDescription>
            {products.length} {products.length === 1 ? 'Produkt' : 'Produkte'} exportieren
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-bg-hover">
            <input
              type="radio"
              name="exportMode"
              checked={exportMode === 'visible'}
              onChange={() => setExportMode('visible')}
              className="accent-pg-accent"
            />
            <span className="text-sm">Nur sichtbare Spalten</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 hover:bg-bg-hover">
            <input
              type="radio"
              name="exportMode"
              checked={exportMode === 'all'}
              onChange={() => setExportMode('all')}
              className="accent-pg-accent"
            />
            <span className="text-sm">Alle Spalten</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exportiert...' : 'Exportieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
