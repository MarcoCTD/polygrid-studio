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
import { useProductStore } from "../store";
import {
  CreateProductSchema,
  PRODUCT_STATUSES,
  MATERIAL_TYPES,
} from "../types";

type FormInputs = z.input<typeof CreateProductSchema>;
type FormOutputs = z.output<typeof CreateProductSchema>;
import { STATUS_LABELS } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface FieldWrapProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function FieldWrap({ label, required, error, children, className }: FieldWrapProps) {
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

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProductDialog({ open, onOpenChange }: CreateProductDialogProps) {
  const { createProduct } = useProductStore();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs, unknown, FormOutputs>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      status: "idea",
      material_type: "PLA",
    },
  });

  async function onSubmit(data: FormOutputs) {
    try {
      await createProduct(data);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create product:", err);
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
          <DialogTitle>Neues Produkt</DialogTitle>
          <DialogDescription>
            Pflichtfelder sind mit * markiert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 px-6 py-4">
            {/* Name + Kurzname */}
            <div className="grid grid-cols-[1fr_160px] gap-3">
              <FieldWrap label="Name" required error={errors.name?.message}>
                <Input
                  {...register("name")}
                  placeholder="z.B. Blumenvase Modell A"
                  autoFocus
                />
              </FieldWrap>
              <FieldWrap label="Kurzname" error={errors.short_name?.message}>
                <Input
                  {...register("short_name")}
                  placeholder="z.B. BV-A"
                />
              </FieldWrap>
            </div>

            {/* Kategorie */}
            <FieldWrap label="Kategorie" required error={errors.category?.message}>
              <Input
                {...register("category")}
                placeholder="z.B. Dekoration, Haushalt, Zubehör..."
              />
            </FieldWrap>

            {/* Material + Status */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Material" error={errors.material_type?.message}>
                <Controller
                  control={control}
                  name="material_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_TYPES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>

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
                        {PRODUCT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
            </div>

            {/* Zielpreis + Mindestpreis */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Zielpreis (€)" error={errors.target_price?.message}>
                <Input
                  {...register("target_price")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
              <FieldWrap label="Mindestpreis (€)" error={errors.min_price?.message}>
                <Input
                  {...register("min_price")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
            </div>

            {/* Druckzeit + Materialverbrauch */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Druckzeit (min)" error={errors.print_time_minutes?.message}>
                <Input
                  {...register("print_time_minutes")}
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                />
              </FieldWrap>
              <FieldWrap label="Materialverbrauch (g)" error={errors.material_grams?.message}>
                <Input
                  {...register("material_grams")}
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                />
              </FieldWrap>
            </div>

            {/* Verpackungskosten */}
            <FieldWrap label="Verpackungskosten (€)" error={errors.packaging_cost?.message}>
              <Input
                {...register("packaging_cost")}
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="max-w-[160px]"
              />
            </FieldWrap>

            {/* Interne Notizen */}
            <FieldWrap label="Interne Beschreibung" error={errors.description_internal?.message}>
              <textarea
                {...register("description_internal")}
                rows={3}
                placeholder="Notizen zum Produkt (nur intern)..."
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
              {isSubmitting ? "Erstellen..." : "Produkt erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
