import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { listProducts, type Product } from '@/features/products';

interface ProductComboboxProps {
  value: string | null;
  onChange: (productId: string | null) => void;
  placeholder?: string;
}

export function ProductCombobox({
  value,
  onChange,
  placeholder = 'Produkt auswählen',
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      setIsLoading(true);
      listProducts({ includeDeleted: false })
        .then((items) => {
          if (!cancelled) setProducts(items);
        })
        .catch(() => {
          if (!cancelled) setProducts([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value) ?? null,
    [products, value],
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => product.name.toLowerCase().includes(term));
  }, [products, search]);

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <button
            type="button"
            className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm text-text-primary transition-colors hover:bg-bg-hover"
          >
            <span className={cn('truncate', !selectedProduct && 'text-text-muted')}>
              {selectedProduct ? selectedProduct.name : placeholder}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 text-text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Produkt suchen..."
            autoFocus
          />

          <div className="max-h-56 overflow-auto">
            {isLoading ? (
              <p className="px-2 py-3 text-sm text-text-muted">Produkte werden geladen...</p>
            ) : null}

            {!isLoading && filteredProducts.length === 0 ? (
              <p className="px-2 py-3 text-sm text-text-muted">Keine Produkte gefunden</p>
            ) : null}

            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg-hover"
                onClick={() => {
                  onChange(product.id);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Check
                  size={14}
                  className={cn('text-pg-accent', product.id !== value && 'opacity-0')}
                />
                <span className="min-w-0 truncate">{product.name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Produktzuordnung entfernen"
          onClick={() => onChange(null)}
        >
          <X size={14} />
        </Button>
      ) : null}
    </div>
  );
}
