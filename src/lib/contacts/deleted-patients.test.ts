import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHiddenByDeletion, stampDeletions } from '@/lib/contacts/deleted-patients';

describe('deleted patient tombstones', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const deletedAt = Date.parse('2026-10-08T10:00:00Z');

  it('hides records created before the patient was deleted', () => {
    stampDeletions(['+91 98100 00001'], deletedAt);
    expect(isHiddenByDeletion(['+91 98100 00001'], '919810000001', 'a1', '2026-10-08T09:00:00Z')).toBe(true);
  });

  it('shows records created after the deletion, e.g. a new WhatsApp booking', () => {
    stampDeletions(['+91 98100 00001'], deletedAt);
    expect(isHiddenByDeletion(['+91 98100 00001'], '919810000001', 'a2', '2026-10-09T09:00:00Z')).toBe(false);
  });

  it('ignores records that were never deleted, including ones without a phone', () => {
    stampDeletions(['919810000001'], deletedAt);
    expect(isHiddenByDeletion(['919810000001'], '919810000002', 'a3')).toBe(false);
    expect(isHiddenByDeletion(['919810000001'], undefined, undefined)).toBe(false);
  });

  it('keeps hiding stale copies with no creation time', () => {
    stampDeletions(['919810000001'], deletedAt);
    expect(isHiddenByDeletion(['919810000001'], '919810000001', 'a4')).toBe(true);
  });
});
