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
  [![Vitest](https://img.shields.io/badge/Tests-144_Passing-green?logo=vitest&logoColor=white)](https://vitest.dev/)
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
  - [The Age-Graduated Gastrocolic Maturation Model](#the-age-graduated-gastrocolic-maturation-model)
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

## 🐶 What is Puppace?

Most pet apps are static loggers — passive digital notebooks where you type what happened in the past. **Puppace is an active predictive companion**.

Puppies do not operate on fixed clock schedules; their physiological needs change dynamically with:
- **Age-related sphincter myelination** (transitioning from involuntary infant reflexes to conscious cortical control between 16–20 weeks).
- **Natural digestive transit rhythms** and meal spacing.
- **Household sleep cycles** and seasonal daylight shifts.

Puppace continuously fits mathematical models to your household's time-series activity logs to compute accurate, confidence-interval-bounded countdowns for **Next Pee**, **Next Poop**, and **Next Meal**.

---

## ✨ What Does It Do?

### 1. Real-Time Predictive Potty & Meal Engine
- **Decoupled Hero Countdown**: Separate cards for Pee, Poop, and Food with dynamic urgency states (`safe`, `soon`, `overdue`).
- **Sleep-Aware Boundaries**: Suppresses daytime alarms during learned night sleep hours while preserving midnight relief alerts for very young pups (< 2.5 months).
- **Semi-IQR Confidence Bands**: Displays dynamic tolerance intervals (e.g. `±15m`) derived from the semi-interquartile range of your puppy's actual logs.

### 2. Digital Health Passport (*Carnet de Santé*)
- **Official Veterinary French & International Protocols**: Built-in schedules for core puppy vaccines (DHPPi, L4, Rabies) and anti-parasitics (monthly all-in-one chewables like Credelio Plus / NexGard Spectra, quarterly adult dewormers).
- **One-Click PDF Export**: Generates a clean, bilingual French/English health summary formatted for veterinary visits or border crossings.

### 3. Weight Trajectory & Veterinary Calorie Allocator
- **Waltham Growth Projections**: Compares your puppy's weigh-in history against breed-specific standard growth curves to forecast adult weight.
- **Dynamic Calorie (RER/MER) Allocation**: Computes Resting Energy Requirements ($70 \times \text{weight}^{0.75}$) and maintenance multipliers based on age and target meals per day.

### 4. Multi-Tenant Household & SSO Caretaker Attribution
- **Google SSO Caretaker Sync**: Seamless family sharing where each event (walks, feedings, health treatments) is automatically attributed to the active family member.

---

## 🧠 How It Works (Under the Hood)

### The Potty & Sleep Biological Pipeline

```mermaid
flowchart TD
    A[Household Activity Logs] --> B[detectSleepSchedule Engine]
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

### The Age-Graduated Gastrocolic Maturation Model

In young puppies, stomach distension immediately stimulates the colon (the **gastrocolic reflex**) because the pudendal nerve is not yet fully myelinated. Between **16 and 20 weeks (4 to 5 months)**, puppies develop **cortical inhibition** (voluntary sphincter control), naturally decoupling elimination from eating.

```mermaid
flowchart TD
    A[Meal Logged] --> B{Puppy Age}
    B -->|< 14 Weeks| C[Active Gastrocolic Window 15-30m]
    B -->|14 - 20 Weeks| D{Empirical Post-Meal Ratio >= 40%?}
    D -->|Yes| C
    D -->|No / Insufficient Data| E[Maintain Learned Daytime Interval]
    B -->|> 20 Weeks| F{Statistically Proven Habit >= 50%?}
    F -->|Yes| G[Custom Learned Delay]
    F -->|No| E
```

- **$< 14\text{ Weeks}$**: Active guidance enabled by default (15–30m post-meal potty alert).
- **$14\text{ to }20\text{ Weeks}$**: Transition phase — requires empirical data confirmation ($\ge 40\%$ of meals followed by potty $\le 45\text{m}$) before overriding the waking baseline.
- **$> 20\text{ Weeks}$ (Adolescent / Adult)**: Assumes voluntary cortical control; maintains standard daytime intervals (~4h 26m) unless statistically proven with $\ge 50\%$ post-meal correlation.
- **Stool Quality Feedback**:
  - `diarrhea` / `liquid` $\rightarrow$ Triggers rapid 60m GI Upset check interval.
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
