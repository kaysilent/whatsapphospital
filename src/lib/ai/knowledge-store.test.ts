import { describe, expect, it } from 'vitest';

import type { KnowledgeItem } from '@/lib/ai/assistant-defaults';
import {
  formatKnowledgeContext,
  sanitizeKnowledgeItems,
  sanitizeTreatments,
} from '@/lib/ai/knowledge-store';

const item = (overrides: Partial<KnowledgeItem>): KnowledgeItem => ({
  id: 'kb-1',
  title: 'Pricing',
  type: 'text',
  content: 'Hydrafacial is 4000',
  tags: [],
  isEnabled: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  characterCount: 19,
  ...overrides,
});

describe('formatKnowledgeContext', () => {
  it('renders enabled items in the same format the chat emulator sends', () => {
    const ctx = formatKnowledgeContext([
      item({}),
      item({ id: 'kb-2', title: 'Hidden', content: 'secret', isEnabled: false }),
      item({ id: 'kb-3', title: 'Timings', content: 'Mon-Sat 10-7' }),
    ]);
    expect(ctx).toBe('[Pricing]: Hydrafacial is 4000\n\n[Timings]: Mon-Sat 10-7');
  });
});

describe('sanitizeKnowledgeItems', () => {
  it('accepts well-formed items', () => {
    expect(sanitizeKnowledgeItems([item({})])).toHaveLength(1);
  });

  it('rejects non-arrays and malformed entries', () => {
    expect(sanitizeKnowledgeItems({ items: [] })).toBeNull();
    expect(sanitizeKnowledgeItems([item({}), { title: 'no id' }])).toBeNull();
  });
});

describe('sanitizeTreatments', () => {
  it('requires id and name on every treatment', () => {
    expect(sanitizeTreatments([{ id: 't1', name: 'Peel' }])).toHaveLength(1);
    expect(sanitizeTreatments([{ id: 't1' }])).toBeNull();
  });
});
