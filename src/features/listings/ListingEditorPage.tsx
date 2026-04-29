import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useForm, useWatch } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';
import {
  calculateCompleteness,
  getListing,
  updateListing,
  type ListingDetail,
} from './listingsService';
import {
  listingToMasterFormValues,
  masterFormValuesToUpdateInput,
  masterListingFormSchema,
  type MasterListingFormValues,
} from './masterFormSchema';
import type { Platform, SyncStatus } from './schemas';
import { EbayTab } from './components/EbayTab';
import { EtsyTab } from './components/EtsyTab';
import { ImagesTab } from './components/ImagesTab';
import { KleinanzeigenTab } from './components/KleinanzeigenTab';
import { MasterTab } from './components/MasterTab';
import { ListingEditorFooter, type SaveStatus } from './components/ListingEditorFooter';
import { ListingPlaceholderTab } from './components/ListingPlaceholderTab';
import { VariantsTab } from './components/VariantsTab';

const PLATFORM_TAB_LABELS: Record<Platform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

const SYNC_STATUS_CLASSES: Record<SyncStatus | 'inactive', string> = {
  manual: 'bg-zinc-300',
  pending: 'bg-amber-400',
  synced: 'bg-emerald-500',
  error: 'bg-red-500',
  inactive: 'bg-zinc-200',
};

export function ListingEditorPage() {
  const { listingId } = useParams({ strict: false }) as { listingId: string };
  const navigate = useNavigate();
  const registerShortcuts = useUIStore((state) => state.registerShortcuts);
  const unregisterShortcuts = useUIStore((state) => state.unregisterShortcuts);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const form = useForm<MasterListingFormValues>({
    resolver: zodResolver(masterListingFormSchema),
    mode: 'onChange',
    defaultValues: {
      master_title: '',
      master_short_description: null,
      master_long_description: null,
      master_tags: [],
      base_price: 0,
      inventory_mode: 'made_to_order',
      stock_quantity: null,
      sku_base: null,
      processing_time_min_days: null,
      processing_time_max_days: null,
      weight_grams: null,
      dimension_length_cm: null,
      dimension_width_cm: null,
      dimension_height_cm: null,
      language: 'de',
      status: 'draft',
      append_legal_texts: true,
    },
  });

  const watchedValues = useWatch({ control: form.control });

  const goBack = useCallback(() => {
    void navigate({ to: '/listings' });
  }, [navigate]);

  const loadListing = useCallback(async () => {
    setIsLoading(true);
    setFormReady(false);

    try {
      const data = await getListing(listingId);
      if (!data) {
        setNotFound(true);
        return;
      }

      setListing(data);
      form.reset(listingToMasterFormValues(data));
      setSaveStatus('saved');
      setFormReady(true);
      setNotFound(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Listing konnte nicht geladen werden');
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [form, listingId]);

  const handleSave = useCallback(async () => {
    await form.handleSubmit(async (values) => {
      setSaveStatus('saving');
      try {
        const updated = await updateListing(listingId, masterFormValuesToUpdateInput(values));
        setListing(updated);
        form.reset(listingToMasterFormValues(updated));
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('unsaved');
        toast.error(err instanceof Error ? err.message : 'Listing konnte nicht gespeichert werden');
      }
    })();
  }, [form, listingId]);

  useEffect(() => {
    queueMicrotask(() => void loadListing());
  }, [loadListing]);

  useEffect(() => {
    if (!formReady || !form.formState.isDirty) return;

    queueMicrotask(() => setSaveStatus('unsaved'));
    const timeout = window.setTimeout(() => {
      void handleSave();
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [form.formState.isDirty, formReady, handleSave, watchedValues]);

  useEffect(() => {
    const shortcutId = 'listing-editor:save';
    registerShortcuts([
      {
        id: shortcutId,
        keys: 'mod+s',
        description: 'Listing speichern',
        action: () => void handleSave(),
      },
    ]);

    return () => unregisterShortcuts([shortcutId]);
  }, [handleSave, registerShortcuts, unregisterShortcuts]);

  const completeness = useMemo(() => {
    if (!listing) {
      return { etsy: 'red', ebay: 'red', kleinanzeigen: 'red' } as const;
    }

    const values = {
      ...listingToMasterFormValues(listing),
      ...watchedValues,
    } as MasterListingFormValues;
    const currentListing = {
      ...listing,
      ...values,
      overrides: listing.overrides,
      imageCount: listing.images.length,
    };

    return {
      etsy: calculateCompleteness(currentListing, 'etsy'),
      ebay: calculateCompleteness(currentListing, 'ebay'),
      kleinanzeigen: calculateCompleteness(currentListing, 'kleinanzeigen'),
    };
  }, [listing, watchedValues]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Listing wird geladen...
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-text-muted">
        <p className="text-sm">Listing nicht gefunden</p>
        <Button variant="ghost" onClick={goBack} className="gap-1.5">
          <ArrowLeft size={14} />
          Zurück zur Liste
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-6 py-3 dark:border-transparent">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{listing.master_title}</h1>
          <p className="text-sm text-text-secondary">{listing.product_name ?? 'Produkt'}</p>
        </div>
      </div>

      <Tabs defaultValue="master" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border-subtle px-6 dark:border-transparent">
          <TabsList variant="line">
            <TabsTrigger value="master">Master</TabsTrigger>
            <TabsTrigger value="images">Bilder</TabsTrigger>
            <TabsTrigger value="variants">Varianten</TabsTrigger>
            <TabsTrigger value="etsy">
              <PlatformTabLabel listing={listing} platform="etsy" />
            </TabsTrigger>
            <TabsTrigger value="ebay">
              <PlatformTabLabel listing={listing} platform="ebay" />
            </TabsTrigger>
            <TabsTrigger value="kleinanzeigen">
              <PlatformTabLabel listing={listing} platform="kleinanzeigen" />
            </TabsTrigger>
            <TabsTrigger value="preview">Vorschau</TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          <TabsContent value="master">
            <MasterTab listing={listing} form={form} />
          </TabsContent>
          <TabsContent value="images">
            <ImagesTab listing={listing} onImagesChanged={() => void loadListing()} />
          </TabsContent>
          <TabsContent value="variants">
            <VariantsTab listing={listing} onVariantsChanged={() => void loadListing()} />
          </TabsContent>
          <TabsContent value="etsy">
            <EtsyTab listing={listing} onChanged={() => void loadListing()} />
          </TabsContent>
          <TabsContent value="ebay">
            <EbayTab listing={listing} onChanged={() => void loadListing()} />
          </TabsContent>
          <TabsContent value="kleinanzeigen">
            <KleinanzeigenTab listing={listing} onChanged={() => void loadListing()} />
          </TabsContent>
          <TabsContent value="preview">
            <ListingPlaceholderTab title="Vorschau" subSession="5.7" />
          </TabsContent>
        </div>
      </Tabs>

      <ListingEditorFooter
        saveStatus={saveStatus}
        completeness={completeness}
        onBack={goBack}
        onSave={() => void handleSave()}
      />
    </div>
  );
}

function PlatformTabLabel({ listing, platform }: { listing: ListingDetail; platform: Platform }) {
  const override = listing.overrides.find((entry) => entry.platform === platform);
  const status = override?.is_active ? override.sync_status : 'inactive';

  return (
    <span className="flex items-center gap-1.5">
      <span>{PLATFORM_TAB_LABELS[platform]}</span>
      <span title={status} className={cn('size-2 rounded-full', SYNC_STATUS_CLASSES[status])} />
    </span>
  );
}
