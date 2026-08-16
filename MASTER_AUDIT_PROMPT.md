# 🔍 MASTER CODEBASE, FEATURE & ALGORITHM AUDIT PROMPT

You are conducting a **thorough, zero-assumption, end-to-end review** of the entire application codebase. 

Do NOT make any assumptions or rely on pre-existing claims. You must verify everything empirically by inspecting the actual source code, running build/test commands, adhering to guardrails, and conducting online/scientific research to validate domain models.

---

### 🎯 EXPERT AUDIT PANEL & PERSPECTIVES

Act as a triple-domain expert panel comprising:
1. **Staff Software Engineer**: Full-stack architecture, React standards, state management, bundle efficiency, code genericity, DRY principles, maintainability vs. over-engineering, security posture (auth, front-end, API, multi-tenancy).
2. **Senior Veterinarian (DACVN / ECVCN Specialist)**: Scientific validation of caloric requirements (RER/MER), kibble density scaling, digestive transit times, stool consistency thresholds (diarrhea/constipation), vaccine & parasite protocols.
3. **Expert Canine Behavioral Trainer (CPDT-KA)**: House-training mechanics, gastrocolic reflex post-meal potty triggers, walk double-void gap filtering, night sleep schedule consistency, potty urgency alerts.

---

### 📋 AUDIT SCOPE & REQUIREMENTS

#### 1. Codebase Architecture, Genericity & Maintainability (Staff Engineer)
* **Code Genericity & DRY Audit**: Identify logic duplication across the codebase (e.g., date/time calculations, status badge formatting, modal handling, repetitive API fetches). Recommend what logic should be extracted into shared utility functions, custom React hooks, or compound components without over-engineering.
* **React Standards & State Management**: Audit application entry points, views, and components. Evaluate prop drilling, state atomicity, memoization (`React.memo`, `useMemo`, `useCallback`), concurrent rendering (`useTransition`), and re-render bottlenecks.
* **Type Safety & Build Integrity**: Verify strict TypeScript compilation across all files (`npx tsc -b`). Ensure zero type errors, sound interfaces, strict schema validation, and clean module boundaries.

#### 2. Security & Multi-Tenancy Architecture (Staff Engineer)
* **Authentication & Token Resilience**: Audit authentication logic and session token signing. Verify HMAC-SHA256 token verification, constant-time signature comparison (`timingSafeEqual`), expiration enforcement, and environment variable fallbacks.
* **Multi-Tenant Isolation**: Audit all API endpoints and database queries to ensure strict multi-tenant isolation (`householdId` scoping) at the database layer. Guarantee zero risk of cross-tenant data leaks.
* **API Defense-in-Depth & Front-End Security**: Audit payload validation via Zod schemas, CORS configuration, XSS sanitization, client-side secret exposure, and storage security.

#### 3. Domain & Veterinary Validation (Senior Veterinarian & Expert Dog Trainer)
* **Veterinary Nutrition & Energy Requirements**: Validate daily calorie calculations (Resting Energy Requirement: $RER = 70 \times \text{weight}^{0.75}$), growth stage MER multipliers ($<4\text{mo}=3.0$, $4\text{–}12\text{mo}=2.0$, $>12\text{mo}=1.6$), and kibble energy density scaling ($3.8\text{ kcal/g}$).
* **Gastrointestinal & Health Protocols**: Review GI upset alerts (diarrhea/soft stool 60m window), constipation recovery refractory periods, and health passport protocols (vaccine boosters & ESCCAP deworming intervals).
* **Canine Behavioral & House-Training Mechanics**: Audit the gastrocolic reflex post-meal triggers (pees $15\text{m}\sim30\text{m}$, poops $20\text{m}\sim50\text{m}$), walk double-void gap filtering ($<45\text{m}$ pees, $<90\text{m}$ poops), and night sleep schedule wrap handling (`detectSleepSchedule`).
* **External Web Research**: Perform online web searches and reference authoritative veterinary literature (AKC, AAFCO, WSAVA, ESCCAP, Ian Dunbar, Sophia Yin) to cross-reference every mathematical model and domain rule.

#### 4. UI/UX, Themes & Design System (Staff Engineer & UX Designer)
* **Design System & Visual Excellence**: Review dark mode theme harmony, color palette hierarchy, typography, UI component usage, micro-interactions, and visual polishing.
* **Mobile Responsiveness & Accessibility (a11y)**: Audit mobile grid adaptability, ARIA attributes, keyboard navigation, and touch-target dimensions ($>44\text{px}$).

#### 5. Verification & Test Suite Audit
* Run `npm test` across all test files in the workspace.
* Verify that all unit test suites pass 100% green and test real-world scenarios, datasets, and boundary conditions.

---

### 📋 REQUIRED DELIVERABLES

Provide a comprehensive, structured report detailing:
1. **Empirical Build & Test Verification Status**
2. **Architecture, Code Genericity & Maintainability Assessment** (Duplication analysis & extraction recommendations)
3. **Security & Multi-Tenancy Assessment** (Auth, database safety, API defenses)
4. **Domain & Veterinary Compliance Scorecard** (Vet science + Behavioral trainer evaluation)
5. **UI/UX & React Performance Evaluation** (Design quality, a11y, re-render audit)
6. **Prioritized Actionable Refactoring Roadmap**
7. **Overall Code Quality & Reliability Score**
