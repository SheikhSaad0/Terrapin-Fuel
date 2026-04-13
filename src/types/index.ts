// ─── Dining Halls ─────────────────────────────────────────────────────────────
export const DINING_HALLS = [
  { id: "south",   label: "South Campus",           locationNum: 16 },
  { id: "251",     label: "251 North",               locationNum: 51 },
  { id: "y",       label: "Yahentamitsi",            locationNum: 19 },
  // Stamp Union / other retail — uncomment and set correct locationNum if needed
  // { id: "stamp", label: "Stamp Union",            locationNum: 25 },
] as const;

export type DiningHallId = (typeof DINING_HALLS)[number]["id"];

// ─── Dietary Icons (scraped from UMD icon URLs) ───────────────────────────────
export const ICON_MAP: Record<string, DietaryTag> = {
  "icons_2016_dairy.gif":          "dairy",
  "icons_2016_egg.gif":            "eggs",
  "icons_2016_gluten.gif":         "gluten",
  "icons_2016_soy.gif":            "soy",
  "icons_2016_nuts.gif":           "nuts",
  "icons_2016_sesame.gif":         "sesame",
  "icons_2016_shellfish.gif":      "shellfish",
  "icons_2016_fish.gif":           "fish",
  "icons_2016_vegetarian.gif":     "vegetarian",
  "icons_2016_vegan.gif":          "vegan",
  "icons_2022_HalalFriendly.gif":  "halal",
  "icons_2016_locallyGrown.gif":   "locally-grown",
  "icons_2016_smartChoice.gif":    "smart-choice",
};

export type DietaryTag =
  | "dairy" | "eggs" | "gluten" | "soy" | "nuts" | "sesame"
  | "shellfish" | "fish" | "vegetarian" | "vegan" | "halal"
  | "locally-grown" | "smart-choice";

// Labels displayed to the user for each dietary preference
export const DIETARY_PREF_OPTIONS: { id: DietaryTag; label: string; emoji: string }[] = [
  { id: "halal",      label: "Halal Friendly",  emoji: "☪️"  },
  { id: "vegan",      label: "Vegan",            emoji: "🌱"  },
  { id: "vegetarian", label: "Vegetarian",       emoji: "🥦"  },
  { id: "gluten",     label: "Gluten-Free",      emoji: "🌾"  },
  { id: "dairy",      label: "Dairy-Free",       emoji: "🥛"  },
  { id: "eggs",       label: "Egg-Free",         emoji: "🥚"  },
  { id: "nuts",       label: "Nut-Free",         emoji: "🥜"  },
  { id: "shellfish",  label: "Shellfish-Free",   emoji: "🦐"  },
  { id: "soy",        label: "Soy-Free",         emoji: "🫘"  },
  { id: "fish",       label: "Fish-Free",        emoji: "🐟"  },
];

// ─── Dietary Tag Display Helpers ──────────────────────────────────────────────
export const TAG_ABBREV: Record<DietaryTag, string> = {
  vegetarian:      "V",
  vegan:           "VG",
  halal:           "HF",
  gluten:          "GF",
  dairy:           "DF",
  eggs:            "EF",
  nuts:            "NF",
  shellfish:       "SF",
  soy:             "SY",
  fish:            "FF",
  sesame:          "SE",
  "locally-grown": "LG",
  "smart-choice":  "SC",
};

export const TAG_COLORS: Record<DietaryTag, string> = {
  vegetarian:      "#10b981",
  vegan:           "#059669",
  halal:           "#6366f1",
  gluten:          "#f59e0b",
  dairy:           "#06b6d4",
  eggs:            "#f97316",
  nuts:            "#a16207",
  shellfish:       "#0891b2",
  soy:             "#7c3aed",
  fish:            "#2563eb",
  sesame:          "#9a3412",
  "locally-grown": "#15803d",
  "smart-choice":  "#0d9488",
};

// ─── Menu Item ────────────────────────────────────────────────────────────────
export interface MenuItem {
  name:         string;
  recNum:       string;          // e.g. "119370*1"
  section:      string;         // e.g. "Broiler Works"
  tags:         DietaryTag[];
  calories:     number;
  protein:      number;
  carbs:        number;
  fat:          number;
  servingSize:  string;
  ingredients?: string;
}

export type MealName = "breakfast" | "lunch" | "dinner";

export interface DailyMenu {
  breakfast: MenuItem[];
  lunch:     MenuItem[];
  dinner:    MenuItem[];
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export interface Supplement {
  name:     string;
  protein:  number;
  calories: number;
}

export interface MacroTargets {
  calories: number;
  protein:  number;
  carbs:    number | null;  // optional — null means "not tracking"
  fat:      number | null;  // optional — null means "not tracking"
}

export interface WeightEntry {
  date:   string; // YYYY-MM-DD
  weight: number; // lbs
}

export interface Profile {
  id:             string;
  name:           string;
  avatarColor:    string;
  heightFt:       number;
  heightIn:       number;
  weightLbs:      number;
  age:            number;
  sex:            "male" | "female";
  goal:           "bulk" | "maintain" | "cut";
  activity:       "sedentary" | "light" | "moderate" | "active";
  dietaryPrefs:   DietaryTag[];
  otherPrefs:     string;
  supplements:    Supplement[];
  macros:         MacroTargets;
  weightLog:      WeightEntry[];
  createdAt:      string;
}

// ─── Meal Plan ────────────────────────────────────────────────────────────────
export interface PlanItem {
  name:        string;
  section:     string;
  portion:     string;          // e.g. "1 cup" or "1 scoop + 1 piece"
  estimatedCalories: number;   // AI's overestimated calorie count (conservative)
  protein:     number;
  carbs:       number;
  fat:         number;
  tip:         string;         // AI tip for this item (e.g. portion guidance)
}

export interface MealPlan {
  id?:         string;
  profileId:   string;
  date:        string;
  diningHall:  string;
  locationNum: number;
  meals: {
    breakfast: { items: PlanItem[]; note: string };
    lunch:     { items: PlanItem[]; note: string };
    dinner:    { items: PlanItem[]; note: string };
  };
  dailyTotals:   MacroTargets;
  portionStrategy: string;     // AI explanation of portion approach for this goal
}

// ─── Review ───────────────────────────────────────────────────────────────────
export interface Review {
  id:        string;
  profileId: string;
  foodName:  string;
  rating:    number;
  notes:     string;
  date:      string;
  meal:      "breakfast" | "lunch" | "dinner" | "other";
  createdAt: string;
}

// ─── History ──────────────────────────────────────────────────────────────────
export interface HistoryEntry {
  date:        string;
  mealPlan:    MealPlan | null;
  reviews:     Review[];
  dailyTotals: MacroTargets | null;
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
