import { z } from 'zod';
import { expenseCategoryEnum, expenseSubcategoryEnum } from '@/features/expenses/schemas';
import { OrderPlatformEnum, OrderStatusEnum } from '@/features/orders/types';
import { taskPriorityEnum } from '@/features/tasks/schemas';

const uuid = z.string().uuid();

// ============================================================
// Aktionen (discriminated union auf "type")
// ============================================================

export const playbookActionTypeEnum = z.enum(['create_task', 'create_expense', 'suggest_template']);

export const createTaskActionSchema = z.object({
  type: z.literal('create_task'),
  /** Titel mit {{variablen}} aus der Vorlagen-Registry. */
  title_template: z.string().trim().min(1).max(200),
  priority: taskPriorityEnum.default('medium'),
  /** Fälligkeit = heute + Offset in Tagen; null = kein Datum. */
  due_offset_days: z.number().int().min(0).max(365).nullable().default(null),
  /** Verknüpft die erstellte Aufgabe mit dem auslösenden Auftrag. */
  link_order: z.boolean().default(true),
});

export const expenseAmountSourceEnum = z.enum(['shipping_cost', 'platform_fee']);

export const createExpenseActionSchema = z
  .object({
    type: z.literal('create_expense'),
    /** Fester Bruttobetrag – schließt amount_source aus. */
    amount_gross: z.number().positive().nullable().default(null),
    /** Liest den Betrag aus dem auslösenden Auftrag – schließt amount_gross aus. */
    amount_source: expenseAmountSourceEnum.nullable().default(null),
    category: expenseCategoryEnum,
    subcategory: expenseSubcategoryEnum.nullable().default(null),
    vendor: z.string().trim().min(1).max(200),
    /** Verwendungszweck mit {{variablen}}. */
    purpose_template: z.string().trim().max(500).default(''),
  })
  .superRefine((action, ctx) => {
    const hasFixedAmount = action.amount_gross !== null;
    const hasAmountSource = action.amount_source !== null;
    if (hasFixedAmount === hasAmountSource) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount_gross'],
        message: 'Entweder fester Betrag ODER Betragsquelle aus dem Auftrag – genau eines.',
      });
    }
  });

export const suggestTemplateActionSchema = z.object({
  type: z.literal('suggest_template'),
  template_id: uuid,
});

export const playbookActionSchema = z.discriminatedUnion('type', [
  createTaskActionSchema,
  createExpenseActionSchema,
  suggestTemplateActionSchema,
]);

// ============================================================
// Playbook
// ============================================================

export const playbookSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(200),
  enabled: z.boolean(),
  trigger_status: OrderStatusEnum,
  /** null oder leeres Array = alle Plattformen. */
  platform_filter: z.array(OrderPlatformEnum).nullable(),
  actions: z.array(playbookActionSchema).min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  deleted_at: z.string().nullable(),
});

/**
 * Anzeige-Variante für Listen: trigger_status bleibt Rohtext, damit
 * Alt-Daten mit einem inzwischen entfernten Status (z.B. 'paid' vor
 * Migration 0017/0018) die Liste nicht komplett blockieren. Ob der
 * Trigger noch gültig ist, sagt trigger_status_valid.
 */
export const playbookListItemSchema = playbookSchema
  .extend({ trigger_status: z.string().min(1) })
  .transform((playbook) => ({
    ...playbook,
    trigger_status_valid: OrderStatusEnum.safeParse(playbook.trigger_status).success,
  }));

export const playbookCreateSchema = playbookSchema
  .omit({ id: true, created_at: true, updated_at: true, deleted_at: true })
  .extend({
    enabled: z.boolean().default(true),
    platform_filter: z.array(OrderPlatformEnum).nullable().default(null),
  });

export const playbookUpdateSchema = playbookCreateSchema.partial();

// ============================================================
// Runs (Ausführungs-Log)
// ============================================================

export const playbookRunStatusEnum = z.enum(['success', 'partial', 'error', 'dry_run']);
export const actionResultStatusEnum = z.enum(['success', 'skipped', 'error']);

export const actionResultSchema = z.object({
  action_type: playbookActionTypeEnum,
  status: actionResultStatusEnum,
  /** ID der erstellten Aufgabe/Ausgabe (nur create_task/create_expense, kein Dry-Run). */
  entity_id: z.string().nullable().default(null),
  /** Hinweis: Fehlermeldung, Skip-Grund oder nicht auflösbare Variablen. */
  message: z.string().nullable().default(null),
  /** Menschenlesbare Vorschau, was erstellt wurde bzw. würde (Dry-Run). */
  preview: z.string().nullable().default(null),
  /** Nur suggest_template: referenzierte Vorlage. */
  template_id: z.string().nullable().default(null),
  template_name: z.string().nullable().default(null),
  /** Nur suggest_template: Banner wurde vom Nutzer verworfen. */
  dismissed: z.boolean().default(false),
});

export const playbookRunSchema = z.object({
  id: uuid,
  playbook_id: uuid,
  order_id: uuid,
  /**
   * Bewusst Rohtext statt OrderStatusEnum: Runs sind Historie und können
   * Status-Werte tragen, die es im Enum nicht mehr gibt (z.B. 'paid' aus
   * der Zeit vor Migration 0017). Das Log darf daran nicht scheitern.
   */
  trigger_status: z.string().min(1),
  status: playbookRunStatusEnum,
  results: z.array(actionResultSchema),
  executed_at: z.string().min(1),
});

// ============================================================
// Typen
// ============================================================

export type PlaybookActionType = z.infer<typeof playbookActionTypeEnum>;
export type CreateTaskAction = z.infer<typeof createTaskActionSchema>;
export type CreateExpenseAction = z.infer<typeof createExpenseActionSchema>;
export type SuggestTemplateAction = z.infer<typeof suggestTemplateActionSchema>;
export type PlaybookAction = z.infer<typeof playbookActionSchema>;
export type Playbook = z.infer<typeof playbookSchema>;
export type PlaybookListItem = z.infer<typeof playbookListItemSchema>;
/** Input-Typen: Felder mit Zod-Default dürfen beim Aufruf fehlen. */
export type PlaybookCreate = z.input<typeof playbookCreateSchema>;
export type PlaybookUpdate = z.input<typeof playbookUpdateSchema>;
export type PlaybookRunStatus = z.infer<typeof playbookRunStatusEnum>;
export type ActionResult = z.infer<typeof actionResultSchema>;
export type PlaybookRun = z.infer<typeof playbookRunSchema>;
