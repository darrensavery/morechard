// Temporary per-session storage of child bank details.
// Uses sessionStorage so sensitive data (sort code, account number) is not
// persisted to disk between app sessions. KNOWN TEMPORARY: Spec B replaces
// this with an encrypted IndexedDB vault.
// Function NAMES (getDetails / setDetails / clearDetails) and the
// StoredBankDetails shape are preserved. Signatures will become async
// (Promise-returning) in Spec B, so call sites will need `await` added
// when the swap happens — plan to grep for these three names.

export type StoredBankDetails = {
  childId: string;
  sortCode?: string;       // UK, 6 digits, no hyphens
  accountNumber?: string;  // UK, 8 digits
  zelleHandle?: string;    // US, email or phone
  updatedAt: number;       // Unix ms
};

type Store = Record<string, StoredBankDetails>; // keyed by childId

function storageKey(familyId: string): string {
  return `morechard.bankdetails.v1.${familyId}`;
}

function readStore(familyId: string): Store {
  try {
    const raw = sessionStorage.getItem(storageKey(familyId));
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(familyId: string, store: Store): void {
  sessionStorage.setItem(storageKey(familyId), JSON.stringify(store));
}

export function getDetails(
  familyId: string,
  childId: string,
): StoredBankDetails | null {
  const store = readStore(familyId);
  return store[childId] ?? null;
}

export function setDetails(
  familyId: string,
  childId: string,
  details: StoredBankDetails,
): void {
  const store = readStore(familyId);
  store[childId] = { ...details, childId, updatedAt: Date.now() };
  writeStore(familyId, store);
}

export function clearDetails(familyId: string, childId: string): void {
  const store = readStore(familyId);
  delete store[childId];
  writeStore(familyId, store);
}
