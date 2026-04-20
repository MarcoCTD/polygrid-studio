import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { Product } from './schema';
import { listProducts } from './db';
import { getProductSettings } from './settings';
import { calculateMargin } from './margin';
import type { ProductSettings } from './defaults';
import { useProductsUIStore } from './productsUiStore';
import { useUIStore } from '@/stores/uiStore';
import { ProductsToolbar } from './components/ProductsToolbar';
import { ProductsTable } from './components/ProductsTable';
import { NewProductDialog } from './components/NewProductDialog';

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ProductSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const { filters } = useProductsUIStore();
  const { registerCommands, unregisterCommands } = useUIStore();

  // Load settings once
  useEffect(() => {
    getProductSettings().then(setSettings).catch(console.error);
  }, []);

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

  // Reload products (used after create)
  const reloadProducts = useCallback(() => {
    // Trigger re-fetch by toggling a dummy state — the useEffect depends on filters
    // so we just re-run the load
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
    const commandIds = ['products:new', 'products:search', 'products:trash'];

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
    ]);

    return () => unregisterCommands(commandIds);
  }, [registerCommands, unregisterCommands, navigate]);

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
      />
      <ProductsTable products={enrichedProducts} isLoading={isLoading} />

      <NewProductDialog
        open={showNewProduct}
        onOpenChange={setShowNewProduct}
        onCreated={reloadProducts}
      />
    </div>
  );
}
