export type ActivityType = 'pee' | 'poop' | 'food' | 'water' | 'nap' | 'walk' | 'weight' | 'medication';

export type PottyLocation = 'outside' | 'indoor_pad' | 'indoor_accident';

export type StoolConsistency = 'hard' | 'normal' | 'soft' | 'runny';

export type FoodType = 'kibble' | 'wet' | 'raw' | 'treats' | 'topper';

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: string; // ISO string
  loggedBy: string; // Caretaker name e.g. "Matthieu" or "Sarah"
  notes?: string;
  
  // Specific details
  pottyLocation?: PottyLocation;
  stoolConsistency?: StoolConsistency;
  foodType?: FoodType;
  quantityGrams?: number;
  quantityCups?: number;
  waterAmountMl?: number;
  durationMinutes?: number;
  weightKg?: number;
  medicationName?: number | string;
}

export interface PuppyProfile {
  id: string;
  name: string;
  breed: string;
  birthDate: string; // YYYY-MM-DD
  weightKg: number;
  avatarUrl?: string;
  targetMealsPerDay: number;
  dailyFoodGramGoal: number;
  notes?: string;
}

export interface Caretaker {
  id: string;
  name: string;
  role: 'Owner' | 'Partner' | 'Walker' | 'Sitter' | 'Family';
  color: string;
}

export interface PredictionResult {
  nextPeeExpectedAt: Date | null;
  peeUrgency: 'safe' | 'soon' | 'overdue';
  peeReason: string;
  
  nextPoopExpectedAt: Date | null;
  poopUrgency: 'safe' | 'soon' | 'overdue';
  poopReason: string;

  nextFoodExpectedAt: Date | null;
  foodUrgency: 'safe' | 'soon' | 'overdue';
  foodReason: string;

  hoursAwake: number;
  lastNapEndedAt: Date | null;
}

export interface PottyStats {
  totalPee: number;
  totalPoop: number;
  outsideCount: number;
  accidentCount: number;
  successRatePercentage: number;
  streakDays: number;
}
