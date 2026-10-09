// ============================================================
// Per-account persistence for the AI assistant's knowledge base and
// treatment catalog.
//
// Both used to live only in the browser's localStorage, so the chat
// emulator (which posts them with every request) saw them while the
// WhatsApp webhook — which has no browser — silently ran without them.
// They are stored as JSON documents in `ai_knowledge_documents`, the
// same table the hospital profile already uses, keyed by a fixed title
// per account.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { defaultKnowledgeItems, type KnowledgeItem } from '@/lib/ai/assistant-defaults';
import type { Treatment } from '@/lib/hospital/treatments';

export const KNOWLEDGE_ITEMS_DOC_TITLE = 'AI Knowledge Base Items';
export const TREATMENTS_DOC_TITLE = 'Treatments Catalog';

const MAX_ITEMS = 500;
const MAX_DOC_BYTES = 2_000_000;

/**
 * Render enabled knowledge items into the prompt context — the exact
 * format the chat emulator sends, so both channels prompt identically.
 */
export function formatKnowledgeContext(items: KnowledgeItem[]): string {
  return items
    .filter((item) => item.isEnabled)
    .map((item) => `[${item.title}]: ${item.content}`)
    .join('\n\n');
}

/** Keep only well-formed items; returns null if the payload is unusable. */
export function sanitizeKnowledgeItems(value: unknown): KnowledgeItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
  const items = value.filter(
    (item): item is KnowledgeItem =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as KnowledgeItem).id === 'string' &&
      typeof (item as KnowledgeItem).title === 'string' &&
      typeof (item as KnowledgeItem).content === 'string' &&
      typeof (item as KnowledgeItem).isEnabled === 'boolean',
  );
  return items.length === value.length ? items : null;
}

/** Keep only well-formed treatments; returns null if the payload is unusable. */
export function sanitizeTreatments(value: unknown): Treatment[] | null {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
  const items = value.filter(
    (item): item is Treatment =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as Treatment).id === 'string' &&
      typeof (item as Treatment).name === 'string',
  );
  return items.length === value.length ? items : null;
}

async function readJsonDoc(
  db: SupabaseClient,
  accountId: string,
  title: string,
): Promise<unknown | null> {
  const { data, error } = await db
    .from('ai_knowledge_documents')
    .select('content')
    .eq('account_id', accountId)
    .eq('title', title)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.content) return null;
  try {
    return JSON.parse(data.content);
  } catch {
    return null;
  }
}

async function writeJsonDoc(
  db: SupabaseClient,
  accountId: string,
  title: string,
  value: unknown,
  userId?: string,
): Promise<void> {
  const content = JSON.stringify(value);
  if (content.length > MAX_DOC_BYTES) {
    throw new Error(`${title} is too large to save`);
  }

  const { data: existing, error: findErr } = await db
    .from('ai_knowledge_documents')
    .select('id')
    .eq('account_id', accountId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  const { error } = existing?.id
    ? await db.from('ai_knowledge_documents').update({ content }).eq('id', existing.id)
    : await db
        .from('ai_knowledge_documents')
        .insert({ account_id: accountId, title, content, created_by: userId ?? null });
  if (error) throw error;
}

/** Saved knowledge items for the account, or null if none were saved. */
export async function loadSavedKnowledgeItems(
  db: SupabaseClient,
  accountId: string,
): Promise<KnowledgeItem[] | null> {
  return sanitizeKnowledgeItems(await readJsonDoc(db, accountId, KNOWLEDGE_ITEMS_DOC_TITLE));
}

/** Saved knowledge items for the account, or the built-in defaults. */
export async function loadKnowledgeItems(
  db: SupabaseClient,
  accountId: string,
): Promise<KnowledgeItem[]> {
  return (await loadSavedKnowledgeItems(db, accountId)) ?? defaultKnowledgeItems;
}

export async function saveKnowledgeItems(
  db: SupabaseClient,
  accountId: string,
  items: KnowledgeItem[],
  userId?: string,
): Promise<void> {
  await writeJsonDoc(db, accountId, KNOWLEDGE_ITEMS_DOC_TITLE, items, userId);
}

/** Saved treatment catalog for the account, or null if none was saved. */
export async function loadTreatments(
  db: SupabaseClient,
  accountId: string,
): Promise<Treatment[] | null> {
  const saved = sanitizeTreatments(await readJsonDoc(db, accountId, TREATMENTS_DOC_TITLE));
  return saved && saved.length > 0 ? saved : null;
}

export async function saveTreatments(
  db: SupabaseClient,
  accountId: string,
  treatments: Treatment[],
  userId?: string,
): Promise<void> {
  await writeJsonDoc(db, accountId, TREATMENTS_DOC_TITLE, treatments, userId);
}
