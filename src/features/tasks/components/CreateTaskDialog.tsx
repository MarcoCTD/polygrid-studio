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
import { useTaskStore } from "../store";
import {
  CreateTaskSchema,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
} from "../types";
import { cn } from "@/lib/utils";

type FormInputs = z.input<typeof CreateTaskSchema>;
type FormOutputs = z.output<typeof CreateTaskSchema>;

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

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULTS: FormInputs = {
  title: "",
  priority: "medium",
  status: "todo",
};

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const { createTask } = useTaskStore();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs, unknown, FormOutputs>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: DEFAULTS,
  });

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setSubmitError(null);
    }
  }, [open, reset]);

  async function onSubmit(data: FormOutputs) {
    setSubmitError(null);
    try {
      await createTask(data);
      reset(DEFAULTS);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create task:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Aufgabe konnte nicht erstellt werden."
      );
    }
  }

  function handleClose() {
    // Always allow closing — prevents freeze if submission hangs
    reset(DEFAULTS);
    setSubmitError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Neue Aufgabe</DialogTitle>
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

            {/* Titel */}
            <FieldWrap label="Titel" required error={errors.title?.message}>
              <Input
                {...register("title")}
                placeholder="z.B. Listing-Fotos aufnehmen"
                autoFocus
              />
            </FieldWrap>

            {/* Beschreibung */}
            <FieldWrap label="Beschreibung" error={errors.description?.message}>
              <textarea
                {...register("description")}
                rows={3}
                placeholder="Details zur Aufgabe..."
                className={cn(
                  "flex w-full resize-none rounded-md border border-[--input] bg-transparent px-3 py-2 text-sm",
                  "placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                )}
              />
            </FieldWrap>

            {/* Priorität + Fälligkeitsdatum */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Priorität" error={errors.priority?.message}>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {TASK_PRIORITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldWrap>
              <FieldWrap label="Fällig am" error={errors.due_date?.message}>
                <Input {...register("due_date")} type="date" />
              </FieldWrap>
            </div>
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
              {isSubmitting ? "Erstellen..." : "Aufgabe erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
