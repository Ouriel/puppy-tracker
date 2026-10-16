export type ActivityType = 'pee' | 'poop' | 'food' | 'weight' | 'medication';

export type PottyLocation = 'outside' | 'indoor_accident';

export type StoolConsistency = 'hard' | 'normal' | 'diarrhea' | 'soft' | 'runny';

export type FoodType = 'kibble' | 'wet' | 'raw' | 'treats' | 'topper';

export interface Activity {
  id: string;
  householdId?: string;
  puppyId: string; // Links activity to a specific puppy
  type: ActivityType;
  timestamp: string; // ISO string
  loggedBy: string; // Caretaker name
  notes?: string | null; // null: no note (the API sends null; an edit sends null to delete one)
  
  // Specific details
  pottyLocation?: PottyLocation;
  stoolConsistency?: StoolConsistency;
  foodType?: FoodType;
  quantityGrams?: number;
  quantityCups?: number;
  durationMinutes?: number;
  weightKg?: number;
  medicationName?: string;
}

export interface PuppyProfile {
  id: string;
  householdId?: string;
  name: string;
  breed: string;
  birthDate: string; // YYYY-MM-DD
  weightKg?: number | null; // legacy: no screen or estimate uses it (a dog's weight is its weight events); null for a new dog
  avatarUrl?: string;
  gender?: 'male' | 'female' | null; // null: not set (the API returns null; an edit sends null to clear it)
  expectedAdultWeightKg?: number | null;
  targetMealsPerDay: number;
  dailyFoodGramGoal: number;
  notes?: string;
}

export type FamilyRole = 'Husband' | 'Wife' | 'Partner' | 'Child' | 'Dog Walker' | 'Sitter' | 'Relative' | 'Member' | 'Admin' | 'SuperAdmin';

export interface UserAccount {
  householdId?: string;
  name: string;
  email: string;
  role: FamilyRole;
  avatarColor?: string;
  familyPackId?: string;
  status?: 'ACTIVE' | 'PENDING_APPROVAL';
}

/** How a Google sign-in ended: 'pending' only for a 403 (account waiting for approval). */
export type SignInOutcome = 'signedIn' | 'pending' | 'failed';

export interface Caretaker {
  id: string;
  name: string;
  role: FamilyRole;
  color: string;
  email?: string;
}

/** Why /api/households refused a badge change; the app shows its own translated message for each. */
export type MemberRefusalCode = 'memberNameTaken' | 'memberEmailTaken' | 'memberAdminOnly';

export interface RegisteredUserItem {
  id: string;
  householdId?: string;
  email: string;
  name: string;
  role: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL';
}

export type ScheduleMode = 'daytime_baseline' | 'post_meal_override' | 'night_sleep';
export type FoodScheduleMode = 'daytime_schedule' | 'goal_reached' | 'night_sleep';

export interface SleepSchedule {
  bedtimeHour: number;
  wakeupHour: number;
  bedtimeStr?: string;
  wakeupStr?: string;
}

export interface PredictorOptions {
  timeZone?: string;
  sleepSchedule?: SleepSchedule;
  mealSchedule?: { breakfastMins: number; lunchMins: number; dinnerMins: number };
}

export interface SinglePredictionResult {
  nextExpectedAt: Date | null;
  standardExpectedAt?: Date | null;
  deltaMins: number;
  mode: ScheduleMode;
  urgency: 'safe' | 'soon' | 'overdue';
  reason: string;
}

export interface FoodPredictionResult {
  nextExpectedAt: Date | null;
  deltaMins: number;
  mode: FoodScheduleMode;
  urgency: 'safe' | 'soon' | 'overdue';
  reason: string;
  portionGrams?: number;
}

export interface PredictionResult {
  nextPeeExpectedAt: Date | null;
  standardPeeExpectedAt?: Date | null;
  peeDeltaMins?: number;
  peeMode: ScheduleMode;
  peeUrgency: 'safe' | 'soon' | 'overdue';
  peeReason: string;
  
  nextPoopExpectedAt: Date | null;
  standardPoopExpectedAt?: Date | null;
  poopDeltaMins?: number;
  poopMode: ScheduleMode;
  poopUrgency: 'safe' | 'soon' | 'overdue';
  poopReason: string;

  nextFoodExpectedAt: Date | null;
  foodDeltaMins?: number;
  foodMode: FoodScheduleMode;
  foodUrgency: 'safe' | 'soon' | 'overdue';
  foodReason: string;

  sleepSchedule?: SleepSchedule;
  mealSchedule?: { breakfastMins: number; lunchMins: number; dinnerMins: number };
  portionGrams?: number;
}

export interface HealthRecord {
  id: string;
  householdId: string;
  puppyId: string;
  type: 'vaccination' | 'deworming';
  name: string;
  date: string;
  // null: none (the API sends null; an edit sends null to clear one)
  boosterDate?: string | null;
  batchNumber?: string | null;
  vetClinic?: string | null;
  productName?: string;
  notes?: string;
}

// The dog's health records: not answered yet, known, or no load worked (they are never kept on the phone)
export type HealthRecordsLoadState = 'loading' | 'loaded' | 'failed';

export interface DashboardPayload {
  puppies: PuppyProfile[];
  deletedPuppies?: PuppyProfile[]; // the owner only: dogs deleted, which they can restore
  caretakers: Caretaker[];
  activities: Activity[];
  healthRecords?: HealthRecord[];
  weightActivities?: Activity[]; // every weight and medication event, whatever its date (the key predates medications)
}

export interface EffectiveWeightInfo {
  lastLoggedWeight?: number; // undefined before the first weigh-in
  lastLoggedTimestamp?: string;
  estimatedCurrentWeight: number;
  daysSinceLastLog: number;
  isEstimated: boolean;
  centileDescription?: string;
}

export interface WeightProjectionResult {
  projectedAdultKg: number;
  minAdultKg: number;
  maxAdultKg: number;
  isTrajectoryBased: boolean;
  confidencePercent?: number;
  walthamCategory?: 'I' | 'II' | 'III' | 'IV' | 'V';
  growthVelocityGramsPerDay?: number;
}
