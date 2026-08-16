# 🐾 Puppace — Intelligent Puppy Care, Potty Predictor & Health Passport

Puppace is a modern, responsive, and scientifically-grounded puppy care companion. Built with **React 19, TypeScript, Vite, Tailwind CSS, HeroUI, and Neon Serverless PostgreSQL (Drizzle ORM)**, it combines canine behavioral science and veterinary nutritional models into a real-time predictive dashboard and digital health passport (*Carnet de Santé*).

---

## ✨ Key Features

### 🔮 1. SOTA Predictive Potty & Feeding Engine
- **Decoupled Predictor Pipelines**: Independent, single-responsibility pipelines for [`predictNextPee`](./src/utils/predictions.ts), [`predictNextPoop`](./src/utils/predictions.ts), and [`predictNextFood`](./src/utils/predictions.ts).
- **Synchronized Morning Outing Sequence**: Data-driven alignment of morning wakeup, first potty, morning poop during the walk, and breakfast in natural biological order ($\text{Pee} \le \text{Poop} \le \text{Breakfast}$).
- **Exponential Time-Decay & Semi-IQR Math**: Weights recent days with a 7-day half-life to adapt rapidly to puppy growth. Computes $P_{25}/P_{50}/P_{75}$ percentiles to output dynamic $\pm\text{deltaMins}$ confidence tolerances.
- **Physiological & Health Triggers**:
  - *Gastrocolic Reflex*: Automatic post-meal potty check window (15–30m after meals depending on age).
  - *GI Upset Alerts*: 60m check window on liquid/diarrhea logs; extended refractory recovery period after hard/constipated stools.
  - *Night Sleep Boundary*: Automatic detection of household bedtime and wakeup hours with zero static ranges.

### 📋 2. Digital Health Passport (*Carnet de Santé*)
- **Vaccination Tracker**: Tracks Core (CHPPi/DAPPi) and Non-Core (Leptospirosis L4, Rabies, Kennel Cough) protocols with booster reminders and batch number tracking.
- **ESCCAP Parasite Protocols**: Tracks monthly deworming schedules (every 2 weeks up to 2mo, monthly up to 6mo, quarterly for adults) with weight-at-dose records.
- **Status Badging**: Reusable [`StatusBadge`](./src/components/common/StatusBadge.tsx) chips indicating Up-to-Date, Due Soon, Overdue, or Fulfilled statuses.

### 📈 3. Weight Growth Trajectory & Vet Nutrition
- **Weight Tracking & Growth Curves**: Tracks recorded weights against breed-specific growth trajectories (Toy, Small, Medium, Large, Giant) using centralized [`src/utils/weight.ts`](./src/utils/weight.ts).
- **Projected Adult Weight Range**: Statistical projection derived from empirical growth curves.
- **RER & MER Vet Caloric Goals**: Calculates Resting Energy Requirements ($\text{RER} = 70 \times \text{weight}^{0.75}$) and Maintenance Energy Requirements ($\text{MER}$) scaled by age growth multipliers to output exact daily kibble gram recommendations.
- **Meal Portion Allocator**: Dynamically calculates portion grams for remaining meals today based on daily goals and logged meals.

### 👥 4. Multi-Tenant Household & SSO Caretaker Attribution
- **Seamless SSO Attribution**: Authenticated user sessions automatically attribute `loggedBy` metadata to the logged-in family member with zero friction or popups.
- **Household Role Management**: Supports multi-member households (Owner, Partner, Sitter, Dog Walker) with color-coded badges and role-based permissions.
- **Multi-Puppy Management**: Switch seamlessly between multiple puppies in the same household.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, HeroUI, Lucide Icons.
- **Database & Backend**: Neon Serverless PostgreSQL with Drizzle ORM.
- **Testing**: Vitest with comprehensive unit and behavioral test suites (100+ tests).
- **Internationalization (i18n)**: English (EN) and French (FR) with instant locale switching.
- **Design Principles**: Dark-mode aesthetic, accessible touch targets, zero cliché bloat, and surgical DRY modularity.

---

## 📁 Project Structure

```
puppy-tracker/
├── src/
│   ├── components/        # UI components (PredictorWidget, Navbar, HealthSummary, etc.)
│   │   └── common/        # Standardized design components (StatusBadge, AppModal)
│   ├── hooks/             # Custom React domain state hooks (usePuppies, useCaretakers, useActivities)
│   ├── views/             # Major view layouts (DashboardView, CarnetDeSanteView, SettingsView)
│   ├── utils/             # Core business & mathematical logic
│   │   ├── predictions.ts # Decoupled prediction pipelines, sleep schedules & semi-IQR engine
│   │   ├── weight.ts      # Growth curves, adult weight projection & RER/MER goals
│   │   ├── health.ts      # Vaccination & deworming protocols and status evaluation
│   │   ├── date.ts        # Timezone-aware date formatting, arithmetic & ISO parsers
│   │   └── storage.ts     # LocalStorage cache & offline fallback
│   ├── services/          # API client & backend synchronization services
│   ├── db/                # Drizzle ORM database schema & connection client
│   └── types/             # TypeScript interfaces & domain types
├── scripts/
│   └── inspect_db.ts      # Safe Neon database inspection & prediction diagnostics tool
└── api/                   # Serverless API routes (dogs, activities, health, auth)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js $\ge 20$
- npm $\ge 10$

### Installation
```bash
git clone https://github.com/Ouriel/puppy-tracker.git
cd puppy-tracker
npm install
```

### Environment Configuration
Create a `.env.local` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require"
SESSION_SECRET="your-secure-session-signing-secret"
```

### Development Server
```bash
npm run dev
```

### Build & Production Bundle
```bash
npm run build
```

---

## 🧪 Testing & Diagnostics

### Run Full Test Suite
```bash
npm test
```

### Run Live Database Diagnostics
Safely inspect live database records, table row counts, and live prediction engine diagnostics without exposing credentials:
```bash
npm run db:inspect
# or: npx tsx scripts/inspect_db.ts
```

---

## 📄 License
MIT License. Crafted for puppy owners and pet care teams.
