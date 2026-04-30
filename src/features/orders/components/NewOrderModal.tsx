import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/features/products/schema';
import { NewOrderSchema, type NewOrderInput, type Order, type OrderPlatform } from '../types';
import { createOrder, estimateOrderCosts, getActiveProductsForOrders } from '../services';

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (order: Order) => void;
}

const PLATFORM_OPTIONS: { value: OrderPlatform; label: string }[] = [
  { value: 'etsy', label: 'Etsy' },
  { value: 'ebay', label: 'eBay' },
  { value: 'kleinanzeigen', label: 'Kleinanzeigen' },
  { value: 'direkt', label: 'Direkt' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewOrderModal({ open, onOpenChange, onCreated }: NewOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backfillMode, setBackfillMode] = useState(false);

  const form = useForm<NewOrderInput>({
    resolver: zodResolver(NewOrderSchema),
    defaultValues: {
      platform: 'direkt',
      product_id: null,
      variant: null,
      quantity: 1,
      sale_price: 0,
      shipping_revenue: null,
      payment_received_date: null,
      order_date: today(),
      notes: null,
    },
  });

  const productId = useWatch({ control: form.control, name: 'product_id' });
  const platform = useWatch({ control: form.control, name: 'platform' });
  const salePrice = useWatch({ control: form.control, name: 'sale_price' });

  useEffect(() => {
    if (!open) return;

    void getActiveProductsForOrders()
      .then(setProducts)
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : 'Produkte konnten nicht geladen werden',
        ),
      );
  }, [open]);

  useEffect(() => {
    if (!backfillMode) {
      form.setValue('receipt_number', undefined);
    }
  }, [backfillMode, form]);

  useEffect(() => {
    if (!open) return;
    const selectedProduct = products.find((product) => product.id === productId) ?? null;

    void estimateOrderCosts(selectedProduct, platform, Number(salePrice) || 0)
      .then((costs) => {
        form.setValue('material_cost', costs.material_cost);
        form.setValue('platform_fee', costs.platform_fee);
      })
      .catch(() => {
        form.setValue('material_cost', null);
        form.setValue('platform_fee', null);
      });
  }, [form, open, platform, productId, products, salePrice]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => product.name.toLowerCase().includes(query));
  }, [productSearch, products]);

  async function handleSubmit(values: NewOrderInput) {
    setIsSubmitting(true);
    try {
      const cleaned: NewOrderInput = {
        ...values,
        receipt_number: backfillMode ? values.receipt_number : undefined,
        product_id: values.product_id || null,
        variant: values.product_id ? values.variant || null : null,
        payment_received_date: values.payment_received_date || null,
        shipping_revenue: values.shipping_revenue ?? null,
        notes: values.notes ?? null,
      };
      const order = await createOrder(cleaned);
      toast.success(`Auftrag ${order.receipt_number} erstellt`);
      form.reset({
        platform: 'direkt',
        product_id: null,
        variant: null,
        quantity: 1,
        sale_price: 0,
        shipping_revenue: null,
        payment_received_date: null,
        order_date: today(),
        notes: null,
      });
      setBackfillMode(false);
      onCreated(order);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Auftrag konnte nicht erstellt werden');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neuer Auftrag</DialogTitle>
          <DialogDescription>
            Belegnummern werden automatisch vergeben. Backfill erlaubt eine manuelle Nummer.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Plattform</span>
              <Controller
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Produkt</span>
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Produkt suchen"
              />
              <Controller
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Produkt</SelectItem>
                      {filteredProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </label>

            {productId && (
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Variante</span>
                <Input {...form.register('variant')} placeholder="z.B. Schwarz matt" />
              </label>
            )}

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Menge</span>
              <Input
                type="number"
                min="1"
                {...form.register('quantity', { valueAsNumber: true })}
              />
              {form.formState.errors.quantity && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.quantity.message}
                </span>
              )}
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Verkaufspreis</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                {...form.register('sale_price', { valueAsNumber: true })}
              />
              {form.formState.errors.sale_price && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.sale_price.message}
                </span>
              )}
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Versanderlös</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                {...form.register('shipping_revenue', {
                  setValueAs: (value: string) => (value === '' ? null : Number(value)),
                })}
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Externe Bestell-ID</span>
              <Input {...form.register('external_order_id')} />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Kundenname</span>
              <Input {...form.register('customer_name')} />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Bestelldatum</span>
              <Input type="date" {...form.register('order_date')} />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Zahlungseingang</span>
              <Input
                type="date"
                {...form.register('payment_received_date', {
                  setValueAs: (value: string) => (value === '' ? null : value),
                })}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={backfillMode}
              onCheckedChange={(checked) => setBackfillMode(checked)}
            />
            Vergangener Auftrag (Backfill-Modus)
          </label>

          {backfillMode ? (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Belegnummer</span>
              <Input placeholder="2026-0042" {...form.register('receipt_number')} />
              {form.formState.errors.receipt_number && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.receipt_number.message}
                </span>
              )}
            </label>
          ) : (
            <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm text-text-secondary">
              Belegnummer: wird beim Speichern automatisch vergeben.
            </div>
          )}

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Notizen</span>
            <Textarea rows={3} {...form.register('notes')} />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Auftrag erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
