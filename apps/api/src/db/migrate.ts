import { closeDb, getDb } from './index.js';

/**
 * Applies the schema. The schema is idempotent (`CREATE TABLE IF NOT EXISTS`),
 * so this script is safe to run on every deploy.
 */
const db = getDb();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all() as Array<{ name: string }>;

console.log('Schema applied. Tables:');
for (const table of tables) console.log(`  - ${table.name}`);

closeDb();
