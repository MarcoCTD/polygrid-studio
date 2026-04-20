import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Download, Plus, Search, Trash2 } from 'lucide-react';
import type { Product } from './schema';
import { listProducts } from './db';
import { getProductSettings } from './settings';
import { calculateMargin } from './margin';
import type { ProductSettings } from './defaults';
import { useProductsUIStore, DEFAULT_COLUMNS } from './productsUiStore';
import { useUIStore } from '@/stores/uiStore';
import { getSetting, setSetting } from '@/services/database';
import { ProductsToolbar } from './components/ProductsToolbar';
import { ProductsTable } from './components/ProductsTable';
import { NewProductDialog } from './components/NewProductDialog';
import { BulkToolbar } from './components/BulkToolbar';
import { CsvExportDialog } from './components/CsvExportDialog';
import { loadSavedFilters } from './components/SavedFilters';

const COLUMN_CONFIG_KEY = 'products_column_config';

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ProductSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showCsvExport, setShowCsvExport] = useState(false);
  const { filters, selectedIds, clearSelection, setColumnConfig, setSavedFilters } =
    useProductsUIStore();
  const { registerCommands, unregisterCommands } = useUIStore();

  // Load settings once
  useEffect(() => {
    getProductSettings().then(setSettings).catch(console.error);
  }, []);

  // Load column config + saved filters from DB once
  useEffect(() => {
    async function loadPersistedState() {
      try {
        const colConfig = await getSetting<typeof DEFAULT_COLUMNS>(COLUMN_CONFIG_KEY);
        if (colConfig && Array.isArray(colConfig)) {
          setColumnConfig(colConfig);
        }
      } catch {
        // Use defaults
      }

      try {
        const savedFilters = await loadSavedFilters();
        setSavedFilters(savedFilters);
      } catch {
        // Ignore
      }
    }

    loadPersistedState();
  }, [setColumnConfig, setSavedFilters]);

  // Persist column config when it changes
  const { columnConfig } = useProductsUIStore();
  useEffect(() => {
    // Don't persist on initial load (when config equals defaults)
    const isDefault = JSON.stringify(columnConfig) === JSON.stringify(DEFAULT_COLUMNS);
    if (!isDefault) {
      setSetting(COLUMN_CONFIG_KEY, columnConfig).catch(console.error);
    }
  }, [columnConfig]);

  // Load products when filters change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const data = await listProducts({
          search: filters.search || undefined,
          status: filters.status.length > 0 ? filters.status : undefined,
          category: filters.category.length > 0 ? filters.category : undefined,
          platforms: filters.platforms.length > 0 ? filters.platforms : undefined,
          licenseRisk: filters.licenseRisk.length > 0 ? filters.licenseRisk : undefined,
          marginMin: filters.marginMin,
          marginMax: filters.marginMax,
          includeDeleted: filters.includeDeleted,
        });
        if (!cancelled) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Produkte:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    filters.search,
    filters.status,
    filters.category,
    filters.platforms,
    filters.licenseRisk,
    filters.marginMin,
    filters.marginMax,
    filters.includeDeleted,
  ]);

  // Enrich products with calculated margin
  const enrichedProducts = useMemo(() => {
    if (!settings) return products;
    return products.map((p) => {
      if (p.estimated_margin !== null) return p;
      const result = calculateMargin(p, settings, null);
      return { ...p, estimated_margin: result.marginPercent };
    });
  }, [products, settings]);

  // Extract unique categories for filter popover
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => cats.add(p.category));
    return Array.from(cats).sort();
  }, [products]);

  // Reload products (used after create, bulk actions, etc.)
  const reloadProducts = useCallback(() => {
    setIsLoading(true);
    listProducts({
      search: filters.search || undefined,
      status: filters.status.length > 0 ? filters.status : undefined,
      category: filters.category.length > 0 ? filters.category : undefined,
      platforms: filters.platforms.length > 0 ? filters.platforms : undefined,
      licenseRisk: filters.licenseRisk.length > 0 ? filters.licenseRisk : undefined,
      marginMin: filters.marginMin,
      marginMax: filters.marginMax,
      includeDeleted: filters.includeDeleted,
    })
      .then(setProducts)
      .catch((err) => console.error('Fehler beim Laden der Produkte:', err))
      .finally(() => setIsLoading(false));
  }, [filters]);

  // Command Registry
  useEffect(() => {
    const commandIds = ['products:new', 'products:search', 'products:trash', 'products:csv-export'];

    registerCommands([
      {
        id: 'products:new',
        label: 'Neues Produkt',
        icon: Plus,
        category: 'action',
        action: () => setShowNewProduct(true),
      },
      {
        id: 'products:search',
        label: 'Produkt suchen',
        icon: Search,
        category: 'navigation',
        action: () => {
          const searchInput = document.querySelector<HTMLInputElement>(
            '[placeholder="Produkte suchen..."]',
          );
          searchInput?.focus();
        },
      },
      {
        id: 'products:trash',
        label: 'Gelöschte Produkte anzeigen',
        icon: Trash2,
        category: 'navigation',
        action: () => navigate({ to: '/products/trash' }),
      },
      {
        id: 'products:csv-export',
        label: 'Produktliste als CSV exportieren',
        icon: Download,
        category: 'action',
        action: () => setShowCsvExport(true),
      },
    ]);

    return () => unregisterCommands(commandIds);
  }, [registerCommands, unregisterCommands, navigate]);

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Produkte</h1>
        <p className="text-sm text-text-secondary">
          Produktkatalog verwalten und Margen analysieren
        </p>
      </div>

      <ProductsToolbar
        categories={categories}
        totalCount={enrichedProducts.length}
        onNewProduct={() => setShowNewProduct(true)}
        onCsvExport={() => setShowCsvExport(true)}
      />

      <BulkToolbar
        selectedCount={selectedIds.size}
        selectedIds={selectedIdsArray}
        onClearSelection={clearSelection}
        onActionComplete={reloadProducts}
      />

      <ProductsTable products={enrichedProducts} isLoading={isLoading} />

      <NewProductDialog
        open={showNewProduct}
        onOpenChange={setShowNewProduct}
        onCreated={reloadProducts}
      />

      <CsvExportDialog
        open={showCsvExport}
        onOpenChange={setShowCsvExport}
        products={enrichedProducts}
      />
    </div>
  );
}
