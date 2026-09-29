# Project Memory & Persistent Context — WhatsApp Hospital & Clinical CRM

## 1. Project Context & Identity

- **Project Name**: WhatsApp Hospital & Clinical CRM (`wacrm`)
- **Repository Location**: `c:\Users\ARBAZ KHAN\Downloads\whatsapphospital-main\whatsapphospital-main`
- **Primary Domain**: Medical CRM, Aesthetic Clinics, Dermatology Centers, Dental Practices, Healthcare Triage via WhatsApp.
- **Primary Frameworks**: Next.js 16.2 (App Router), React 19.2, Tailwind CSS v4, Supabase (PostgreSQL 15, Auth SSR, RLS, pgvector), Meta WhatsApp Cloud API (Graph v21.0).

---

## 2. Clinical Protocols & Domain Knowledge

### 2.1. Standardized Treatment Protocols
```typescript
export const TREATMENT_PROTOCOLS = {
  'Laser Hair Reduction': { defaultSittings: 6, intervalWeeks: [4, 6], intervalDays: 28 },
  'PRP Therapy':          { defaultSittings: 4, intervalWeeks: [3, 4], intervalDays: 21 },
  'Chemical Peels':       { defaultSittings: 4, intervalWeeks: [2, 3], intervalDays: 14 },
  'Microneedling RF':     { defaultSittings: 4, intervalWeeks: [3, 4], intervalDays: 21 },
  'HydraFacial Glow':     { defaultSittings: 3, intervalWeeks: [4, 4], intervalDays: 28 },
  'Botox & Fillers':      { defaultSittings: 1, intervalWeeks: [2, 2], intervalDays: 14 }
};
```

### 2.2. Emergency Relay Protocol
- **Trigger Keywords**: `urgent`, `severe pain`, `bleeding`, `infection`, `fever`, `swelling`, `pus`, `allergic reaction`, `difficulty breathing`, `emergency`.
- **Relay Flow**:
  1. Detect keyword in inbound WhatsApp message.
  2. Send instant reassurance text to patient.
  3. Send structured emergency alert to doctor mobile number (`EMERGENCY_DOCTOR_PHONE`).
  4. Intercept doctor's WhatsApp response and relay it back to the patient.

### 2.3. 4-Question Qualification Gate
- **Rule**: Pricing is NEVER given on turns 1, 2, or 3 of a consultation inquiry.
- **Diagnostic Inquiries**: AI queries target area, previous treatments, skin type/tone, and condition severity.
- **Turn 4+**: AI provides approximate range + consultation caveat.
- **Proactive Leading**: If patient is passive, AI asks diagnostic leading questions to maintain engagement.

---

## 3. Environment Variables & Secret Configuration

The application requires the following environment variables (stored in `.env.local` or Hostinger hPanel):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-id>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# WhatsApp Business Cloud API
WHATSAPP_PHONE_NUMBER_ID="<your-meta-phone-number-id>"
WHATSAPP_WABA_ID="<your-meta-waba-id>"
WHATSAPP_ACCESS_TOKEN="<your-system-user-access-token>"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="<your-custom-webhook-verify-token>"
WHATSAPP_APP_SECRET="<your-meta-app-secret-for-hmac>"

# Clinical Emergency Bridge
EMERGENCY_DOCTOR_PHONE="+1234567890"

# AI Inference (Bring Your Own Key)
OPENAI_API_KEY="sk-..."
# or ANTHROPIC_API_KEY="sk-ant-..."

# Security Encryption Key (AES-256-GCM - 32-byte hex string)
ENCRYPTION_KEY="<64-hex-character-string>"
```

---

## 4. Server Architecture & Hostinger Deployment

- **Port Binding**: Next.js runs via `server.js` listening on `process.env.PORT || 3000`.
- **LiteSpeed Configuration**: `.htaccess` handles reverse proxy routing, Brotli compression, and WebSocket upgrades.
- **Deployment Archive**: Ready-to-deploy zip located at:
  `C:\Users\ARBAZ KHAN\Downloads\whatsapphospital-hostinger-deploy.zip`
- **Deploy Steps**:
  1. Upload zip to Hostinger `public_html` (or Node.js root folder).
  2. Extract files.
  3. Ensure Node.js version is set to $\ge 20.x$.
  4. Set environment variables in hPanel.
  5. Start application (Entry point: `server.js` or `npm start`).

---

## 5. Key File Locations & Reference Paths

- **Emergency Relay**: `src/lib/whatsapp/emergency-relay.ts`
- **AI 4-Question Gating**: `src/lib/ai/generate-reply.ts`
- **Meta API Client**: `src/lib/whatsapp/meta-api.ts`
- **Webhook Ingestion**: `src/app/api/whatsapp/webhook/route.ts`
- **Appointments Workstation**: `src/app/(dashboard)/appointments/page.tsx`
- **Follow-Ups Queue**: `src/app/(dashboard)/follow-ups/page.tsx`
- **Escalations Console**: `src/app/(dashboard)/escalations/page.tsx`
- **Chat Emulator**: `src/components/ChatEmulator.tsx`
- **Header Notification Dropdown**: `src/components/layout/header.tsx`
- **Clinical Unit Tests**: `src/lib/clinical-all-features.test.ts`
