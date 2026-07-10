/**
 * Website-CRM (Modul 16): Zod-Schemas als Single Source of Truth für
 * Kunden, Website-Projekte und laufende Posten (Hosting, Domain, Wartung).
 *
 * Zugangsdaten: In der DB liegen NUR Metadaten ({ id, label, username, url }).
 * Das Secret selbst wird über die Keychain-Infrastruktur gespeichert
 * (Account-Key polygrid_credential_{id}) und taucht in keinem Schema auf.
 */
import { z } from 'zod';

export const WebsiteProjectStatusEnum = z.enum([
  'inquiry',
  'quoted',
  'in_progress',
  'review',
  'live',
  'archived',
]);

export const WebsiteServiceTypeEnum = z.enum(['hosting', 'domain', 'wartung', 'sonstiges']);
export const WebsiteServiceIntervalEnum = z.enum(['monthly', 'yearly']);

const uuid = z.string().uuid();
const nullableText = z.string().trim().nullable();
const optionalNullableText = z.string().trim().nullable().optional();
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Datum muss im ISO-Format sein');
const positiveAmount = z.number().positive();

/** Zugangsdaten-Metadaten – bewusst OHNE Secret-Feld. */
export const CredentialMetaSchema = z.object({
  id: uuid,
  label: z.string().trim().min(1, 'Bezeichnung ist erforderlich'),
  username: nullableText,
  url: nullableText,
});

const credentialsList = z.array(CredentialMetaSchema);

// ------------------------------------------------------------
// clients
// ------------------------------------------------------------
export const ClientSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1, 'Name ist erforderlich').max(200),
  contact_person: nullableText,
  email: nullableText,
  phone: nullableText,
  // Rechnungsanschrift (Modul 17, E17-02): mehrzeiliger Freitext,
  // Pflicht nur beim Ausstellen von Rechnungen an diesen Kunden.
  address: nullableText,
  credentials: credentialsList,
  notes: nullableText,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  deleted_at: z.string().nullable(),
});

export const NewClientSchema = z.object({
  name: z.string().trim().min(1, 'Name ist erforderlich').max(200),
  contact_person: optionalNullableText,
  email: optionalNullableText,
  phone: optionalNullableText,
  address: optionalNullableText,
  notes: optionalNullableText,
});

export const UpdateClientSchema = NewClientSchema.partial().extend({
  credentials: credentialsList.optional(),
});

// ------------------------------------------------------------
// website_projects
// ------------------------------------------------------------
export const WebsiteProjectSchema = z.object({
  id: uuid,
  client_id: uuid,
  name: z.string().trim().min(1, 'Name ist erforderlich').max(200),
  status: WebsiteProjectStatusEnum,
  price: positiveAmount.nullable(),
  deadline: isoDateString.nullable(),
  url: nullableText,
  order_id: uuid.nullable(),
  credentials: credentialsList,
  notes: nullableText,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  deleted_at: z.string().nullable(),
});

export const NewWebsiteProjectSchema = z.object({
  client_id: uuid,
  name: z.string().trim().min(1, 'Name ist erforderlich').max(200),
  status: WebsiteProjectStatusEnum.optional(),
  price: positiveAmount.nullable().optional(),
  deadline: isoDateString.nullable().optional(),
  url: optionalNullableText,
  notes: optionalNullableText,
});

export const UpdateWebsiteProjectSchema = NewWebsiteProjectSchema.partial().extend({
  order_id: uuid.nullable().optional(),
  credentials: credentialsList.optional(),
});

// ------------------------------------------------------------
// website_services (laufende Posten)
// ------------------------------------------------------------

/** Mindestens eines von cost_out und price_in muss gesetzt sein (Spec 2.3). */
function hasCostOrPrice(data: { cost_out?: number | null; price_in?: number | null }): boolean {
  return (data.cost_out ?? null) !== null || (data.price_in ?? null) !== null;
}

const COST_OR_PRICE_MESSAGE = 'Mindestens Kosten oder Einnahme muss gesetzt sein';

export const WebsiteServiceSchema = z
  .object({
    id: uuid,
    client_id: uuid,
    project_id: uuid.nullable(),
    type: WebsiteServiceTypeEnum,
    label: z.string().trim().min(1, 'Bezeichnung ist erforderlich').max(200),
    cost_out: positiveAmount.nullable(),
    cost_out_vendor: nullableText,
    price_in: positiveAmount.nullable(),
    interval: WebsiteServiceIntervalEnum,
    next_due: isoDateString,
    expires_at: isoDateString.nullable(),
    active: z.boolean(),
    last_generated_until: isoDateString.nullable(),
    notes: nullableText,
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    deleted_at: z.string().nullable(),
  })
  .refine(hasCostOrPrice, { message: COST_OR_PRICE_MESSAGE, path: ['cost_out'] });

export const NewWebsiteServiceSchema = z
  .object({
    client_id: uuid,
    project_id: uuid.nullable().optional(),
    type: WebsiteServiceTypeEnum,
    label: z.string().trim().min(1, 'Bezeichnung ist erforderlich').max(200),
    cost_out: positiveAmount.nullable().optional(),
    cost_out_vendor: optionalNullableText,
    price_in: positiveAmount.nullable().optional(),
    interval: WebsiteServiceIntervalEnum,
    next_due: isoDateString,
    expires_at: isoDateString.nullable().optional(),
    active: z.boolean().optional(),
    notes: optionalNullableText,
  })
  .refine(hasCostOrPrice, { message: COST_OR_PRICE_MESSAGE, path: ['cost_out'] });

/**
 * Update ohne Refinement auf Feldebene: Ob nach dem Update noch Kosten ODER
 * Einnahme gesetzt sind, prüft der Service gegen den gemergten Datensatz.
 */
export const UpdateWebsiteServiceSchema = z.object({
  client_id: uuid.optional(),
  project_id: uuid.nullable().optional(),
  type: WebsiteServiceTypeEnum.optional(),
  label: z.string().trim().min(1, 'Bezeichnung ist erforderlich').max(200).optional(),
  cost_out: positiveAmount.nullable().optional(),
  cost_out_vendor: optionalNullableText,
  price_in: positiveAmount.nullable().optional(),
  interval: WebsiteServiceIntervalEnum.optional(),
  next_due: isoDateString.optional(),
  expires_at: isoDateString.nullable().optional(),
  active: z.boolean().optional(),
  last_generated_until: isoDateString.nullable().optional(),
  notes: optionalNullableText,
});

// ------------------------------------------------------------
// Typen
// ------------------------------------------------------------
export type WebsiteProjectStatus = z.infer<typeof WebsiteProjectStatusEnum>;
export type WebsiteServiceType = z.infer<typeof WebsiteServiceTypeEnum>;
export type WebsiteServiceInterval = z.infer<typeof WebsiteServiceIntervalEnum>;
export type CredentialMeta = z.infer<typeof CredentialMetaSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type NewClientInput = z.infer<typeof NewClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
export type WebsiteProject = z.infer<typeof WebsiteProjectSchema>;
export type NewWebsiteProjectInput = z.infer<typeof NewWebsiteProjectSchema>;
export type UpdateWebsiteProjectInput = z.infer<typeof UpdateWebsiteProjectSchema>;
export type WebsiteService = z.infer<typeof WebsiteServiceSchema>;
export type NewWebsiteServiceInput = z.infer<typeof NewWebsiteServiceSchema>;
export type UpdateWebsiteServiceInput = z.infer<typeof UpdateWebsiteServiceSchema>;

/** Listen-Item mit aufgelösten Namen für die Tabellen der Websites-Seite. */
export interface ClientListItem extends Client {
  project_count: number;
  service_count: number;
}

export interface WebsiteProjectListItem extends WebsiteProject {
  client_name: string;
}

export interface WebsiteServiceListItem extends WebsiteService {
  client_name: string;
  project_name: string | null;
}

// ------------------------------------------------------------
// Labels (UI + Engine)
// ------------------------------------------------------------
export const WEBSITE_PROJECT_STATUS_LABELS: Record<WebsiteProjectStatus, string> = {
  inquiry: 'Anfrage',
  quoted: 'Angebot',
  in_progress: 'In Arbeit',
  review: 'Abnahme',
  live: 'Live',
  archived: 'Archiviert',
};

export const WEBSITE_SERVICE_TYPE_LABELS: Record<WebsiteServiceType, string> = {
  hosting: 'Hosting',
  domain: 'Domain',
  wartung: 'Wartung',
  sonstiges: 'Sonstiges',
};

export const WEBSITE_SERVICE_INTERVAL_LABELS: Record<WebsiteServiceInterval, string> = {
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};
