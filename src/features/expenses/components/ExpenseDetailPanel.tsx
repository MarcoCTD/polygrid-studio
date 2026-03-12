import { useState } from "react";
import { X, Trash2, Pencil, Paperclip, RotateCcw, FileWarning } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExpenseStore } from "../store";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
} from "../types";

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

interface ExpenseDetailPanelProps {
  expense: Expense;
}

export function ExpenseDetailPanel({ expense }: ExpenseDetailPanelProps) {
  const { selectExpense, deleteExpense } = useExpenseStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    await deleteExpense(expense.id);
    setConfirmDelete(false);
  }

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-[--border] bg-[--background]">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-[--border] p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory] ?? expense.category}
            </Badge>
            {expense.recurring && (
              <Badge variant="accent" className="gap-1">
                <RotateCcw className="size-3" />
                Wiederkehrend
              </Badge>
            )}
          </div>
          <h2 className="mt-1.5 text-sm font-semibold leading-snug text-[--foreground]">
            {expense.vendor}
          </h2>
          <p className="text-xs text-[--muted-foreground]">{formatDate(expense.date)}</p>
        </div>
        <button
          onClick={() => selectExpense(null)}
          className="shrink-0 rounded-md p-1 text-[--muted-foreground] transition-colors hover:bg-[--muted] hover:text-[--foreground]"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <Section title="Betrag">
            <Field label="Brutto" value={formatCurrency(expense.amount_gross)} />
            <Field
              label="Netto"
              value={expense.amount_net != null ? formatCurrency(expense.amount_net) : null}
            />
            <Field
              label="MwSt"
              value={expense.tax_amount != null ? formatCurrency(expense.tax_amount) : null}
            />
          </Section>

          <Section title="Details">
            <Field
              label="Zahlungsart"
              value={
                expense.payment_method
                  ? PAYMENT_METHOD_LABELS[expense.payment_method as PaymentMethod] ?? expense.payment_method
                  : null
              }
            />
            <Field label="Zweck" value={expense.purpose} />
            <Field label="Unterkategorie" value={expense.subcategory} />
          </Section>

          <Section title="Status">
            <Field
              label="Steuerrelevant"
              value={
                <Badge variant={expense.tax_relevant ? "success" : "muted"}>
                  {expense.tax_relevant ? "Ja" : "Nein"}
                </Badge>
              }
            />
            <Field
              label="Beleg"
              value={
                expense.receipt_attached ? (
                  <span className="flex items-center gap-1 text-[--accent-success]">
                    <Paperclip className="size-3.5" />
                    Vorhanden
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[--accent-warning]">
                    <FileWarning className="size-3.5" />
                    Fehlt
                  </span>
                )
              }
            />
          </Section>

          {expense.notes && (
            <Section title="Notizen">
              <p className="text-sm text-[--muted-foreground] whitespace-pre-wrap">
                {expense.notes}
              </p>
            </Section>
          )}

          {/* Tax disclaimer */}
          <div className="rounded-md border border-[--accent-warning-subtle] bg-[--accent-warning-subtle] px-3 py-2">
            <p className="text-xs text-[--accent-warning]">
              Ersetzt keine steuerliche Buchführung.
            </p>
          </div>
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
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button
              size="sm"
              className="gap-1 bg-[--accent-danger] text-white hover:bg-[--accent-danger-hover]"
              onClick={handleDelete}
            >
              Löschen
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-[--muted-foreground] hover:text-[--accent-danger]"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
