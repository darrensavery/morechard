// Encrypted, per-device vault for child bank/payout details (sort code,
// account number, Zelle handle). This is Spec B — the previously-documented
// replacement for the plaintext-in-sessionStorage version.
//
// Design:
//   - Each family gets a non-extractable AES-GCM CryptoKey, generated once
//     and stored directly in IndexedDB (CryptoKey objects support the
//     structured-clone algorithm, so this works natively — no key material
//     is ever exported to a string or byte array). This protects the raw
//     key against disk/backup extraction; it does NOT protect against
//     same-origin XSS actively driving the Web Crypto API, which no
//     client-side scheme can — decryption has to happen in-page for the
//     app to function. The real gain over the old version is at-rest
//     protection, not XSS immunity.
//   - Per-family entries are encrypted as one JSON blob (AES-GCM, random
//     96-bit IV per write) and stored in IndexedDB alongside a "session
//     marker" copied from sessionStorage.
//   - The original version deliberately used sessionStorage so data never
//     survived a closed tab. IndexedDB persists across sessions by
//     default, so to preserve that same "gone when the tab closes"
//     property, every read compares the stored session marker against a
//     fresh one in sessionStorage: a mismatch means this is a new tab
//     session (the old sessionStorage entry is gone), so the vault entry
//     is treated as stale and wiped rather than decrypted.
//
// Function NAMES (getDetails / setDetails / clearDetails) are preserved
// from the previous version, per the original migration note — only the
// signatures changed (now async).

export type StoredBankDetails = {
  childId: string;
  sortCode?: string;       // UK, 6 digits, no hyphens
  accountNumber?: string;  // UK, 8 digits
  zelleHandle?: string;    // US, email or phone
  updatedAt: number;       // Unix ms
};

type Store = Record<string, StoredBankDetails>; // keyed by childId

type VaultRecord = {
  sessionMarker: string;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
};

const DB_NAME = 'morechard-bank-vault';
const DB_VERSION = 1;
const KEY_STORE = 'keys';
const DATA_STORE = 'entries';
const SESSION_MARKER_KEY = 'morechard.bankvault.session';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, value: unknown, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// One-time cleanup of the old plaintext sessionStorage scheme this replaces
// (`morechard.bankdetails.v1.<familyId>`) — defense in depth so no
// unencrypted bank details linger even transiently after this upgrade.
(function purgeLegacyPlaintextEntries() {
  try {
    const stale: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('morechard.bankdetails.v1.')) stale.push(k);
    }
    stale.forEach(k => sessionStorage.removeItem(k));
  } catch { /* sessionStorage unavailable (SSR/tests without DOM) — nothing to purge */ }
})();

function currentSessionMarker(): string {
  let marker = sessionStorage.getItem(SESSION_MARKER_KEY);
  if (!marker) {
    marker = crypto.randomUUID();
    sessionStorage.setItem(SESSION_MARKER_KEY, marker);
  }
  return marker;
}

async function getOrCreateKey(db: IDBDatabase, familyId: string): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(db, KEY_STORE, familyId);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await idbPut(db, KEY_STORE, key, familyId);
  return key;
}

async function readStore(familyId: string): Promise<Store> {
  const db = await openDb();
  try {
    const record = await idbGet<VaultRecord>(db, DATA_STORE, familyId);
    if (!record) return {};

    if (record.sessionMarker !== currentSessionMarker()) {
      // Stale from a previous tab session — wipe rather than decrypt.
      await idbDelete(db, DATA_STORE, familyId);
      await idbDelete(db, KEY_STORE, familyId);
      return {};
    }

    try {
      const key = await getOrCreateKey(db, familyId);
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv as BufferSource }, key, record.ciphertext);
      return JSON.parse(new TextDecoder().decode(plainBuf)) as Store;
    } catch {
      return {};
    }
  } finally {
    db.close();
  }
}

async function writeStore(familyId: string, store: Store): Promise<void> {
  const db = await openDb();
  try {
    const key = await getOrCreateKey(db, familyId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plainBuf = new TextEncoder().encode(JSON.stringify(store));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBuf);
    const record: VaultRecord = { sessionMarker: currentSessionMarker(), iv, ciphertext };
    await idbPut(db, DATA_STORE, record, familyId);
  } finally {
    db.close();
  }
}

export async function getDetails(
  familyId: string,
  childId: string,
): Promise<StoredBankDetails | null> {
  const store = await readStore(familyId);
  return store[childId] ?? null;
}

export async function setDetails(
  familyId: string,
  childId: string,
  details: StoredBankDetails,
): Promise<void> {
  const store = await readStore(familyId);
  store[childId] = { ...details, childId, updatedAt: Date.now() };
  await writeStore(familyId, store);
}

export async function clearDetails(familyId: string, childId: string): Promise<void> {
  const store = await readStore(familyId);
  delete store[childId];
  await writeStore(familyId, store);
}
