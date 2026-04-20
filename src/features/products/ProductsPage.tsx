import { useEffect, useMemo, useState } from 'react';
import type { Product } from './schema';
import { listProducts } from './db';
import { getProductSettings } from './settings';
import { calculateMargin } from './margin';
import type { ProductSettings } from './defaults';
import { useProductsUIStore } from './productsUiStore';
import { ProductsToolbar } from './components/ProductsToolbar';
import { ProductsTable } from './components/ProductsTable';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ProductSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { filters } = useProductsUIStore();

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

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Produkte</h1>
        <p className="text-sm text-text-secondary">
          Produktkatalog verwalten und Margen analysieren
        </p>
      </div>

      <ProductsToolbar categories={categories} totalCount={enrichedProducts.length} />
      <ProductsTable products={enrichedProducts} isLoading={isLoading} />
    </div>
  );
}
