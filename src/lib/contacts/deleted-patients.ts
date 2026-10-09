// ============================================================
// Client-side "deleted patient" tombstones.
//
// Deleting a patient removes their rows on the server; the browser keeps a
// list of deleted phones/ids only to hide stale cached copies. That list
// used to hide every *future* record for the phone too, so a patient who was
// deleted once (often a test number) and later booked again over WhatsApp
// never appeared in the dashboard. Each tombstone now carries the deletion
// time, and only records created at or before it are hidden.
// ============================================================

const TIMES_KEY = 'wacrm_deleted_patients_at';

export function normalizeDeletionKey(value?: string): string {
  return (value || '').toLowerCase().replace(/[\s\-()+]/g, '');
}

function readTimes(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(TIMES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTimes(times: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TIMES_KEY, JSON.stringify(times));
  } catch {}
}

/** Record that these phones / ids were deleted now. */
export function stampDeletions(keys: string[], at: number = Date.now()): void {
  const times = readTimes();
  for (const key of keys) {
    const k = normalizeDeletionKey(key);
    if (k) times[k] = at;
  }
  writeTimes(times);
}

/**
 * When the record matching `phone` / `id` was deleted, or null if it wasn't.
 * Tombstones from before timestamps existed are stamped with the current
 * time the first time they are seen, so records created after that show up.
 */
export function deletionTimeFor(deletedList: string[], phone?: string, id?: string): number | null {
  const cleanPhone = normalizeDeletionKey(phone);
  const cleanId = (id || '').toLowerCase();
  const match = deletedList.find((d) => {
    const cleanD = normalizeDeletionKey(d);
    return !!cleanD && (cleanD === cleanPhone || cleanD === cleanId);
  });
  if (!match) return null;

  const key = normalizeDeletionKey(match);
  const times = readTimes();
  if (!times[key]) {
    times[key] = Date.now();
    writeTimes(times);
  }
  return times[key];
}

/** True if the record was deleted and is not newer than the deletion. */
export function isHiddenByDeletion(
  deletedList: string[],
  phone?: string,
  id?: string,
  createdAt?: string | null,
): boolean {
  const deletedAt = deletionTimeFor(deletedList, phone, id);
  if (deletedAt === null) return false;
  if (!createdAt) return true;
  const created = Date.parse(createdAt);
  return Number.isNaN(created) || created <= deletedAt;
}
