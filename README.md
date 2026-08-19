<div align="center">
  <img src="public/puppace_logo.png" alt="Puppace Mascot Logo" width="110" />

  # 🐾 Puppace
  
  **Intelligent Canine Care Companion, Potty Predictor & Digital Health Passport**

  <p align="center">
    <a href="https://puppace.vercel.app"><strong>Explore the Live Demo »</strong></a>
  </p>

  [![Live App](https://img.shields.io/badge/Live_Demo-puppace.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://puppace.vercel.app)
  <br />
  [![React 19](https://img.shields.io/badge/React-19.x-61dafb?logo=react&logoColor=black)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-8.x-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
  [![Neon PostgreSQL](https://img.shields.io/badge/Neon-Serverless_PostgreSQL-00e599?logo=postgresql&logoColor=white)](https://neon.tech/)
  [![Vitest](https://img.shields.io/badge/Tests-138_Passing-green?logo=vitest&logoColor=white)](https://vitest.dev/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

<br />

**Puppace** is a modern, high-performance web application designed to eliminate the guesswork of raising a puppy. By combining **canine behavioral science**, **gastrointestinal physiology**, and **veterinary nutritional models**, Puppace learns your puppy’s biological rhythms in real-time — predicting when they need to pee, poop, and eat, while maintaining a medical-grade Digital Health Passport (*Carnet de Santé*).

---

## 📑 Table of Contents

- [What is Puppace?](#-what-is-puppace)
- [What Does It Do? (Core Features)](#-what-does-it-do)
  - [1. Real-Time Predictive Potty & Meal Engine](#1-real-time-predictive-potty--meal-engine)
  - [2. Digital Health Passport (*Carnet de Santé*)](#2-digital-health-passport-carnet-de-santé)
  - [3. Weight Trajectory & Veterinary Calorie Allocator](#3-weight-trajectory--veterinary-calorie-allocator)
  - [4. Multi-Tenant Household & SSO Caretaker Attribution](#4-multi-tenant-household--sso-caretaker-attribution)
- [How It Works (Under the Hood)](#-how-it-works-under-the-hood)
  - [The Potty & Sleep Biological Pipeline](#the-potty--sleep-biological-pipeline)
  - [The Gastrocolic & GI Upset Heuristics](#the-gastrocolic--gi-upset-heuristics)
  - [Nutritional Mathematics (RER & MER)](#nutritional-mathematics-rer--mer)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Installation](#quick-installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Performance & Edge Architecture](#-performance--edge-architecture)
- [License](#-license)

---

## 🌟 What is Puppace?

Raising a puppy requires constant coordination between family members, strict adherence to vaccination protocols, and vigilance around potty training schedules. 

Traditional pet apps are static logbooks: you record an event, and it sits in a database. **Puppace is active and predictive**:
1. **It observes**: You log pees, poops, meals, weights, and medical events via 1-tap quick actions.
2. **It learns**: Using exponential time-decay math and sleep schedule detection, it models your dog's physiological intervals.
3. **It guides**: The dashboard shows dynamic countdowns with confidence tolerances ($\pm \text{mins}$), gastrocolic alerts, and exact kibble portion recommendations.

---

## 🚀 What Does It Do?

### 1. Real-Time Predictive Potty & Meal Engine
- **Three Decoupled Live Hero Cards**: Dedicated real-time countdowns for **Next Pee**, **Next Poop**, and **Next Meal**.
- **Confidence Intervals ($\pm \text{delta}$)**: Calculates Semi-Interquartile Ranges ($P_{25}, P_{50}, P_{75}$) to display honest accuracy windows (e.g. `In ~45m (±15m)`).
- **Synchronized Morning Outing Flow**: Mathematically aligns morning wakeup, first pee, walk poop, and breakfast in natural biological sequence ($\text{Pee} \le \text{Poop} \le \text{Breakfast}$).
- **Physiological Emergency & Digestive Alerts**:
  - *Gastrocolic Reflex*: Prompts an immediate potty check 15–30 minutes after any meal.
  - *Digestive Upset*: Flags diarrhea/liquid stools with a 60-minute urgent re-check; accounts for refractory delay after constipation.

### 2. Digital Health Passport (*Carnet de Santé*)
- **Core & Non-Core Vaccine Protocols**: Automatically tracks French & European veterinary guidelines (CHPPi/DAPPi, Leptospirosis L4, Rabies, Kennel Cough) with booster schedules and batch numbers.
- **ESCCAP Antiparasitic & Deworming Engine**: Automated age-based deworming schedules (bi-weekly for puppies $< 8\text{w}$, monthly up to $6\text{m}$, quarterly for adults).
- **One-Click Veterinary PDF Export**: Generates a clean, printable medical passport for vet visits and boarding facilities.

### 3. Weight Trajectory & Veterinary Calorie Allocator
- **Waltham Growth Curves**: Evaluates weight entries against breed-specific adult growth curves (Toy, Small, Medium, Large, Giant).
- **RER & MER Veterinary Nutrition**:
  $$\text{RER (kcal/day)} = 70 \times (\text{weight}_{\text{kg}})^{0.75}$$
  Scales by puppy growth factors ($3.0\times$ for $< 4\text{m}$, $2.0\times$ for $4\text{–}12\text{m}$) to output exact daily kibble targets in grams.
- **Portion Allocator**: Automatically splits remaining calories across remaining meals today based on logged breakfast/lunch portions.

### 4. Multi-Tenant Household & SSO Caretaker Attribution
- **Seamless Caretaker Sync**: Multiple family members (Owner, Partner, Sitter, Walker) log in via Google SSO or family credentials.
- **Zero-Friction Attribution**: Every log automatically records `loggedBy` metadata with color-coded avatar badges.
- **Multi-Puppy Support**: Switch between dogs in the household with a single tap.

---

## 🔬 How It Works (Under the Hood)

### The Potty & Sleep Biological Pipeline

```mermaid
flowchart TD
    A[Activity Logs] --> B[detectSleepSchedule]
    B -->|Timezone-Aware Decimal Hours| C[Wakeup & Bedtime Anchor]
    A --> D[Exponential Time-Decay Filter]
    D -->|7-Day Half-Life Weighting| E[Waking Intervals Median]
    C --> F[predictNextPee Pipeline]
    E --> F
    F --> G[Dynamic Target Time ± Semi-IQR]
```

1. **Sleep Schedule Detection (`detectSleepSchedule`)**:
   Analyzes nighttime gaps in activity logs using floating-point decimal hours (`getLocalDecimalHour`) to determine exact household bedtime and wakeup times without hardcoded assumptions.
2. **Exponential Recency Weighting**:
   Recent days carry higher weight than logs from two weeks ago ($w_i = 0.5^{\Delta t / 7\text{d}}$), allowing the model to smoothly follow your puppy's growing bladder capacity.
3. **Night Boundary Filtering**:
   Filters out night sleep intervals so morning pee intervals reflect real awake bladder retention rather than 8-hour overnight holds.

### The Gastrocolic & GI Upset Heuristics

- **Gastrocolic Trigger**: When food is logged, the engine sets an active 30-minute potty alert window.
- **Stool Quality Feedback**:
  - `diarrhea` / `liquid` $\rightarrow$ Triggers rapid 45–60m re-check interval.
  - `hard` / `constipated` $\rightarrow$ Adds a 20% refractory extension to the learned median.

### Nutritional Mathematics (RER & MER)

```typescript
// Standard Veterinary Resting Energy Requirement
const rer = 70 * Math.pow(effectiveWeightKg, 0.75);

// Age-scaled maintenance multiplier
const growthMultiplier = ageMonths < 4 ? 3.0 : ageMonths < 12 ? 2.0 : 1.6;
const dailyKcalGoal = rer * growthMultiplier;

// Converted to grams based on food caloric density (default ~360 kcal / 100g)
const dailyGramsGoal = Math.round((dailyKcalGoal / kcalPer100g) * 100);
```

---

## 📁 Project Architecture

```
puppy-tracker/
├── api/                   # Serverless backend endpoints (Vercel Functions)
│   ├── auth/              # Google SSO verification & token exchange
│   ├── dogs/              # Multi-tenant puppy profile management
│   ├── activities/        # Time-series activity stream (pee, poop, food, weight)
│   └── health/            # Medical records (vaccinations, deworming)
├── src/
│   ├── components/        # UI components (PredictorWidget, Timeline, HealthSummary)
│   │   └── common/        # Shared primitives (StatusBadge, AppModal, ConfirmationModal)
│   ├── hooks/             # Domain state hooks (usePuppies, useCaretakers, useActivities)
│   ├── views/             # Lazy-loaded major routes (Dashboard, CarnetDeSante, Settings)
│   ├── utils/             # Core mathematical & biological logic
│   │   ├── predictions.ts # Decoupled prediction pipelines & Semi-IQR engine
│   │   ├── weight.ts      # Growth curves, adult weight projection & RER/MER goals
│   │   ├── health.ts      # Vaccination & deworming protocol evaluators
│   │   ├── date.ts        # Timezone-aware date arithmetic & decimal hour calculations
│   │   └── export.ts      # Digital passport PDF generator
│   ├── services/          # Client-side API synchronization layer
│   ├── db/                # Drizzle ORM schema & Neon PostgreSQL connection
│   ├── i18n/              # English & French internationalization dictionaries
│   └── types/             # TypeScript domain interfaces
├── scripts/
│   └── inspect_db.ts      # Zero-leak Neon database diagnostic & prediction inspector
└── vercel.json            # Edge caching & immutable asset headers
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: $\ge 20.x$
- **npm**: $\ge 10.x$
- **Database**: Neon Serverless PostgreSQL instance (or any standard PostgreSQL database)

### Quick Installation

```bash
# 1. Clone the repository
git clone https://github.com/Ouriel/puppy-tracker.git
cd puppy-tracker

# 2. Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Neon Serverless PostgreSQL Connection String
DATABASE_URL="postgresql://user:password@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# JWT / Session Signing Secret
SESSION_SECRET="your-super-secure-session-secret"

# Optional: Google OAuth Client ID for SSO
VITE_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

### Running the App

```bash
# Start local development server (with /api proxy)
npm run dev

# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🧪 Testing & Quality Assurance

Puppace maintains an extensive automated test suite covering all mathematical algorithms, edge cases, timezone handling, and veterinary growth logic:

```bash
# Run Vitest test suite
npm test

# Run Oxlint / Code Quality Checks
npm run lint

# Run Live Database & Predictor Diagnostics
npm run db:inspect
```

---

## ⚡ Performance & Edge Architecture

- **Sub-100ms TTFB**: Served via Vercel Edge Network with Brotli compression.
- **Route & Modal Code-Splitting**: Critical initial entry bundle is under **36 kB (gzipped)**. Secondary views (`CarnetDeSanteView`, `SettingsView`, `AuthLockScreen`) load asynchronously via `React.lazy` and `<Suspense>`.
- **Immutable Static Caching**: 1-year cache headers (`Cache-Control: public, max-age=31536000, immutable`) for all fingerprinted assets.
- **Non-Blocking Asset Loading**: Asynchronous web font preloading and on-demand SSO script injection for zero initial render blocking.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more details.

Crafted with ❤️ for puppies and their humans.
