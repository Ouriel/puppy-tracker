export type ActivityType = 'pee' | 'poop' | 'food' | 'weight' | 'medication';

export type PottyLocation = 'outside' | 'indoor_accident';

export type StoolConsistency = 'hard' | 'normal' | 'soft' | 'runny';

export type FoodType = 'kibble' | 'wet' | 'raw' | 'treats' | 'topper';

export interface Activity {
  id: string;
  householdId?: string;
  puppyId: string; // Links activity to a specific puppy
  type: ActivityType;
  timestamp: string; // ISO string
  loggedBy: string; // Caretaker name
  notes?: string;
  
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
  weightKg?: number;
  avatarUrl?: string;
  targetMealsPerDay: number;
  dailyFoodGramGoal: number;
  notes?: string;
}

export type FamilyRole = 'Husband' | 'Wife' | 'Partner' | 'Child' | 'Dog Walker' | 'Sitter' | 'Relative' | 'Member' | 'SuperAdmin';

export interface UserAccount {
  id: string;
  householdId?: string;
  name: string;
  email: string;
  role: FamilyRole;
  avatarColor?: string;
  familyPackId?: string;
  status?: 'ACTIVE' | 'PENDING_APPROVAL';
}

export interface Caretaker {
  id: string;
  name: string;
  role: FamilyRole;
  color: string;
  email?: string;
}

export interface RegisteredUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL';
}

export type ScheduleMode = 'daytime_baseline' | 'post_meal_override' | 'night_sleep';
export type FoodScheduleMode = 'daytime_schedule' | 'goal_reached' | 'night_sleep';

export interface PredictionResult {
  nextPeeExpectedAt: Date | null;
  standardPeeExpectedAt?: Date | null;
  peeMode: ScheduleMode;
  peeUrgency: 'safe' | 'soon' | 'overdue';
  peeReason: string;
  
  nextPoopExpectedAt: Date | null;
  standardPoopExpectedAt?: Date | null;
  poopMode: ScheduleMode;
  poopUrgency: 'safe' | 'soon' | 'overdue';
  poopReason: string;

  nextFoodExpectedAt: Date | null;
  foodMode: FoodScheduleMode;
  foodUrgency: 'safe' | 'soon' | 'overdue';
  foodReason: string;
}

export interface PottyStats {
  totalPee: number;
  totalPoop: number;
  outsideCount: number;
  accidentCount: number;
  successRatePercentage: number;
  streakDays: number;
}

export interface HealthRecord {
  id: string;
  householdId: string;
  puppyId: string;
  type: 'vaccination' | 'deworming';
  name: string;
  date: string;
  boosterDate?: string;
  batchNumber?: string;
  vetClinic?: string;
  productName?: string;
  weightAtTime?: number;
  notes?: string;
}
