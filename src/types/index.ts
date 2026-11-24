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
  status?: AccountStatus;
}

/** REVOKED: the owner removed its access (only the owner sets and clears it). */
export type AccountStatus = 'ACTIVE' | 'REVOKED';

/** How a Google sign-in ended: 'revoked' for the 403 coded 'revoked'. */
export type SignInOutcome = 'signedIn' | 'revoked' | 'failed';

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
  status: AccountStatus;
}

/** A household in the owner's Admin panel: `name` is null until the owner names it. */
export interface HouseholdItem {
  id: string;
  name: string | null;
}

/** A request sent from the privacy policy's form, listed for the owner in the Admin panel. */
export interface PrivacyRequestItem {
  id: string;
  email: string;
  kind: 'access' | 'correct' | 'erase' | 'restrict' | 'object' | 'portability' | 'other';
  message: string | null;
  lang: string;
  createdAt: string | null;
  handledAt: string | null;
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
  mealSchedule?: number[]; // usual time of each meal of the day, minutes after midnight (detectMealSchedule)
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
  mealSchedule?: number[]; // usual time of each meal of the day, minutes after midnight (detectMealSchedule)
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
  productName?: string | null; // a deworming's product; a vaccine's product typed from the vet's sticker
  notes?: string | null;
}

// The dog's health records: not answered yet, known, or no load worked (they are never kept on the phone)
export type HealthRecordsLoadState = 'loading' | 'loaded' | 'failed';

export interface DashboardPayload {
  puppies: PuppyProfile[];
  deletedPuppies?: PuppyProfile[]; // the owner and the household's Admin only: dogs deleted, which they can restore
  caretakers: Caretaker[];
  activities: Activity[];
  healthRecords?: HealthRecord[];
  weightActivities?: Activity[]; // every weight and medication event, whatever its date (the key predates medications)
  invites?: HouseholdInvite[]; // invites addressed to the signed-in email, answered from the dashboard's invite card
}

/** An invite into another household, waiting for the signed-in person's answer. `householdName`: null until the owner names it. */
export interface HouseholdInvite {
  id: string;
  invitedBy: string | null;
  householdName: string | null;
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
  walthamCategory?: 'I' | 'II' | 'III' | 'IV' | 'V';
}
