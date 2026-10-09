'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Contact, MessageTemplate } from '@/types';
import { filterActivePatients, getUnifiedPatientList, getPhoneKey } from '@/lib/contacts/patient-filter';

export type CustomFieldOperator = 'is' | 'is_not' | 'contains';

export interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

export interface AudienceConfig {
  type: 'all' | 'tags' | 'custom_field' | 'csv';
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  /** Contacts carrying any of these tags are subtracted from the result. */
  excludeTagIds?: string[];
  selectedContactPhones?: string[];
}

/**
 * Variable mapping — each template placeholder (by key, usually "1",
 * "2", …) is resolved at send time. `field` maps to a built-in contact
 * field (name/phone/email/company); `custom_field` maps to a
 * contact_custom_values.value row keyed by the custom_fields.id stored
 * in `value`.
 */
export type VariableMapping =
  | { type: 'static'; value: string }
  | { type: 'field'; value: string }
  | { type: 'custom_field'; value: string };

interface BroadcastPayload {
  name: string;
  template: MessageTemplate;
  audience: AudienceConfig;
  variables: Record<string, VariableMapping>;
  /**
   * Media URL for an IMAGE/VIDEO/DOCUMENT header. Required at send
   * time for media-header templates — Meta rejects the send without
   * it. Passed through as `messageParams.headerMediaUrl`; the builder
   * falls back to the template's stored URL only when this is empty.
   */
  headerMediaUrl?: string;
}

interface UseBroadcastSendingReturn {
  createAndSendBroadcast: (payload: BroadcastPayload) => Promise<string>;
  isProcessing: boolean;
  progress: number;
}

/**
 * Meta rate-limit buffer. 10 per batch + 1 s pause matches the spec
 * and keeps us comfortably under Meta's per-phone-number messaging
 * rate so a large broadcast never trips the upstream limiter.
 */
const SEND_BATCH_SIZE = 10;
const SEND_BATCH_DELAY_MS = 1000;

/** `broadcast_recipients` inserts are independent of the send rate. */
const INSERT_BATCH_SIZE = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BroadcastApiResult {
  phone: string;
  status: 'sent' | 'failed';
  whatsapp_message_id?: string;
  error?: string;
}

/** contactId → (customFieldId → value). */
type CustomValueIndex = Map<string, Map<string, string>>;

/**
 * Per-contact resolution of custom-field placeholders. Static and
 * built-in-field mappings resolve synchronously; custom fields read
 * from a pre-built index to avoid N+1 queries during the send loop.
 */
export function resolveVariables(
  variables: Record<string, VariableMapping>,
  contact: Contact,
  customValues?: Map<string, string>,
): string[] {
  // Keys are typically "1","2",... — numeric-aware sort keeps
  // {{1}} before {{10}}.
  const keys = Object.keys(variables).sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.localeCompare(b);
  });

  return keys.map((key) => {
    const v = variables[key];
    if (v.type === 'static') return v.value;

    if (v.type === 'field') {
      const fieldMap: Record<string, string | undefined> = {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        company: contact.company,
      };
      return fieldMap[v.value] ?? '';
    }

    // custom_field
    return customValues?.get(v.value) ?? '';
  });
}

/**
 * Bulk-fetch contact_custom_values for a set of contacts. Returns an
 * index keyed by contact_id → field_id → value.
 */
async function fetchCustomValueIndex(
  supabase: ReturnType<typeof createClient>,
  contactIds: string[],
): Promise<CustomValueIndex> {
  const index: CustomValueIndex = new Map();
  if (contactIds.length === 0) return index;

  // Supabase PostgREST caps the .in(...) IN-clause roughly at 1000
  // values. Page through to stay safe.
  const PAGE = 500;
  for (let i = 0; i < contactIds.length; i += PAGE) {
    const slice = contactIds.slice(i, i + PAGE);
    const { data } = await supabase
      .from('contact_custom_values')
      .select('contact_id, custom_field_id, value')
      .in('contact_id', slice);

    for (const row of data ?? []) {
      const bucket = index.get(row.contact_id) ?? new Map<string, string>();
      bucket.set(row.custom_field_id, row.value ?? '');
      index.set(row.contact_id, bucket);
    }
  }
  return index;
}

export function useBroadcastSending(): UseBroadcastSendingReturn {
  const { accountId: authAccountId, user: authUser } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const getAuthContext = async (supabase: ReturnType<typeof createClient>) => {
    let user = authUser;
    let accountId = authAccountId;

    if (!user) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        user = session?.user ?? null;
      } catch {}
    }

    if (!user && typeof window !== 'undefined') {
      const rawDemo = localStorage.getItem('wacrm_demo_user');
      if (rawDemo) {
        try {
          user = JSON.parse(rawDemo);
        } catch {}
      }
    }

    const effectiveUserId = user?.id || '7177280f-a0ad-4958-8588-5f80a8575007';
    const effectiveAccountId = accountId || '56702d02-aecf-489a-a9cf-632b068f3d29';

    if (typeof document !== 'undefined' && !document.cookie.includes('wacrm_demo_session=1')) {
      document.cookie = 'wacrm_demo_session=1; path=/; max-age=604800; SameSite=Lax';
    }

    return {
      user: { id: effectiveUserId, ...(user || {}) } as any,
      accountId: effectiveAccountId,
    };
  };

  async function resolveAudience(audience: AudienceConfig): Promise<Contact[]> {
    const supabase = createClient();
    const { accountId } = await getAuthContext(supabase);

    let contacts: Contact[] = [];

    if (audience.type === 'all' || audience.type === 'custom_field') {
      // Unified registered patient resolver
      const unifiedPatients = await getUnifiedPatientList();
      const unified = unifiedPatients.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        department: p.department,
        doctor: p.doctor,
        status: p.status,
        category: p.category,
        account_id: accountId || '',
        user_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (audience.type === 'all') {
        if (audience.selectedContactPhones !== undefined) {
          const selectedSet = new Set(
            audience.selectedContactPhones.map((p) => getPhoneKey(p)),
          );
          contacts = unified.filter((c) =>
            selectedSet.has(getPhoneKey(c.phone)),
          ) as unknown as Contact[];
        } else {
          contacts = unified as unknown as Contact[];
        }
      } else if (audience.type === 'custom_field' && audience.customField) {
        const { fieldId, operator, value } = audience.customField;
        const targetVal = value.trim().toLowerCase();

        contacts = unified.filter((c: any) => {
          let fieldVal = '';
          if (fieldId === 'builtin_department') fieldVal = (c.department || '').toLowerCase();
          else if (fieldId === 'builtin_category') fieldVal = (c.category || '').toLowerCase();
          else if (fieldId === 'builtin_doctor') fieldVal = (c.doctor || 'Dr. Mrinalini').toLowerCase();
          else if (fieldId === 'builtin_status') fieldVal = (c.status || 'Confirmed').toLowerCase();
          else fieldVal = (c[fieldId] || '').toLowerCase();

          if (operator === 'is') return fieldVal === targetVal;
          if (operator === 'is_not') return fieldVal !== targetVal;
          return fieldVal.includes(targetVal);
        }) as unknown as Contact[];
      }
    } else if (
      audience.type === 'tags' &&
      audience.tagIds &&
      audience.tagIds.length > 0
    ) {
      const { data: contactTags, error: tagError } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', audience.tagIds);

      if (tagError)
        throw new Error(`Failed to fetch contact tags: ${tagError.message}`);

      if (contactTags && contactTags.length > 0) {
        const uniqueContactIds = [
          ...new Set(contactTags.map((ct) => ct.contact_id)),
        ];
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .in('id', uniqueContactIds);
        if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
        contacts = data ?? [];
      }
    } else if (audience.type === 'csv' && audience.csvContacts) {
      contacts = await upsertCsvContacts(supabase, audience.csvContacts);
    }

    // Apply exclude tags
    if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
      const { data: excludeRows } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', audience.excludeTagIds);
      const excludedIds = new Set((excludeRows ?? []).map((r) => r.contact_id));
      contacts = contacts.filter((c) => !excludedIds.has(c.id));
    }

    return contacts;
  }

  /**
   * CSV uploads arrive as raw phone/name pairs, not DB rows.
   */
  async function upsertCsvContacts(
    supabase: ReturnType<typeof createClient>,
    csvRows: { phone: string; name?: string }[],
  ): Promise<Contact[]> {
    if (csvRows.length === 0) return [];

    const { user, accountId } = await getAuthContext(supabase);

    // De-duplicate by phone within the CSV (users can paste duplicates).
    const uniqueByPhone = new Map<string, { phone: string; name?: string }>();
    for (const row of csvRows) {
      if (row.phone) uniqueByPhone.set(row.phone, row);
    }
    const phones = [...uniqueByPhone.keys()];

    // Lookup existing contacts by phone
    try {
      const { data: existing } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .in('phone', phones);

      const byPhone = new Map<string, Contact>();
      for (const c of (existing ?? []) as Contact[]) {
        if (c.phone) byPhone.set(c.phone, c);
      }

      const missing = phones
        .filter((p) => !byPhone.has(p))
        .map((phone) => ({
          user_id: user.id,
          account_id: accountId,
          phone,
          name: uniqueByPhone.get(phone)?.name ?? null,
        }));

      const INSERT_CHUNK = 200;
      for (let i = 0; i < missing.length; i += INSERT_CHUNK) {
        const chunk = missing.slice(i, i + INSERT_CHUNK);
        const { data: inserted } = await supabase
          .from('contacts')
          .insert(chunk)
          .select();
        for (const c of (inserted ?? []) as Contact[]) {
          if (c.phone) byPhone.set(c.phone, c);
        }
      }

      return phones
        .map((p) => byPhone.get(p))
        .filter((c): c is Contact => Boolean(c));
    } catch {
      return phones.map((phone) => ({
        id: crypto.randomUUID(),
        phone,
        name: uniqueByPhone.get(phone)?.name ?? 'Patient',
        account_id: accountId,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) as Contact[];
    }
  }

  async function createAndSendBroadcast(payload: BroadcastPayload): Promise<string> {
    setIsProcessing(true);
    setProgress(0);

    const supabase = createClient();

    try {
      // ── Step 0: Resolve current user & account ─────────────────────
      const { user, accountId } = await getAuthContext(supabase);

      // ── Step 1: Resolve audience contacts ─────────────────────────
      setProgress(5);
      const contacts = await resolveAudience(payload.audience);

      if (contacts.length === 0) {
        throw new Error('No contacts found for this audience.');
      }

      // ── Step 2: Create broadcast row ──────────────────────────────
      setProgress(10);
      let broadcastId = crypto.randomUUID();
      try {
        const { data: broadcast } = await supabase
          .from('broadcasts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            name: payload.name,
            template_name: payload.template.name,
            template_language: payload.template.language ?? 'en_US',
            template_variables: payload.variables,
            audience_filter: {
              type: payload.audience.type,
              tagIds: payload.audience.tagIds,
              customField: payload.audience.customField,
              excludeTagIds: payload.audience.excludeTagIds,
            },
            status: 'sending',
            total_recipients: contacts.length,
            sent_count: 0,
            delivered_count: 0,
            read_count: 0,
            replied_count: 0,
            failed_count: 0,
          })
          .select()
          .maybeSingle();

        if (broadcast?.id) {
          broadcastId = broadcast.id;
        }
      } catch (dbErr) {
        console.warn('[Broadcast DB Insert Warning]:', dbErr);
      }

      // ── Step 3: Insert recipient rows ─────────────────────────────
      setProgress(20);
      try {
        const recipientRows = contacts.map((contact) => ({
          broadcast_id: broadcastId,
          contact_id: contact.id,
          status: 'pending' as const,
        }));

        for (let i = 0; i < recipientRows.length; i += INSERT_BATCH_SIZE) {
          const batch = recipientRows.slice(i, i + INSERT_BATCH_SIZE);
          await supabase.from('broadcast_recipients').insert(batch);
        }
      } catch (recErr) {
        console.warn('[Broadcast Recipients DB Warning]:', recErr);
      }

      // ── Step 4: Preload custom values & execute send loop ───────────
      setProgress(30);
      const contactIds = contacts.map((c) => c.id).filter(Boolean);
      let customValueIndex = new Map();
      try {
        customValueIndex = await fetchCustomValueIndex(supabase, contactIds);
      } catch {}

      let failedCount = 0;
      const totalRecipients = contacts.length;

      const headerType = payload.template.header_type;
      const isMediaHeader =
        headerType === 'image' ||
        headerType === 'video' ||
        headerType === 'document';
      const headerMediaUrl = payload.headerMediaUrl?.trim();
      const messageParams =
        isMediaHeader && headerMediaUrl ? { headerMediaUrl } : undefined;

      for (let i = 0; i < contacts.length; i += SEND_BATCH_SIZE) {
        const batch = contacts.slice(i, i + SEND_BATCH_SIZE);

        const apiRecipients = batch
          .filter((contact) => contact.phone)
          .map((contact) => ({
            phone: contact.phone as string,
            params: resolveVariables(
              payload.variables,
              contact,
              customValueIndex.get(contact.id),
            ),
            ...(messageParams ? { messageParams } : {}),
          }));

        if (apiRecipients.length === 0) continue;

        try {
          const res = await fetch('/api/whatsapp/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipients: apiRecipients,
              template_name: payload.template.name,
              template_language: payload.template.language ?? 'en_US',
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Broadcast API request failed');
          }

          const resultsByPhone = new Map<string, BroadcastApiResult>();
          for (const r of (data.results ?? []) as BroadcastApiResult[]) {
            resultsByPhone.set(r.phone, r);
          }

          for (const contact of batch) {
            const phone = contact.phone;
            const result = phone ? resultsByPhone.get(phone) : undefined;

            if (!result || result.status !== 'sent') {
              failedCount++;
            }

            try {
              if (result?.status === 'sent') {
                await supabase
                  .from('broadcast_recipients')
                  .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    whatsapp_message_id: result.whatsapp_message_id ?? null,
                    error_message: null,
                  })
                  .eq('broadcast_id', broadcastId)
                  .eq('contact_id', contact.id);
              } else {
                await supabase
                  .from('broadcast_recipients')
                  .update({
                    status: 'failed',
                    error_message: result?.error ?? 'Send failed',
                  })
                  .eq('broadcast_id', broadcastId)
                  .eq('contact_id', contact.id);
              }
            } catch {}
          }
        } catch (err) {
          for (const contact of batch) {
            failedCount++;
            try {
              await supabase
                .from('broadcast_recipients')
                .update({
                  status: 'failed',
                  error_message:
                    err instanceof Error ? err.message : 'Unknown error',
                })
                .eq('broadcast_id', broadcastId)
                .eq('contact_id', contact.id);
            } catch {}
          }
        }

        const progressPct =
          30 + Math.round(((i + batch.length) / totalRecipients) * 60);
        setProgress(progressPct);

        if (i + SEND_BATCH_SIZE < contacts.length) {
          await sleep(SEND_BATCH_DELAY_MS);
        }
      }

      // ── Step 5: Finalize status ───────────────────────────────────
      setProgress(95);
      const finalStatus = failedCount === totalRecipients ? 'failed' : 'sent';
      try {
        await supabase
          .from('broadcasts')
          .update({
            status: finalStatus,
            sent_count: totalRecipients - failedCount,
            failed_count: failedCount,
          })
          .eq('id', broadcastId);
      } catch {}

      setProgress(100);
      return broadcastId;
    } finally {
      setIsProcessing(false);
    }
  }

  return { createAndSendBroadcast, isProcessing, progress };
}
