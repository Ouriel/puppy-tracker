export type ActivityType = 'pee' | 'poop' | 'food' | 'walk' | 'weight' | 'medication';

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

export type FamilyRole = 'Husband' | 'Wife' | 'Partner' | 'Child' | 'Dog Walker' | 'Sitter' | 'Relative' | 'Member';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: FamilyRole;
  avatarColor: string;
  familyPackId: string;
}

export interface Caretaker {
  id: string;
  name: string;
  role: FamilyRole;
  color: string;
  email?: string;
}

export interface PredictionResult {
  nextPeeExpectedAt: Date | null;
  standardPeeExpectedAt?: Date | null;
  peeUrgency: 'safe' | 'soon' | 'overdue';
  peeReason: string;
  
  nextPoopExpectedAt: Date | null;
  standardPoopExpectedAt?: Date | null;
  poopUrgency: 'safe' | 'soon' | 'overdue';
  poopReason: string;

  nextFoodExpectedAt: Date | null;
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
