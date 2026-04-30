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
];
