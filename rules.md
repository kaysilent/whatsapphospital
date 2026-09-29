# Engineering & Coding Rules — WhatsApp Hospital & Clinical CRM

## 1. Core Engineering Principles

1. **Safety First in Healthcare**: Every clinical flow (emergency detection, interval calculation, pricing defense) must fail safely. When in doubt, escalate to a human doctor.
2. **Strict Multi-Tenancy**: Data must never leak between accounts. Every database interaction must be scoped to the authenticated user's `account_id`.
3. **Resilient Webhook Ingestion**: Inbound WhatsApp webhooks must be acknowledged immediately with `200 OK` to satisfy Meta's 3-second SLA, offloading heavy processing to asynchronous pipelines.
4. **Clean Code & Type Safety**: Zero untyped `any` in business logic; all API inputs validated with schemas or strict type guards.

---

## 2. TypeScript & Code Conventions

### 2.1. Strict Typing
- Always enable TypeScript strict mode. Avoid `any` — use `unknown` with type narrowing or define explicit interfaces in `src/types/`.
- Use branded or validated types for phone numbers (E.164 format via `src/lib/whatsapp/phone-utils.ts`).

### 2.2. Directory & Import Rules
- Always use the root alias `@/*` which maps directly to `src/*`.
- File naming:
  - React Components: PascalCase (e.g., `ChatEmulator.tsx`, `AppointmentModal.tsx`) or kebab-case folders with `page.tsx` / `layout.tsx`.
  - Utilities & Helpers: kebab-case (e.g., `emergency-relay.ts`, `generate-reply.ts`).
  - Unit Tests: `[filename].test.ts` placed adjacent to the source or inside `src/lib/`.

### 2.3. Server vs. Client Boundary
- Mark interactive components with `"use client"` at the very top.
- Data-fetching pages and Server Actions must remain server-side to prevent leaking secrets and database credentials to the browser.

---

## 3. Database & Supabase Data Access Rules

### 3.1. Supabase Client Segregation
You MUST use the correct Supabase client depending on the execution context:

| Context | Client Path | Purpose / Permissions |
| :--- | :--- | :--- |
| **Browser / Client Components** | `src/lib/supabase/client.ts` | Uses user session; constrained by Row Level Security (RLS). |
| **Server Components & Server Actions** | `src/lib/supabase/server.ts` | Uses SSR cookies; runs as the logged-in user with RLS. |
| **Webhooks, Cron Jobs & Background Relay** | `src/lib/supabase/admin.ts` | Uses `SUPABASE_SERVICE_ROLE_KEY`; bypasses RLS for system operations. |

```typescript
// ❌ INCORRECT: Using admin client inside client component or regular user route
import { createAdminClient } from '@/lib/supabase/admin';

// ✅ CORRECT: Use server client in Server Actions / Route Handlers
import { createServerClient } from '@/lib/supabase/server';
```

### 3.2. Mandatory Tenant Isolation
Every database query against multi-tenant tables (`contacts`, `conversations`, `messages`, `appointments`, `follow_up_tasks`, `escalations`) MUST filter by `account_id` unless executed through an RLS-validated user session that guarantees tenant scoping.

---

## 4. WhatsApp Webhook & API Protocol Rules

### 4.1. HMAC Signature Verification
Every inbound request to `/api/whatsapp/webhook` MUST be validated against `X-Hub-Signature-256` using `src/lib/whatsapp/webhook-signature.ts` before reading or executing payload instructions.

### 4.2. 3-Second Acknowledgment Rule
Meta requires webhook endpoints to respond with HTTP `200 OK` within 3 seconds. 
- Long-running tasks (LLM generation, vector search, multi-recipient notifications) must be handled asynchronously without blocking the initial HTTP response.

### 4.3. Phone Number Standardization
- All incoming and outgoing phone numbers must be sanitized and formatted to E.164 without spaces, hyphens, or leading plus signs when storing in database keys (`src/lib/whatsapp/phone-utils.ts`).

---

## 5. Clinical Logic & AI Safety Rules

### 5.1. Emergency Bypass Rule
- If an inbound message matches any triage emergency keyword (`urgent`, `severe pain`, `bleeding`, `infection`, `fever`, `swelling`, `pus`, `allergic reaction`, `difficulty breathing`), the standard AI auto-reply engine **MUST BE BYPASSED**.
- Immediate execution of `src/lib/whatsapp/emergency-relay.ts` is required:
  1. Record escalation as `status: 'critical'`.
  2. Send instant reassurance reply to patient.
  3. Send emergency WhatsApp alert to doctor's mobile number.

### 5.2. 4-Question Qualification Rule for Pricing
- The AI Clinical Agent MUST NOT deliver a price range or fixed quotation on turns 1, 2, or 3 of a consultation inquiry.
- On turns 1–3, the AI must ask clarifying diagnostic questions (e.g., target area, skin type, treatment history, severity).
- On turn 4 or greater, the AI may deliver an approximate pricing range, always qualified with: *"Exact pricing requires an in-person clinical assessment by our specialist."*

### 5.3. Treatment Interval Integrity
- Automated scheduling of subsequent sittings must strictly enforce the protocol interval minimums:
  - Laser Hair Reduction: $\ge 28$ days (4 weeks)
  - PRP Therapy: $\ge 21$ days (3 weeks)
  - Chemical Peels: $\ge 14$ days (2 weeks)
  - Microneedling RF: $\ge 21$ days (3 weeks)

---

## 6. Security, Encryption & Privacy Rules

### 6.1. Token & Credential Encryption
- Meta Access Tokens, WABA IDs, Webhook Secrets, and LLM API Keys must be encrypted using AES-256-GCM (`src/lib/whatsapp/encryption.ts`) before insertion into the `accounts` or `settings` tables.
- Raw API keys must NEVER be logged to `console.log` or returned in public API payloads.

### 6.2. No Hardcoded Secrets
- Environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `WHATSAPP_ACCESS_TOKEN`) must never be committed to git or hardcoded into source files.

---

## 7. UI/UX & Styling Standards

### 7.1. Styling Framework
- Use **Tailwind CSS v4** with CSS variables for dynamic theming.
- Follow the clinical color token system:
  - `primary` / `teal`: Action buttons, active badges, navigation highlights.
  - `emerald`: Confirmed appointments, delivered messages, completed tasks.
  - `rose` / `amber`: Critical escalations, pending follow-ups, urgent warnings.
  - `slate` / `gray`: High-contrast typography and subtle borders.

### 7.2. Responsive Data Tables
- Complex tables (such as `/follow-ups`, `/appointments`, `/escalations`) MUST be wrapped in a scroll container with explicit minimum width (e.g. `min-w-[1120px]`) and `whitespace-normal` cells to prevent column truncation or overlap on mobile/tablet viewports.

### 7.3. User Feedback
- Use `sonner` for all non-blocking toast notifications (e.g. "Appointment scheduled", "Doctor alert relayed", "Settings saved").

---

## 8. Verification & Testing Standards

1. **Unit Testing**: All business logic modifications in `src/lib/` must include corresponding Vitest test cases in `*.test.ts`.
2. **Build Verification**: Before committing or packaging deployment archives, run:
   ```bash
   npm run test      # All Vitest unit tests must pass (100%)
   npm run build     # Next.js build must succeed with zero TypeScript errors
   ```
