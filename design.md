# UI/UX Direction & Design System — WhatsApp Hospital & Clinical CRM

## 1. Design Philosophy & Brand Identity

The interface of **WhatsApp Hospital & Clinical CRM** blends **modern clinical precision** with **high-end SaaS aesthetics**. 

```
┌─────────────────────────────────────────────────────────────┐
│                    DESIGN PILLARS                           │
├──────────────────┬──────────────────────┬───────────────────┤
│ Clinical Luxury  │ Uncompromising Speed │ Visual Clarity    │
│ Trustworthy,     │ Zero friction for    │ High contrast,    │
│ calm palette with│ reception & doctors; │ structured data,  │
│ emerald & teal   │ 1-click scheduling   │ no visual clutter │
└──────────────────┴──────────────────────┴───────────────────┘
```

---

## 2. Color Palette & Design Tokens

The color system uses Tailwind CSS v4 variables tailored for medical reliability, actionable workflows, and dark mode support.

### 2.1. Core Palette
| Token | Light Hex | Dark Hex | Semantic Role |
| :--- | :--- | :--- | :--- |
| **`clinical-teal`** | `#0D9488` | `#14B8A6` | Primary brand, active tabs, main CTAs, interactive highlights |
| **`emerald-green`** | `#059669` | `#10B981` | Completed appointments, delivered WhatsApp messages, positive status |
| **`emergency-rose`**| `#E11D48` | `#F43F5E` | Critical escalations, emergency alerts, high-urgency notifications |
| **`clinical-amber`**| `#D97706` | `#F59E0B` | Pending follow-ups, overdue sittings, warning banners |
| **`slate-dark`**    | `#0F172A` | `#F8FAFC` | Headings, primary text, high-contrast labels |
| **`slate-muted`**   | `#64748B` | `#94A3B8` | Subtitles, metadata, timestamps, table column headers |
| **`surface-card`**  | `#FFFFFF` | `#1E293B` | Card backgrounds, modal surfaces, table row backgrounds |
| **`surface-canvas`**| `#F8FAFC` | `#0B0F17` | Main dashboard backdrop, drawer scrims |

---

## 3. Typography & Hierarchy

- **Primary Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`
- **Monospace Font**: `JetBrains Mono`, `ui-monospace`, `monospace` (used for timestamps, phone numbers, and JSON debug streams)

```
H1 (Page Titles):        text-2xl font-bold tracking-tight text-slate-900 dark:text-white
H2 (Section Headings):    text-lg font-semibold text-slate-800 dark:text-slate-100
H3 (Card Titles):         text-sm font-semibold text-slate-700 dark:text-slate-200
Body Text:                text-sm font-normal text-slate-600 dark:text-slate-300
Caption / Meta:           text-xs font-medium text-slate-400 dark:text-slate-400
Badges & Tags:            text-[11px] font-semibold uppercase tracking-wider
```

---

## 4. Key Workstation UI Components

### 4.1. Header & Live Notification Center
- **Interactive Bell Icon**: Contains an unread counter badge pulsing on critical events.
- **Floating Notification Tray**: Clickable dropdown rendering recent clinical alerts (emergencies, overdue follow-ups, new bookings) with deep-link navigation.

### 4.2. Multi-Sitting Appointments Workstation (`/appointments`)
- **Sitting Progress Badges**: Displays formatted session numbers (e.g., `Sitting 2 of 6` with fractional progress bars).
- **"Schedule Next Sitting" Action**: Primary modal automatically suggesting the next sitting date based on clinical interval logic (e.g. `+28 days` for Laser).
- **Protocol Quick Selector**: Dropdown pre-populating treatment name, total sittings count, and recommended interval days.

### 4.3. Follow-Ups Recovery Task Queue (`/follow-ups`)
- **Status Filter Tabs**:
  - `All` | `Scheduled` | `Due Today` | `In Progress` | `Completed`
  - Active counts displayed directly in pill badges.
- **Table Structure**: Wide scroll wrapper (`min-w-[1120px]`) with `whitespace-normal` column formatting, preventing text cutoff on patient names, treatment tags, or task descriptions.

### 4.4. Escalations & Emergency Relay Console (`/escalations`)
- **Priority Indicator**: Bright red/rose pulsing badges for `critical` triggers.
- **Relay Stream Inspector**: Real-time terminal-style card displaying incoming WhatsApp emergency tokens, doctor SMS/WhatsApp dispatches, and incoming doctor mobile relays.

---

## 5. WhatsApp Chat Emulator (`src/components/ChatEmulator.tsx`)

The simulator replicates the exact patient-facing WhatsApp mobile experience:

```
┌──────────────────────────────────────────────┐
│  🟢 WhatsApp • Aesthetic Clinic Assistant    │
├──────────────────────────────────────────────┤
│                                              │
│ [Patient 10:14 AM]                           │
│ "How much does laser hair removal cost?"     │
│                                              │
│ [Clinic AI 10:14 AM]                         │
│ "To give you an accurate estimate, I need to │
│ ask a few questions. What area are you       │
│ looking to treat?"                           │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 💡 Quick Chips:                          │ │
│ │ [Full Face] [Underarms] [Full Body]      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 📋 Sitting Card: Sitting 1/6 • Laser     │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ [Type a message...               ] [🎙️] [➤] │
└──────────────────────────────────────────────┘
```

- **Interactive Quick-Action Chips**: Allows testing diagnostic questions with single clicks.
- **Voice Message Player**: Simulates inbound/outbound WhatsApp audio voice notes with playback progress.
- **Emergency Simulation Button**: Injects urgent trigger keywords to test the doctor relay bridge in real time.

---

## 6. Layout & Responsive Guidelines

1. **Sidebar Navigation**: Collapsible sidebar with high-contrast active icons and grouped navigation sections (*Workspace*, *Clinical Operations*, *Marketing & Automations*, *Configuration*).
2. **Horizontal Table Containers**: All data-dense tables must be wrapped in `overflow-x-auto` to prevent horizontal viewport clipping on screens $< 1280\text{px}$.
3. **Touch Targets**: All mobile and tablet buttons have a minimum hit area of $44 \times 44\text{px}$.
