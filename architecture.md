# System Architecture & Technical Specifications — WhatsApp Hospital & Clinical CRM

## 1. High-Level System Architecture

The WhatsApp Hospital CRM (`wacrm`) is built on a modern, decoupled architecture combining a Next.js 16 App Router application with Supabase (PostgreSQL 15 + RLS + Auth + pgvector) and the official Meta WhatsApp Business Cloud API.

```mermaid
flowchart TB
    subgraph ClientLayer["Client Layer (Browser / Mobile)"]
        UI["Next.js 16 React 19 UI\n(Tailwind CSS v4 + Base UI)"]
        ChatSim["WhatsApp Live Emulator\n(Interactive Testing)"]
        AudioRec["Voice Note Recorder\n(Opus / Web Audio)"]
    end

    subgraph AppServer["Application Server (Node.js 20+ / Standalone server.js)"]
        NextApp["Next.js App Router (SSR & RSC)"]
        API["API Route Handlers (/api/*)"]
        Actions["Server Actions"]
        RelayEngine["Emergency Doctor Relay Router"]
        AIEngine["AI Clinical Agent Engine\n(4-Question Gate + Fallback)"]
    end

    subgraph SupabaseLayer["Database & Realtime (Supabase / Postgres 15)"]
        Postgres[("PostgreSQL Database\n(with RLS Policies)")]
        PgVector[("pgvector Embeddings\n(Hybrid Knowledge Retrieval)")]
        Realtime["Supabase Realtime\n(PostgreSQL CDC WebSockets)"]
        Auth["Supabase Auth SSR"]
        Storage["Supabase Storage\n(Media, Audio, Attachments)"]
    end

    subgraph ExternalServices["External Infrastructure"]
        MetaAPI["Meta WhatsApp Cloud API\n(Graph API v21.0)"]
        LLMProviders["OpenAI / Anthropic APIs\n(LLM Inference)"]
        Hostinger["Hostinger Managed Node.js / LiteSpeed Server"]
    end

    UI <--> NextApp
    ChatSim <--> API
    NextApp <--> Postgres
    API <--> Postgres
    API <--> PgVector
    API <--> Auth
    UI <--> Realtime
    API <--> MetaAPI
    AIEngine <--> LLMProviders
    RelayEngine <--> MetaAPI
    AppServer -.-> Hostinger
```

---

## 2. Directory Structure & Layer Mapping

```
├── .memory/                     # Local persistent memory context
├── public/                      # Static assets, logos, and sound effects
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/              # Authentication routes (login, register, forgot-password)
│   │   ├── (dashboard)/         # Protected CRM workstation routes
│   │   │   ├── appointments/    # Multi-sitting appointment scheduler & calendar
│   │   │   ├── automations/     # Visual workflow builder
│   │   │   ├── broadcasts/      # Campaign sender & HSM template manager
│   │   │   ├── contacts/        # Patient CRM directory & medical tags
│   │   │   ├── dashboard/       # Executive metrics & live activity feed
│   │   │   ├── escalations/     # Emergency doctor relay console & audit logs
│   │   │   ├── follow-ups/      # Multi-sitting recovery task queue
│   │   │   ├── notifications/   # System alerts & emergency notice center
│   │   │   ├── pipelines/       # Kanban patient stage funnel
│   │   │   ├── reports/         # Clinical & financial analytics
│   │   │   ├── settings/        # WhatsApp creds, AI keys, team RBAC, system config
│   │   │   └── templates/       # Meta-approved message template editor
│   │   ├── api/                 # Backend REST endpoints & Webhooks
│   │   │   ├── ai/              # AI test, generation & embeddings
│   │   │   ├── appointments/    # Sittings CRUD & task triggers
│   │   │   ├── automations/     # Workflow executor
│   │   │   ├── broadcasts/      # Campaign queue dispatcher
│   │   │   ├── escalations/     # Emergency triage & doctor bridge
│   │   │   ├── follow-ups/      # Recovery task management
│   │   │   ├── v1/              # Public developer REST API
│   │   │   └── whatsapp/        # Meta webhook receiver & verification
│   ├── components/              # Modular UI components
│   │   ├── layout/              # Sidebar, header, notifications dropdown
│   │   ├── ui/                  # Accessible primitives (shadcn / Base UI)
│   │   └── ChatEmulator.tsx     # Full WhatsApp interactive preview & testing
│   ├── hooks/                   # Custom client hooks (use-auth, use-demo-state)
│   ├── lib/                     # Core business logic & SDK abstractions
│   │   ├── ai/                  # generate-reply.ts (4-question gating, pricing range)
│   │   ├── supabase/            # client.ts, server.ts, admin.ts (Service Role)
│   │   └── whatsapp/            # meta-api.ts, emergency-relay.ts, encryption.ts
│   └── types/                   # TypeScript schemas and database interfaces
├── supabase/
│   └── migrations/              # 38+ SQL migrations defining tables, RLS & triggers
├── server.js                    # Standalone Node.js server for Hostinger / VPS
└── .htaccess                    # LiteSpeed web server reverse proxy & caching rules
```

---

## 3. Database Schema & Data Models

All database tables reside in PostgreSQL with Row Level Security (RLS) ensuring strict multi-tenant isolation keyed by `account_id`.

```mermaid
erDiagram
    ACCOUNTS ||--o{ ACCOUNT_MEMBERSHIPS : has
    USERS ||--o{ ACCOUNT_MEMBERSHIPS : belongs_to
    ACCOUNTS ||--o{ CONTACTS : owns
    ACCOUNTS ||--o{ CONVERSATIONS : manages
    CONVERSATIONS ||--o{ MESSAGES : contains
    CONTACTS ||--o{ APPOINTMENTS : books
    APPOINTMENTS ||--o{ FOLLOW_UP_TASKS : generates
    CONTACTS ||--o{ ESCALATIONS : triggers
    ACCOUNTS ||--o{ ESCALATIONS : logs

    ACCOUNTS {
        uuid id PK
        string name
        string slug
        string whatsapp_phone_number_id
        string whatsapp_waba_id
        string emergency_doctor_phone
        jsonb ai_settings
        timestamp created_at
    }

    CONTACTS {
        uuid id PK
        uuid account_id FK
        string phone
        string name
        string email
        string[] tags
        jsonb custom_fields
        timestamp created_at
    }

    CONVERSATIONS {
        uuid id PK
        uuid account_id FK
        uuid contact_id FK
        string status
        uuid assigned_agent_id FK
        int qualification_turns
        timestamp last_message_at
    }

    APPOINTMENTS {
        uuid id PK
        uuid account_id FK
        uuid contact_id FK
        string treatment_name
        int sitting_number
        int total_sittings
        int interval_days
        timestamp appointment_date
        string status
        text clinical_notes
    }

    FOLLOW_UP_TASKS {
        uuid id PK
        uuid account_id FK
        uuid contact_id FK
        uuid appointment_id FK
        string title
        string task_type
        date due_date
        string status
        string priority
    }

    ESCALATIONS {
        uuid id PK
        uuid account_id FK
        uuid contact_id FK
        string trigger_keyword
        string urgency
        string status
        string doctor_phone
        text patient_message
        text doctor_reply
        timestamp created_at
    }
```

---

## 4. WhatsApp Webhook & Emergency Relay Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    participant Meta as Meta WhatsApp Cloud API
    participant Webhook as /api/whatsapp/webhook
    participant Relay as Emergency Relay Router
    participant DB as Supabase PostgreSQL
    actor Doctor

    Patient->>Meta: "I am having severe bleeding after laser"
    Meta->>Webhook: POST Webhook (HMAC Signature Verified)
    Webhook->>Webhook: Validate X-Hub-Signature-256
    Webhook->>Relay: Inspect for Emergency Keywords
    
    alt Emergency Keyword Detected ('bleeding')
        Relay->>DB: Create Escalation Record (Status: 'critical')
        Relay->>Meta: Send Reassurance to Patient
        Meta-->>Patient: "🚨 Alert received. Dr. has been notified..."
        Relay->>Meta: Send Urgent Relay Alert to Doctor Phone
        Meta-->>Doctor: "🚨 URGENT PATIENT ALERT: [Patient Name] reported bleeding..."
    else Doctor WhatsApp Inbound Reply
        Webhook->>Relay: Match Incoming Doctor Phone & Active Relay ID
        Relay->>DB: Update Escalation (Status: 'acknowledged')
        Relay->>Meta: Forward Doctor's Message to Patient WhatsApp
        Meta-->>Patient: "👨‍⚕️ Dr. Instructions: Apply cold compress immediately..."
    else Standard Message Flow
        Webhook->>DB: Store Inbound Message
        Webhook->>DB: Update Conversation State
        Webhook->>Meta: Trigger AI Reply / Auto-Reply Queue
    end
```

---

## 5. AI Inference & 4-Question Qualification Subsystem

```mermaid
stateDiagram-v2
    [*] --> InboundQuery
    InboundQuery --> CheckKeywords: Inspect message text
    
    CheckKeywords --> EmergencyRelay: Contains Emergency Keywords
    CheckKeywords --> EvaluateTurnCount: Normal Clinical Query

    state EvaluateTurnCount {
        [*] --> CheckTurns
        CheckTurns --> GatingEnforced: turns < 4 AND asking for price
        CheckTurns --> AskDiagnostic: turns < 4 AND general query
        CheckTurns --> DeliverPricingRange: turns >= 4 AND asking for price
        CheckTurns --> StandardAssistant: turns >= 4 AND general query
    }

    GatingEnforced --> SendLeadingQuestion: Increment qualification_turns
    AskDiagnostic --> SendLeadingQuestion: Increment qualification_turns
    DeliverPricingRange --> AppendConsultationDisclaimer: Deliver $ Range
    StandardAssistant --> DeliverClinicalAnswer: Assist Patient
```

### Key Technical Guardrails:
1. **Model Support**: OpenAI (`gpt-4o`, `gpt-4o-mini`), Anthropic (`claude-3-5-sonnet`), or local LLM gateways.
2. **Deterministic Encryption**: API tokens stored encrypted via AES-256-GCM using `ENCRYPTION_KEY`.
3. **Retrieval**: Knowledge base chunks fetched via PostgreSQL full-text search (`tsvector @@ websearch_to_tsquery`) or cosine distance on vector embeddings (`embedding <=> query_embedding`).

---

## 6. Hostinger & Standalone Server Deployment Topology

The application is engineered to deploy seamlessly on **Hostinger Managed Node.js** (or any Ubuntu/Debian VPS / Docker container) via a custom standalone server runtime:

```
[Internet]
   │ HTTPS (Port 443)
   ▼
[LiteSpeed Web Server (.htaccess)]
   │ Reverse Proxy Rewrite Rules (Pass-through WebSockets & API)
   ▼
[Custom server.js (Node.js 20+ Standalone Runtime)]
   │ Binds to process.env.PORT || 3000
   ▼
[Next.js App Router / SSR Handlers]
```

### Deployment Configuration Highlights:
- **`server.js`**: Lightweight HTTP listener utilizing Next.js standalone output to serve dynamic routes without external orchestrators.
- **`.htaccess`**: LiteSpeed rules enabling Brotli/Gzip compression, caching static `.next/static` assets at edge, and proxying HTTP requests to the local Node process.
- **`package-deploy.js`**: Deployment packager that builds the standalone bundle and outputs a zero-overhead zip ready for hPanel upload.
