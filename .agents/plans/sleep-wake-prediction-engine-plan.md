# Implementation Plan — Nocturnal Long-Gap Engine (Night Sleep & Morning Wake-Up)

> **Scope:** Strictly the **overnight sleep gap** (evening bedtime to morning wake-up).  
> **Philosophy:** No daytime nap logging or tracking. The app's sleep model exists exclusively to manage the long overnight fasting/retention gap, mid-night breaks for young pups, and morning wake-up pacing.  
> **Target Path:** `.agents/plans/sleep-wake-prediction-engine-plan.md`

---

## 1. Veterinary Chronobiology of the Overnight Gap

During the nocturnal long gap (typically 8–10 hours), a puppy undergoes physiological shifts that differ fundamentally from daytime active intervals:

### 1.1 Circadian Vasopressin (ADH) & Renal Filtration
- In adult dogs, nocturnal secretion of **arginine vasopressin (ADH)** by the pituitary concentrates urine, allowing 8–10 hours of unbroken bladder retention without discomfort.
- In young puppies (< 16 weeks), circadian ADH secretion and tubular urine-concentrating capacity are **immature**. Glomerular filtration continues at high rates overnight.
- **Nocturnal Bladder Holding Capacity by Age:**
  $$\text{Max Overnight Retention } T_{\text{hold}}(\text{ageWeeks}) = \min\left(T_{\text{night}}, \; 240 + 15 \cdot \text{ageWeeks}\right) \text{ minutes}$$

| Age (Weeks / Months) | Max Overnight Void Gap | Mid-Night Break Needed? | Expected Nocturnal Pattern |
|---|---|---|---|
| **8w (~2.0m)** | ~360 min (6.0h) | **Yes** (1–2 outings) | Bedtime 22:00 $\to$ Break ~03:30 $\to$ Wake 07:00 |
| **12w (~2.8m)** | ~420 min (7.0h) | **Yes** (1 outing if night > 7h) | Bedtime 22:30 $\to$ Break ~05:00 $\to$ Wake 07:30 |
| **16w (~3.7m)** | ~480 min (8.0h) | **Borderline** (0–1 outing) | Bedtime 23:00 $\to$ Wake 07:00 (unbroken or dawn void) |
| **20w+ (~4.6m+, e.g. Balma)** | ~540+ min (9.0h+) | **No** (unbroken night) | Bedtime 23:10 $\to$ Wake 08:30 (full overnight hold) |

---

## 2. Audit of Current Implementation vs Reality

### Flaws in Current `predictions.ts`
1. **The 2.5-Month Step Function Discontinuity (`L608`):**
   ```ts
   if (months < 2.5) {
     const midNightPee = new Date(lastPeeTime + 4 * 60 * 60 * 1000);
     ...
   } else {
     nextExpectedAt = targetWakeup; // Expects 9-10h unbroken night!
   }
   ```
   - At 10 weeks (2.3m): schedules a 4h mid-night potty break.
   - At 11 weeks (2.53m): abruptly stops mid-night breaks and expects an 11-week pup to hold urine for 9.5 hours.
   - *Fix:* Replace binary `months < 2.5` with continuous $T_{\text{hold}}(\text{ageWeeks})$.

2. **Modulo 24h Midnight Discontinuity (`L205`):**
   ```ts
   if (lastHour >= 18 || lastHour < 5) {
     let lastM = Math.round(lastHour * 60);
     if (lastM < 12 * 60) lastM += 24 * 60;
     eveningData.push({ mins: lastM, weight });
   }
   ```
   - Arbitrary scalar offsets $+24\text{h}$ cause distortion when bedtimes alternate across 23:30 and 00:30.
   - *Fix:* Use **Von Mises Circular Mean** on $\mathbb{S}^1$ ($\theta = \frac{2\pi t}{24}$).

3. **Mid-Night Potty vs Final Wake-Up Classification (`L67`):**
   ```ts
   isDaytimeHour(logHour, Math.max(4.0, sleepSchedule.wakeupHour - 3), sleepSchedule.bedtimeHour)
   ```
   - If wake-up is 07:00 AM, `wakeupHour - 3` is 04:00 AM.
   - Any young puppy taken out for a quick pee at 04:15 AM immediately kicks the app out of night mode and treats 04:15 AM as the start of the daytime routine!
   - *Fix:* A log during night hours is only an **early morning awakening** if it is within $\le 90$ minutes of normal wake-up, OR followed by morning breakfast/poop. Otherwise, it is a **mid-night break** that returns to night sleep mode until the scheduled wake-up.

---

## 3. Mathematical Formulation (Nocturnal Long Gap)

### 3.1 Circular Harmonic Sleep Schedule Estimator
For daily morning wake-up times $\{t_{\text{wake}, d}\}$ and evening bedtimes $\{t_{\text{bed}, d}\}$:
1. Exponential time-decay weight with 7-day half-life: $w_d = e^{-\Delta d / 7}$.
2. Convert clock hour $t \in [0, 24)$ to angle $\theta = \frac{2\pi \cdot t}{24}$.
3. Circular mean:
   $$X = \sum w_d \cos(\theta_d), \quad Y = \sum w_d \sin(\theta_d)$$
   $$\bar{\theta} = \operatorname{atan2}(Y, X) \pmod{2\pi}$$
   $$\bar{T} = \frac{24 \cdot \bar{\theta}}{2\pi}$$
4. Circular variance and dynamic schedule tolerance:
   $$R = \frac{\sqrt{X^2 + Y^2}}{\sum w_d}$$
   $$\text{Tolerance (mins) } \sigma = \min\left(45, \; \max\left(10, \; \frac{24 \cdot 60}{2\pi} \sqrt{-2 \ln R}\right)\right)$$
   - Generates exact household tolerances: e.g. Bedtime `23:10 ± 15m`, Wakeup `08:40 ± 18m`.

### 3.2 Dynamic Nocturnal Bladder Retention Pipeline
When `now` is within the night sleep window:
1. Target morning wake-up is $T_{\text{wake}}$.
2. Time since last pee is $\Delta t_{\text{sleep}} = \text{now} - t_{\text{last\_pee}}$.
3. Allowed holding window for puppy's exact age:
   $$T_{\text{hold}} = \min\left(T_{\text{night}}, \; 240 + 15 \cdot \text{ageWeeks}\right) \text{ minutes}$$
4. **Decision Tree:**
   - If $(t_{\text{last\_pee}} + T_{\text{hold}}) < T_{\text{wake}} - 45\text{ min}$:
     - **Mode:** `night_sleep`
     - **Next Due:** $t_{\text{last\_pee}} + T_{\text{hold}}$
     - **Reason:** `"Night mode: Mid-night potty break (~Xh hold)"`
   - Else:
     - **Mode:** `night_sleep`
     - **Next Due:** $T_{\text{wake}}$
     - **Reason:** `"Morning outing (~HH:mm)"`

### 3.3 Mid-Night Void vs Morning Awakening Discriminator
When a log occurs between bedtime and scheduled wake-up:
- **Case A: Mid-Night Potty Void**
  - Occurs $> 1.5\text{ hours}$ before normal wake-up AND is a solo pee (no breakfast logged).
  - App records the pee, adjusts the next expectation (either second break or morning wake-up), and **stays in `night_sleep` mode**.
- **Case B: Real Early Awakening**
  - Occurs within $1.5\text{ hours}$ of normal wake-up (e.g. 07:15 AM when normal is 08:30 AM), OR is accompanied by food/poop.
  - App transitions smoothly into `daytime_baseline` and advances the day's routine.

---

## 4. Concrete Code Changes (Minimal Diff, Zero New Tables)

### 1. `src/utils/predictions.ts`
- **Refactor `detectSleepSchedule`**: Use Von Mises circular harmonic mean (eliminates $+24\text{h}$ modulo wrap hacks, outputs `toleranceMinutes`).
- **Refactor `isNightTimeMode`**: Check whether recent nocturnal activity was an early wake-up vs mid-night potty break.
- **Refactor `predictNextPee`**: Replace `months < 2.5` with continuous $T_{\text{hold}}(\text{ageWeeks})$ formula.

### 2. `src/types/index.ts`
Add `toleranceMinutes?: number` to `SleepSchedule`.

### 3. `src/components/DogHealthSummary.tsx`
Display schedule tolerance in the Daily Routine card:
- E.g.: `Coucher ~23:10 (±15m)` / `Réveil ~08:40 (±18m)`.

---

## 5. Verification Plan
1. **`src/utils/__tests__/sleep_chronobiology.test.ts`** (~6 tests):
   - Circular midnight crossing: bedtimes 23:45 and 00:15 average to 00:00 (not midday).
   - Age retention scaling: 8w puppy gets mid-night break; 20w pup holds through the night.
   - 04:00 AM pee for 10w pup stays in night mode; 07:30 AM pee for 08:30 pup triggers morning wake-up.
2. **Full Regression Gate:**
   - `npx tsc -b` (0 errors)
   - `npm test` (all 209 tests pass)
