import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Product, ProductUpdate } from '../schema';
import { getProduct, duplicateProduct } from '../db';
import { useAutoSave } from '../hooks/useAutoSave';
import { SaveIndicator } from './SaveIndicator';
import { OverviewTab } from './OverviewTab';
import { MarginCalculator } from './MarginCalculator';
import { PlaceholderTab } from './PlaceholderTab';

function productToFormValues(product: Product): ProductUpdate {
  return {
    name: product.name,
    short_name: product.short_name,
    category: product.category,
    subcategory: product.subcategory,
    description_internal: product.description_internal,
    collection: product.collection,
    status: product.status,
    material_type: product.material_type,
    color_variants: product.color_variants,
    print_time_minutes: product.print_time_minutes,
    material_grams: product.material_grams,
    electricity_cost: product.electricity_cost,
    packaging_cost: product.packaging_cost,
    shipping_class: product.shipping_class,
    target_price: product.target_price,
    min_price: product.min_price,
    price_etsy: product.price_etsy,
    price_ebay: product.price_ebay,
    price_kleinanzeigen: product.price_kleinanzeigen,
    license_source: product.license_source,
    license_type: product.license_type,
    license_url: product.license_url,
    license_risk: product.license_risk,
    platforms: product.platforms,
    notes: product.notes,
    upsell_notes: product.upsell_notes,
  };
}

export function ProductEditPage() {
  const { productId } = useParams({ strict: false }) as { productId: string };
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const form = useForm<ProductUpdate>({
    defaultValues: {},
  });

  // Track whether form has been initialized with DB data
  const [formReady, setFormReady] = useState(false);

  // Load product data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setFormReady(false);
      try {
        const data = await getProduct(productId);
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setProduct(data);
        const formValues = productToFormValues(data);
        console.log('[EditPage] Resetting form with DB data', {
          productId,
          name: formValues.name,
          status: formValues.status,
        });
        form.reset(formValues);
        setFormReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error('Fehler beim Laden des Produkts:', err);
        setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [productId, form]);

  // Auto-save — only enabled once form has been initialized with DB data
  const { saveStatus, lastError, retry } = useAutoSave({
    productId,
    form,
    enabled: formReady,
    onSaved: () => {
      // Reload product to get updated data (for margin calc etc.)
      getProduct(productId).then((updated) => {
        if (updated) setProduct(updated);
      });
    },
  });

  console.log('[EditPage] Render', {
    isLoading,
    formReady,
    saveStatus,
    productId,
  });

  // Escape → back to list
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey) {
        navigate({ to: '/products' });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const goBack = useCallback(() => {
    navigate({ to: '/products' });
  }, [navigate]);

  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = useCallback(async () => {
    setIsDuplicating(true);
    try {
      const dup = await duplicateProduct(productId);
      navigate({ to: '/products/$productId', params: { productId: dup.id } });
    } catch (err) {
      console.error('Duplizieren fehlgeschlagen:', err);
    } finally {
      setIsDuplicating(false);
    }
  }, [productId, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        Produkt wird geladen...
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-text-muted">
        <p className="text-sm">Produkt nicht gefunden</p>
        <Button variant="ghost" onClick={goBack} className="gap-1.5">
          <ArrowLeft size={14} />
          Zurück zur Liste
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-3 dark:border-transparent">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5">
            <ArrowLeft size={14} />
            Zurück
          </Button>
          <h1 className="text-lg font-semibold text-text-primary">{product.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="gap-1.5"
          >
            <Copy size={14} />
            Duplizieren
          </Button>
          <SaveIndicator status={saveStatus} error={lastError} onRetry={retry} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border-subtle px-6 dark:border-transparent">
          <TabsList variant="line">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="files">Dateien</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="costs">Kosten</TabsTrigger>
            <TabsTrigger value="ai">KI</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="overview">
            <OverviewTab form={form} />
          </TabsContent>

          <TabsContent value="files">
            <PlaceholderTab type="files" />
          </TabsContent>

          <TabsContent value="listings">
            <PlaceholderTab type="listings" />
          </TabsContent>

          <TabsContent value="costs">
            <MarginCalculator product={product} />
          </TabsContent>

          <TabsContent value="ai">
            <PlaceholderTab type="ai" />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
