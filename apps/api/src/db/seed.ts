import { CURRICULUM } from '@sparkle/shared';
import { closeDb, getDb } from './index.js';
import { generateDeviceToken, hashPin, newId } from '../lib/ids.js';

/**
 * Seeds a demo profile so the app can be explored immediately.
 *
 * Everything is deterministic and local. The seeded device token is printed
 * to stdout because the demo client needs it; a production deployment would
 * never do this.
 */
const db = getDb();

const existing = db.prepare('SELECT COUNT(*) AS c FROM children').get() as { c: number };
if (existing.c > 0) {
  console.log(`Database already has ${existing.c} profile(s). Nothing seeded.`);
  closeDb();
  process.exit(0);
}

const id = newId('child_');
const deviceToken = generateDeviceToken();
const deviceSalt = newId('salt_');
const pin = '1234';
const pinSalt = newId('salt_');
const createdAt = new Date().toISOString();
const firstLevel = CURRICULUM.levels[0]?.id ?? 'level-1';

const tx = db.transaction(() => {
  db.prepare(
    `INSERT INTO children
     (id, nickname, avatar_id, age_band, created_at, current_level_id, device_token_hash, device_token_salt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    'Demo',
    'fox',
    '3-4',
    createdAt,
    firstLevel,
    hashPin(deviceToken, deviceSalt),
    deviceSalt,
  );
  db.prepare(
    `INSERT INTO caregiver_pin (child_id, pin_hash, pin_salt, updated_at) VALUES (?, ?, ?, ?)`,
  ).run(id, hashPin(pin, pinSalt), pinSalt, createdAt);
});
tx();

console.log('Seeded demo profile');
console.log(`  child id    : ${id}`);
console.log(`  device token: ${deviceToken}`);
console.log(`  caregiver PIN: ${pin}`);
console.log('  nickname   : Demo');
closeDb();
