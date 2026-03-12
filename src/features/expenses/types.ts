import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "material",
  "equipment",
  "packaging",
  "shipping",
  "software",
  "marketing",
  "office",
  "taxes",
  "insurance",
  "education",
  "other",
] as const;

export const PAYMENT_METHODS = [
  "bank_transfer",
  "paypal",
  "credit_card",
  "cash",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: "Material",
  equipment: "Ausstattung",
  packaging: "Verpackung",
  shipping: "Versand",
  software: "Software",
  marketing: "Marketing",
  office: "Büro",
  taxes: "Steuern & Abgaben",
  insurance: "Versicherung",
  education: "Weiterbildung",
  other: "Sonstiges",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Überweisung",
  paypal: "PayPal",
  credit_card: "Kreditkarte",
  cash: "Bar",
  other: "Sonstiges",
};

// ── Full expense type (from DB) ──────────────────────────────────────────────

export const ExpenseSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  date: z.string(),
  amount_gross: z.number(),
  amount_net: z.number().nullable(),
  tax_amount: z.number().nullable(),
  vendor: z.string(),
  category: z.enum(EXPENSE_CATEGORIES),
  subcategory: z.string().nullable(),
  payment_method: z.string().nullable(),
  purpose: z.string().nullable(),
  product_id: z.string().nullable(),
  receipt_attached: z.boolean(),
  receipt_file_path: z.string().nullable(),
  tax_relevant: z.boolean(),
  recurring: z.boolean(),
  notes: z.string().nullable(),
});

export type Expense = z.infer<typeof ExpenseSchema>;

// ── Create/Edit form schema ──────────────────────────────────────────────────

const requiredPositiveNumber = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = Number(v);
    if (isNaN(n) || n < 0) throw new Error("Ungültiger Betrag");
    return n;
  });

const optionalPositiveNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  })
  .nullable()
  .optional();

export const CreateExpenseSchema = z.object({
  date: z.string().min(1, "Datum ist erforderlich"),
  amount_gross: requiredPositiveNumber,
  amount_net: optionalPositiveNumber,
  tax_amount: optionalPositiveNumber,
  vendor: z.string().min(1, "Lieferant ist erforderlich"),
  category: z.enum(EXPENSE_CATEGORIES, {
    message: "Kategorie ist erforderlich",
  }),
  subcategory: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  product_id: z.string().optional().nullable(),
  receipt_attached: z.boolean().default(false),
  receipt_file_path: z.string().optional().nullable(),
  tax_relevant: z.boolean().default(true),
  recurring: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export type CreateExpenseInput = z.output<typeof CreateExpenseSchema>;
