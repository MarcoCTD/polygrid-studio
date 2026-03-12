import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useListingStore } from "../store";
import { useProductStore } from "@/features/products/store";
import {
  CreateListingSchema,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  LISTING_PLATFORMS,
  LISTING_LANGUAGES,
} from "../types";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type FormInputs = z.input<typeof CreateListingSchema>;
type FormOutputs = z.output<typeof CreateListingSchema>;

function FieldWrap({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-[--accent-danger]">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-[--accent-danger]">{error}</p>}
    </div>
  );
}

interface CreateListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
};

export function CreateListingDialog({ open, onOpenChange }: CreateListingDialogProps) {
  const { createListing } = useListingStore();
  const { products, fetchProducts } = useProductStore();

  useEffect(() => {
    if (open && products.length === 0) {
      fetchProducts();
    }
  }, [open, products.length, fetchProducts]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs, unknown, FormOutputs>({
    resolver: zodResolver(CreateListingSchema),
    defaultValues: {
      platform: "Etsy",
      status: "draft",
      language: "de",
    },
  });

  async function onSubmit(data: FormOutputs) {
    try {
      await createListing(data);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create listing:", err);
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Neues Listing</DialogTitle>
          <DialogDescription>
            Pflichtfelder sind mit * markiert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 px-6 py-4">
            {/* Produkt */}
            <FieldWrap label="Produkt" required error={errors.product_id?.message}>
              <Controller
                control={control}
                name="product_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Produkt auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldWrap>

            {/* Titel */}
            <FieldWrap label="Listing-Titel" required error={errors.title?.message}>
              <Input
                {...register("title")}
                placeholder="z.B. Handgefertigte 3D-Druck Vase"
                autoFocus
              />
            </FieldWrap>

            {/* Plattform + Preis */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Plattform" required error={errors.platform?.message}>
                <Controller
                  control={control}
                  name="platform"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LISTING_PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
              <FieldWrap label="Preis (€)" required error={errors.price?.message}>
                <Input
                  {...register("price")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
            </div>

            {/* Status + Sprache */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Status" error={errors.status?.message}>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LISTING_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {LISTING_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
              <FieldWrap label="Sprache" error={errors.language?.message}>
                <Controller
                  control={control}
                  name="language"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LISTING_LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {LANGUAGE_LABELS[l] ?? l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
            </div>

            {/* Kurzbeschreibung */}
            <FieldWrap label="Kurzbeschreibung" error={errors.short_description?.message}>
              <textarea
                {...register("short_description")}
                rows={3}
                placeholder="Kurze Beschreibung des Listings..."
                className={cn(
                  "flex w-full resize-none rounded-md border border-[--input] bg-transparent px-3 py-2 text-sm",
                  "placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                )}
              />
            </FieldWrap>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]"
            >
              {isSubmitting ? "Erstellen..." : "Listing erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
