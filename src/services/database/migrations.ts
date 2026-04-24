/**
 * Migration-Registry: Importiert alle SQL-Dateien aus drizzle/ als Strings.
 * Bei neuen Migrations: Import hinzufügen und in MIGRATIONS-Array eintragen.
 */
import migration0000 from '../../../drizzle/0000_mighty_solo.sql?raw';
import migration0001 from '../../../drizzle/0001_blue_gargoyle.sql?raw';
import migration0002 from '../../../drizzle/0002_absent_makkari.sql?raw';
import migration0003 from '../../../drizzle/0003_parallel_menace.sql?raw';

export interface Migration {
  tag: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  { tag: '0000_mighty_solo', sql: migration0000 },
  { tag: '0001_blue_gargoyle', sql: migration0001 },
  { tag: '0002_absent_makkari', sql: migration0002 },
  { tag: '0003_parallel_menace', sql: migration0003 },
];
