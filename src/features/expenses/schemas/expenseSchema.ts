import { z } from 'zod';
import { EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES, PAYMENT_METHODS } from '../constants';

export const expenseCategoryEnum = z.enum(EXPENSE_CATEGORIES);
export const paymentMethodEnum = z.enum(PAYMENT_METHODS);
export const recurringIntervalEnum = z.enum(['monthly', 'quarterly', 'yearly']);
export const importSourceEnum = z.enum(['manual', 'csv_import', 'recurring']);

const subcategoryValues = Object.values(EXPENSE_SUBCATEGORIES).flat() as [
  ExpenseSubcategoryValue,
  ...ExpenseSubcategoryValue[],
];

export const expenseSubcategoryEnum = z.enum(subcategoryValues);

const nullableText = z.string().trim().nullable();
const optionalNullableText = z.string().trim().nullable().optional();
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Datum muss im ISO-Format sein');
const optionalUuid = z.string().uuid().nullable().optional();

export const expenseSchema = z.object({
  id: z.string().uuid(),
  date: isoDateString,
  amount_gross: z.number().positive(),
  amount_net: z.number().min(0).nullable(),
  tax_amount: z.number().min(0).nullable(),
  vendor: z.string().trim().min(1).max(200),
  category: expenseCategoryEnum,
  subcategory: expenseSubcategoryEnum.nullable(),
  payment_method: paymentMethodEnum.nullable(),
  purpose: nullableText,
  product_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  receipt_attached: z.boolean(),
  receipt_file_path: nullableText,
  tax_relevant: z.boolean(),
  recurring: z.boolean(),
  recurring_interval: recurringIntervalEnum.nullable(),
  recurring_next_date: isoDateString.nullable(),
  import_source: importSourceEnum,
  import_ref: nullableText,
  notes: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const createExpenseSchema = z.object({
  date: isoDateString,
  amount_gross: z.number().positive(),
  amount_net: z.number().min(0).nullable().optional(),
  tax_amount: z.number().min(0).nullable().optional(),
  vendor: z.string().trim().min(1).max(200),
  category: expenseCategoryEnum,
  subcategory: expenseSubcategoryEnum.nullable().optional(),
  payment_method: paymentMethodEnum.nullable().optional(),
  purpose: optionalNullableText,
  product_id: optionalUuid,
  order_id: optionalUuid,
  receipt_attached: z.boolean().optional(),
  receipt_file_path: optionalNullableText,
  tax_relevant: z.boolean().optional(),
  recurring: z.boolean().optional(),
  recurring_interval: recurringIntervalEnum.nullable().optional(),
  recurring_next_date: isoDateString.nullable().optional(),
  import_source: importSourceEnum.optional(),
  import_ref: optionalNullableText,
  notes: optionalNullableText,
});

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
});

export const expenseSortFieldEnum = z.enum([
  'date',
  'amount_gross',
  'vendor',
  'category',
  'created_at',
  'updated_at',
]);

export const expenseFilterSchema = z.object({
  date_from: isoDateString.optional(),
  date_to: isoDateString.optional(),
  category: z.array(expenseCategoryEnum).optional(),
  tax_relevant: z.boolean().optional(),
  product_id: optionalUuid,
  has_product: z.boolean().optional(),
  search: z.string().trim().optional(),
  include_deleted: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
  sort_by: expenseSortFieldEnum.optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
});

type ExpenseSubcategoryValue =
  (typeof EXPENSE_SUBCATEGORIES)[keyof typeof EXPENSE_SUBCATEGORIES][number];

export type Expense = z.infer<typeof expenseSchema>;
export type CreateExpense = z.infer<typeof createExpenseSchema>;
export type ExpenseUpdateWithId = z.infer<typeof updateExpenseSchema>;
export type UpdateExpense = Omit<ExpenseUpdateWithId, 'id'>;
export type ExpenseFilter = z.infer<typeof expenseFilterSchema>;
export type ExpenseCategory = z.infer<typeof expenseCategoryEnum>;
export type ExpenseSubcategory = z.infer<typeof expenseSubcategoryEnum>;
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;
export type RecurringInterval = z.infer<typeof recurringIntervalEnum>;
export type ImportSource = z.infer<typeof importSourceEnum>;
export type ExpenseSortField = z.infer<typeof expenseSortFieldEnum>;
