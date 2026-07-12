/**
 * Migration-Registry: Importiert alle SQL-Dateien aus drizzle/ als Strings.
 * Bei neuen Migrations: Import hinzufügen und in MIGRATIONS-Array eintragen.
 */
import migration0000 from '../../../drizzle/0000_mighty_solo.sql?raw';
import migration0001 from '../../../drizzle/0001_blue_gargoyle.sql?raw';
import migration0002 from '../../../drizzle/0002_absent_makkari.sql?raw';
import migration0003 from '../../../drizzle/0003_parallel_menace.sql?raw';
import migration0004 from '../../../drizzle/0004_little_princess_powerful.sql?raw';
import migration0005 from '../../../drizzle/0005_brown_amazoness.sql?raw';
import migration0006 from '../../../drizzle/0006_familiar_wallflower.sql?raw';
import migration0007 from '../../../drizzle/0007_listings_data_model_custom.sql?raw';
import migration0008 from '../../../drizzle/0008_modul_08_orders_finance.sql?raw';
import migration0009 from '../../../drizzle/0009_modul_08_order_events.sql?raw';
import migration0010 from '../../../drizzle/0010_fix_expense_receipt_attached.sql?raw';
import migration0011 from '../../../drizzle/0011_modul_09_tasks_soft_delete_recurring.sql?raw';
import migration0012 from '../../../drizzle/0012_modul_10_kpi_records.sql?raw';
import migration0013 from '../../../drizzle/0013_modul_13_playbooks.sql?raw';
import migration0014 from '../../../drizzle/0014_modul_16_website_crm.sql?raw';
import migration0015 from '../../../drizzle/0015_modul_17_documents.sql?raw';
import migration0016 from '../../../drizzle/0016_modul_17_addendum_content_blocks.sql?raw';
import migration0017 from '../../../drizzle/0017_modul_08_status_trennung.sql?raw';
import migration0018 from '../../../drizzle/0018_fix_playbook_trigger_paid.sql?raw';

export interface Migration {
  tag: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  { tag: '0000_mighty_solo', sql: migration0000 },
  { tag: '0001_blue_gargoyle', sql: migration0001 },
  { tag: '0002_absent_makkari', sql: migration0002 },
  { tag: '0003_parallel_menace', sql: migration0003 },
  { tag: '0004_little_princess_powerful', sql: migration0004 },
  { tag: '0005_brown_amazoness', sql: migration0005 },
  { tag: '0006_familiar_wallflower', sql: migration0006 },
  { tag: '0007_listings_data_model_custom', sql: migration0007 },
  { tag: '0008_modul_08_orders_finance', sql: migration0008 },
  { tag: '0009_modul_08_order_events', sql: migration0009 },
  { tag: '0010_fix_expense_receipt_attached', sql: migration0010 },
  { tag: '0011_modul_09_tasks_soft_delete_recurring', sql: migration0011 },
  { tag: '0012_modul_10_kpi_records', sql: migration0012 },
  { tag: '0013_modul_13_playbooks', sql: migration0013 },
  { tag: '0014_modul_16_website_crm', sql: migration0014 },
  { tag: '0015_modul_17_documents', sql: migration0015 },
  { tag: '0016_modul_17_addendum_content_blocks', sql: migration0016 },
  { tag: '0017_modul_08_status_trennung', sql: migration0017 },
  { tag: '0018_fix_playbook_trigger_paid', sql: migration0018 },
];
