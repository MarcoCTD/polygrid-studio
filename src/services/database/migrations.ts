/**
 * Migration-Registry: Importiert alle SQL-Dateien aus drizzle/ als Strings.
 * Bei neuen Migrations: Import hinzufügen und in MIGRATIONS-Array eintragen.
 */
import migration0000 from "../../../drizzle/0000_mighty_solo.sql?raw";

export interface Migration {
  tag: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  { tag: "0000_mighty_solo", sql: migration0000 },
];
