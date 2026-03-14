import { useState, useEffect } from "react";
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
import { useOrderStore } from "../store";
import {
  CreateOrderSchema,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PLATFORMS,
} from "../types";
import { cn } from "@/lib/utils";

type FormInputs = z.input<typeof CreateOrderSchema>;
type FormOutputs = z.output<typeof CreateOrderSchema>;

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

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getDefaults(): FormInputs {
  return {
    order_date: new Date().toISOString().slice(0, 10),
    platform: "Etsy",
    status: "ordered",
    payment_status: "pending",
    quantity: 1,
    sale_price: "",
    customer_name: "",
  };
}

export function CreateOrderDialog({ open, onOpenChange }: CreateOrderDialogProps) {
  const { createOrder } = useOrderStore();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs, unknown, FormOutputs>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: getDefaults(),
  });

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      reset(getDefaults());
      setSubmitError(null);
    }
  }, [open, reset]);

  async function onSubmit(data: FormOutputs) {
    setSubmitError(null);
    try {
      await createOrder(data);
      reset(getDefaults());
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create order:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Auftrag konnte nicht erstellt werden."
      );
    }
  }

  function handleClose() {
    // Always allow closing — prevents freeze if submission hangs
    reset(getDefaults());
    setSubmitError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Neuer Auftrag</DialogTitle>
          <DialogDescription>
            Pflichtfelder sind mit * markiert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 px-6 py-4">
            {submitError && (
              <div className="rounded-md border border-[--accent-danger]/20 bg-[--accent-danger-subtle] px-3 py-2 text-xs text-[--accent-danger]">
                {submitError}
              </div>
            )}

            {/* Datum + Plattform */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Bestelldatum" required error={errors.order_date?.message}>
                <Input {...register("order_date")} type="date" />
              </FieldWrap>
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
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
            </div>

            {/* Kunde + Bestell-ID */}
            <div className="grid grid-cols-[1fr_140px] gap-3">
              <FieldWrap label="Kunde" error={errors.customer_name?.message}>
                <Input
                  {...register("customer_name")}
                  placeholder="Kundenname"
                />
              </FieldWrap>
              <FieldWrap label="Bestell-Nr." error={errors.external_order_id?.message}>
                <Input
                  {...register("external_order_id")}
                  placeholder="Extern"
                />
              </FieldWrap>
            </div>

            {/* Preis + Menge */}
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <FieldWrap label="Verkaufspreis (€)" required error={errors.sale_price?.message}>
                <Input
                  {...register("sale_price")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
              <FieldWrap label="Menge" error={errors.quantity?.message}>
                <Input
                  {...register("quantity")}
                  type="number"
                  step="1"
                  min="1"
                  placeholder="1"
                />
              </FieldWrap>
            </div>

            {/* Versand + Plattformgebühr */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Versandkosten (€)" error={errors.shipping_cost?.message}>
                <Input
                  {...register("shipping_cost")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
              <FieldWrap label="Plattformgebühr (€)" error={errors.platform_fee?.message}>
                <Input
                  {...register("platform_fee")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
            </div>

            {/* Status + Zahlungsstatus */}
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
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ORDER_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
              <FieldWrap label="Zahlungsstatus" error={errors.payment_status?.message}>
                <Controller
                  control={control}
                  name="payment_status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PAYMENT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
            </div>

            {/* Notizen */}
            <FieldWrap label="Notizen" error={errors.notes?.message}>
              <textarea
                {...register("notes")}
                rows={2}
                placeholder="Optionale Anmerkungen..."
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
              {isSubmitting ? "Erstellen..." : "Auftrag erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
