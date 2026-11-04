import { openDB } from 'idb';

const DB_NAME = 'paintball-buzzer';
// Only ever counts up. Lowering it makes every browser that already opened a
// higher version throw a VersionError.
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Uploaded audio files: { id, name, type, size, duration, blob, addedAt }
        if (!db.objectStoreNames.contains('sounds')) {
          db.createObjectStore('sounds', { keyPath: 'id' });
        }
        // Small key/value records: { key, value }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function listSounds() {
  const db = await getDB();
  const all = await db.getAll('sounds');
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function getSound(id) {
  const db = await getDB();
  return db.get('sounds', id);
}

export async function putSound(sound) {
  const db = await getDB();
  await db.put('sounds', sound);
}

export async function deleteSound(id) {
  const db = await getDB();
  await db.delete('sounds', id);
}

export async function getSetting(key, fallback) {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record === undefined ? fallback : record.value;
}

export async function setSetting(key, value) {
  const db = await getDB();
  await db.put('settings', { key, value });
}

/**
 * Asks the browser not to evict our data under storage pressure. Without it,
 * Chrome may drop the uploaded sounds of a rarely used site, and Safari wipes
 * script-written storage of sites not opened for seven days unless the app is
 * installed to the home screen. Granting is up to the browser.
 */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function estimateUsage() {
  if (!navigator.storage?.estimate) return null;
  return navigator.storage.estimate();
}
