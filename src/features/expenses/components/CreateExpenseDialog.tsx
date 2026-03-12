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
import { useExpenseStore } from "../store";
import {
  CreateExpenseSchema,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "../types";
import { cn } from "@/lib/utils";

type FormInputs = z.input<typeof CreateExpenseSchema>;
type FormOutputs = z.output<typeof CreateExpenseSchema>;

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

interface CreateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateExpenseDialog({ open, onOpenChange }: CreateExpenseDialogProps) {
  const { createExpense } = useExpenseStore();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs, unknown, FormOutputs>({
    resolver: zodResolver(CreateExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      category: "material",
      tax_relevant: true,
      receipt_attached: false,
      recurring: false,
    },
  });

  async function onSubmit(data: FormOutputs) {
    try {
      await createExpense(data);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create expense:", err);
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
          <DialogTitle>Neue Ausgabe</DialogTitle>
          <DialogDescription>
            Pflichtfelder sind mit * markiert. Ersetzt keine steuerliche Buchführung.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 px-6 py-4">
            {/* Datum + Betrag */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Datum" required error={errors.date?.message}>
                <Input {...register("date")} type="date" />
              </FieldWrap>
              <FieldWrap label="Betrag brutto (€)" required error={errors.amount_gross?.message}>
                <Input
                  {...register("amount_gross")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  autoFocus
                />
              </FieldWrap>
            </div>

            {/* Netto + MwSt */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Netto (€)" error={errors.amount_net?.message}>
                <Input
                  {...register("amount_net")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
              <FieldWrap label="MwSt (€)" error={errors.tax_amount?.message}>
                <Input
                  {...register("tax_amount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                />
              </FieldWrap>
            </div>

            {/* Lieferant */}
            <FieldWrap label="Lieferant / Händler" required error={errors.vendor?.message}>
              <Input
                {...register("vendor")}
                placeholder="z.B. Amazon, Filamentworld..."
              />
            </FieldWrap>

            {/* Kategorie + Zahlungsart */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Kategorie" required error={errors.category?.message}>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {EXPENSE_CATEGORY_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>

              <FieldWrap label="Zahlungsart" error={errors.payment_method?.message}>
                <Controller
                  control={control}
                  name="payment_method"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
            </div>

            {/* Verwendungszweck */}
            <FieldWrap label="Verwendungszweck" error={errors.purpose?.message}>
              <Input
                {...register("purpose")}
                placeholder="z.B. PLA Filament 1kg schwarz"
              />
            </FieldWrap>

            {/* Checkboxes */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register("tax_relevant")}
                  className="size-4 rounded border-[--input]"
                />
                Steuerrelevant
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register("recurring")}
                  className="size-4 rounded border-[--input]"
                />
                Wiederkehrend
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register("receipt_attached")}
                  className="size-4 rounded border-[--input]"
                />
                Beleg vorhanden
              </label>
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
              {isSubmitting ? "Erstellen..." : "Ausgabe erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
