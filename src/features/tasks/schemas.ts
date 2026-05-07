import { z } from 'zod';

export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
export const recurringIntervalEnum = z.enum(['daily', 'weekly', 'monthly']);

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable();
const optionalNullableUuid = uuid.nullable().optional();
const nullableText = z.string().nullable();
const optionalNullableText = z.string().nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss YYYY-MM-DD sein');

export const recurringRuleSchema = z
  .object({
    interval: recurringIntervalEnum,
    day: z.number().int().min(0).max(31).optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.interval === 'weekly' && rule.day !== undefined && rule.day > 6) {
      ctx.addIssue({
        code: 'custom',
        path: ['day'],
        message: 'Wöchentliche Wiederholung erwartet Wochentag 0-6.',
      });
    }

    if (rule.interval === 'monthly' && rule.day !== undefined && rule.day < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['day'],
        message: 'Monatliche Wiederholung erwartet Monatstag 1-31.',
      });
    }
  });

export const taskSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(200),
  description: nullableText,
  priority: taskPriorityEnum,
  status: taskStatusEnum,
  due_date: isoDate.nullable(),
  product_id: nullableUuid,
  order_id: nullableUuid,
  listing_id: nullableUuid,
  recurring_rule: recurringRuleSchema.nullable(),
  parent_task_id: nullableUuid,
  completed_at: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  deleted_at: z.string().nullable(),
});

export const taskCreateSchema = taskSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
    completed_at: true,
  })
  .extend({
    description: optionalNullableText,
    due_date: isoDate.nullable().optional(),
    product_id: optionalNullableUuid,
    order_id: optionalNullableUuid,
    listing_id: optionalNullableUuid,
    recurring_rule: recurringRuleSchema.nullable().optional(),
    parent_task_id: optionalNullableUuid,
  });

export const taskUpdateSchema = taskCreateSchema.partial();

export const taskFilterSchema = z.object({
  status: z.array(taskStatusEnum).optional(),
  priority: z.array(taskPriorityEnum).optional(),
  dueDateFrom: isoDate.optional(),
  dueDateTo: isoDate.optional(),
  product_id: uuid.optional(),
  order_id: uuid.optional(),
  listing_id: uuid.optional(),
  parent_task_id: uuid.optional(),
  includeDone: z.boolean().optional(),
  includeDeleted: z.boolean().optional(),
  recurringOnly: z.boolean().optional(),
});

export type TaskPriority = z.infer<typeof taskPriorityEnum>;
export type TaskStatus = z.infer<typeof taskStatusEnum>;
export type RecurringInterval = z.infer<typeof recurringIntervalEnum>;
export type RecurringRule = z.infer<typeof recurringRuleSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type TaskFilter = z.infer<typeof taskFilterSchema>;
