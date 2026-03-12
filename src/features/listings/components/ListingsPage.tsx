import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { CreateListingDialog } from "./CreateListingDialog";
import { useListingStore } from "../store";
import {
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  LISTING_STATUS_VARIANTS,
  LISTING_PLATFORMS,
  type Listing,
  type ListingStatus,
} from "../types";
import { cn } from "@/lib/utils";
import de from "@/i18n/de.json";

const ALL_VALUE = "__all__";

function formatCurrency(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

interface ListingCardProps {
  listing: Listing;
  selected: boolean;
  onSelect: () => void;
}

function ListingCard({ listing, selected, onSelect }: ListingCardProps) {
  return (
    <div
      className={cn(
        "border-b border-[--border] px-6 py-4 transition-colors cursor-pointer",
        "hover:bg-[--muted]",
        selected && "bg-[--accent-primary-subtle]"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <Badge variant={LISTING_STATUS_VARIANTS[listing.status as ListingStatus]}>
          {LISTING_STATUS_LABELS[listing.status as ListingStatus]}
        </Badge>
        <Badge variant="secondary">{listing.platform}</Badge>
        <span className="font-mono text-xs tabular-nums text-[--muted-foreground]">
          {formatCurrency(listing.price)}
        </span>
      </div>
      <h3 className="mt-1.5 text-sm font-medium text-[--foreground] line-clamp-1">
        {listing.title}
      </h3>
      {listing.short_description && (
        <p className="mt-0.5 text-xs text-[--muted-foreground] line-clamp-2">
          {listing.short_description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {listing.tags.slice(0, 4).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
            {tag}
          </Badge>
        ))}
        {listing.tags.length > 4 && (
          <span className="text-[10px] text-[--muted-foreground]">
            +{listing.tags.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}

export function ListingsPage() {
  const { listings, isLoading, error, fetchListings, selectListing, selectedListingId } =
    useListingStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const filtered = listings.filter((l) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (platformFilter && l.platform !== platformFilter) return false;
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      return l.title.toLowerCase().includes(q) ||
        (l.short_description?.toLowerCase().includes(q) ?? false) ||
        l.tags.some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  const hasActiveFilter = statusFilter || platformFilter || globalFilter;

  function clearFilters() {
    setStatusFilter("");
    setPlatformFilter("");
    setGlobalFilter("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[--border] px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-[--foreground]">
            {de.listings.title}
          </h1>
          <p className="text-xs text-[--muted-foreground]">{de.listings.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]"
        >
          <Plus className="size-4" />
          Neues Listing
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[--border] px-6 py-3">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[--muted-foreground]" />
          <Input
            placeholder="Suchen..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select
          value={statusFilter || ALL_VALUE}
          onValueChange={(v) => setStatusFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle Status</SelectItem>
            {LISTING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LISTING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={platformFilter || ALL_VALUE}
          onValueChange={(v) => setPlatformFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Alle Plattformen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle Plattformen</SelectItem>
            {LISTING_PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      {/* Main content */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="rounded-lg border border-[--accent-danger-subtle] bg-[--accent-danger-subtle] px-4 py-2 text-sm text-[--accent-danger]">
            Fehler: {error}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-[--muted-foreground]">Keine Listings gefunden.</p>
            </div>
          ) : (
            filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                selected={selectedListingId === listing.id}
                onSelect={() =>
                  selectListing(selectedListingId === listing.id ? null : listing.id)
                }
              />
            ))
          )}
        </ScrollArea>
      )}

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
