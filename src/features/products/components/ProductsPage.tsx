import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ProductTable } from "./ProductTable";
import { ProductDetailPanel } from "./ProductDetailPanel";
import { CreateProductDialog } from "./CreateProductDialog";
import { useProductStore, useSelectedProduct } from "../store";
import { PRODUCT_STATUSES } from "../types";
import { STATUS_LABELS } from "./StatusBadge";
import de from "@/i18n/de.json";

const ALL_VALUE = "__all__";

export function ProductsPage() {
  const { products, isLoading, error, fetchProducts, selectProduct, selectedProductId } =
    useProductStore();
  const selectedProduct = useSelectedProduct();

  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Derive unique categories from products
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ).sort();

  const hasActiveFilter = statusFilter || categoryFilter || globalFilter;

  function clearFilters() {
    setStatusFilter("");
    setCategoryFilter("");
    setGlobalFilter("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[--border] px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-[--foreground]">
            {de.products.title}
          </h1>
          <p className="text-xs text-[--muted-foreground]">{de.products.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]"
        >
          <Plus className="size-4" />
          Neues Produkt
        </Button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[--border] px-6 py-3">
        {/* Search */}
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[--muted-foreground]" />
          <Input
            placeholder="Suchen..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Status filter */}
        <Select
          value={statusFilter || ALL_VALUE}
          onValueChange={(v) => setStatusFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle Status</SelectItem>
            {PRODUCT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter */}
        {categories.length > 0 && (
          <Select
            value={categoryFilter || ALL_VALUE}
            onValueChange={(v) => setCategoryFilter(v === ALL_VALUE ? "" : v)}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Alle Kategorien</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear filters */}
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
          >
            <X className="size-3.5" />
            Filter zurücksetzen
          </button>
        )}

        <div className="flex-1" />

        {isLoading && (
          <span className="text-xs text-[--muted-foreground]">Laden...</span>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="rounded-lg border border-[--accent-danger-subtle] bg-[--accent-danger-subtle] px-4 py-2 text-sm text-[--accent-danger]">
            Fehler: {error}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Table */}
          <div className="flex-1 overflow-hidden">
            <ProductTable
              products={products}
              selectedId={selectedProductId}
              statusFilter={statusFilter}
              categoryFilter={categoryFilter}
              globalFilter={globalFilter}
              onRowClick={(p) =>
                selectProduct(selectedProductId === p.id ? null : p.id)
              }
            />
          </div>

          {/* Detail panel — slides in */}
          {selectedProduct && (
            <ProductDetailPanel product={selectedProduct} />
          )}
        </div>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────── */}
      <CreateProductDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
