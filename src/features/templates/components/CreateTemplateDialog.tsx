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
import { useTemplateStore } from "../store";
import {
  CreateTemplateSchema,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
} from "../types";
import { cn } from "@/lib/utils";

type FormInputs = z.input<typeof CreateTemplateSchema>;
type FormOutputs = z.output<typeof CreateTemplateSchema>;

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

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const { createTemplate } = useTemplateStore();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs, unknown, FormOutputs>({
    resolver: zodResolver(CreateTemplateSchema),
    defaultValues: {
      category: "sonstiges",
      is_legal: false,
    },
  });

  async function onSubmit(data: FormOutputs) {
    try {
      await createTemplate(data);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create template:", err);
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
          <DialogTitle>Neue Vorlage</DialogTitle>
          <DialogDescription>
            Pflichtfelder sind mit * markiert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 px-6 py-4">
            {/* Name */}
            <FieldWrap label="Name" required error={errors.name?.message}>
              <Input
                {...register("name")}
                placeholder="z.B. Versandinfo Etsy"
                autoFocus
              />
            </FieldWrap>

            {/* Kategorie */}
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
                      {TEMPLATE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {TEMPLATE_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldWrap>

            {/* Inhalt */}
            <FieldWrap label="Inhalt" required error={errors.content?.message}>
              <textarea
                {...register("content")}
                rows={8}
                placeholder="Vorlagentext eingeben... Variablen als {{variable_name}}"
                className={cn(
                  "flex w-full resize-none rounded-md border border-[--input] bg-transparent px-3 py-2 text-sm font-mono",
                  "placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                )}
              />
            </FieldWrap>

            {/* Checkboxes */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register("is_legal")}
                  className="size-4 rounded border-[--input]"
                />
                Rechtstext
              </label>
            </div>

            {/* Notizen */}
            <FieldWrap label="Notizen" error={errors.notes?.message}>
              <Input
                {...register("notes")}
                placeholder="Interne Anmerkungen..."
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
              {isSubmitting ? "Erstellen..." : "Vorlage erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
