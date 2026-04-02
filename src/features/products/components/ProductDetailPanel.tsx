import { useState } from "react";
import { X, Pencil, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { MarginCalculator } from "./MarginCalculator";
import { useProductStore } from "../store";
import { cn } from "@/lib/utils";
import type { Product } from "../types";

const LICENSE_RISK_LABELS = {
  safe: "Sicher",
  review_needed: "Prüfung nötig",
  risky: "Risikoreich",
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-xs text-[--muted-foreground] pt-0.5">{label}</span>
      <span className="text-sm text-[--foreground]">{value}</span>
    </div>
  );
}

type Tab = "overview" | "margin" | "license";

interface ProductDetailPanelProps {
  product: Product;
}

export function ProductDetailPanel({ product }: ProductDetailPanelProps) {
  const { selectProduct, deleteProduct, updateProduct } = useProductStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMargin, setIsSavingMargin] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;

    setActionError(null);
    setIsDeleting(true);

    try {
      await deleteProduct(product.id);
      setConfirmDelete(false);
    } catch (err) {
      console.error("Failed to delete product:", err);
      setActionError(
        err instanceof Error ? err.message : "Produkt konnte nicht gelöscht werden."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSaveMargin(margin: number) {
    if (isSavingMargin) return;

    setActionError(null);
    setIsSavingMargin(true);

    try {
      await updateProduct(product.id, { estimated_margin: margin });
    } catch (err) {
      console.error("Failed to save margin:", err);
      setActionError(
        err instanceof Error ? err.message : "Marge konnte nicht gespeichert werden."
      );
    } finally {
      setIsSavingMargin(false);
    }
  }

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-[--border] bg-[--background]">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-[--border] p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={product.status} />
            {product.license_risk === "risky" && (
              <Badge variant="danger" className="gap-1">
                <AlertTriangle className="size-3" />
                Lizenz
              </Badge>
            )}
          </div>
          <h2 className="mt-1.5 text-sm font-semibold leading-snug text-[--foreground]">
            {product.name}
          </h2>
          {product.short_name && (
            <p className="text-xs text-[--muted-foreground]">{product.short_name}</p>
          )}
        </div>
        <button
          onClick={() => selectProduct(null)}
          className="shrink-0 rounded-md p-1 text-[--muted-foreground] transition-colors hover:bg-[--muted] hover:text-[--foreground]"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[--border]">
        {(["overview", "margin", "license"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors",
              tab === t
                ? "border-b-2 border-[--accent-primary] text-[--accent-primary]"
                : "text-[--muted-foreground] hover:text-[--foreground]"
            )}
          >
            {t === "overview" ? "Übersicht" : t === "margin" ? "Marge" : "Lizenz"}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {actionError && (
            <div className="rounded-md border border-[--accent-danger]/20 bg-[--accent-danger-subtle] px-3 py-2 text-xs text-[--accent-danger]">
              {actionError}
            </div>
          )}
          {tab === "overview" && (
            <>
              <Section title="Produkt">
                <Field label="Kategorie" value={product.category} />
                <Field label="Unterkategorie" value={product.subcategory} />
                <Field label="Kollektion" value={product.collection} />
                <Field label="Material" value={product.material_type} />
                {product.color_variants.length > 0 && (
                  <Field
                    label="Varianten"
                    value={
                      <div className="flex flex-wrap gap-1">
                        {product.color_variants.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    }
                  />
                )}
              </Section>

              <Section title="Druck">
                <Field
                  label="Druckzeit"
                  value={
                    product.print_time_minutes
                      ? `${product.print_time_minutes} min`
                      : null
                  }
                />
                <Field
                  label="Materialverbrauch"
                  value={
                    product.material_grams
                      ? `${product.material_grams} g`
                      : null
                  }
                />
                <Field label="Versandklasse" value={product.shipping_class} />
              </Section>

              <Section title="Preise">
                <Field
                  label="Zielpreis"
                  value={
                    product.target_price
                      ? `${product.target_price.toFixed(2)} €`
                      : null
                  }
                />
                <Field
                  label="Mindestpreis"
                  value={
                    product.min_price
                      ? `${product.min_price.toFixed(2)} €`
                      : null
                  }
                />
                <Field
                  label="Est. Marge"
                  value={
                    product.estimated_margin != null ? (
                      <span
                        className={cn(
                          "font-mono font-medium",
                          product.estimated_margin >= 50
                            ? "text-[--accent-success]"
                            : product.estimated_margin >= 25
                            ? "text-[--accent-warning]"
                            : "text-[--accent-danger]"
                        )}
                      >
                        {product.estimated_margin.toFixed(1)} %
                      </span>
                    ) : null
                  }
                />
              </Section>

              {product.platforms.length > 0 && (
                <Section title="Plattformen">
                  <div className="flex flex-wrap gap-1">
                    {product.platforms.map((p) => (
                      <Badge key={p} variant="outline">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </Section>
              )}

              {product.description_internal && (
                <Section title="Interne Notizen">
                  <p className="text-sm text-[--muted-foreground] whitespace-pre-wrap">
                    {product.description_internal}
                  </p>
                </Section>
              )}
            </>
          )}

          {tab === "margin" && (
            <MarginCalculator
              product={product}
              onSaveMargin={handleSaveMargin}
              isSaving={isSavingMargin}
            />
          )}

          {tab === "license" && (
            <>
              <Section title="Lizenz">
                <Field label="Quelle" value={product.license_source} />
                <Field label="Typ" value={product.license_type} />
                <Field
                  label="URL"
                  value={
                    product.license_url ? (
                      <a
                        href={product.license_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[--accent-primary] hover:underline"
                      >
                        <span className="truncate">{product.license_url}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : null
                  }
                />
                {product.license_risk && (
                  <Field
                    label="Risiko"
                    value={
                      <Badge
                        variant={
                          product.license_risk === "safe"
                            ? "success"
                            : product.license_risk === "review_needed"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {LICENSE_RISK_LABELS[product.license_risk]}
                      </Badge>
                    }
                  />
                )}
              </Section>
              {product.upsell_notes && (
                <Section title="Upsell-Hinweise">
                  <p className="text-sm text-[--muted-foreground]">
                    {product.upsell_notes}
                  </p>
                </Section>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="flex gap-2 border-t border-[--border] p-3">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5">
          <Pencil className="size-3.5" />
          Bearbeiten
        </Button>
        {confirmDelete ? (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              className="gap-1 bg-[--accent-danger] text-white hover:bg-[--accent-danger-hover]"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Löschen..." : "Löschen"}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-[--muted-foreground] hover:text-[--accent-danger]"
            onClick={() => setConfirmDelete(true)}
            disabled={isDeleting}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
