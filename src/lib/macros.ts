/**
 * Macro Calculator
 *
 * Uses Mifflin-St Jeor BMR → TDEE → goal adjustment.
 * Returns daily food-only targets after subtracting supplements.
 */

import { Profile, MacroTargets, Supplement } from "@/types";

type Activity = Profile["activity"];
type Goal = Profile["goal"];
type Sex = Profile["sex"];

const ACTIVITY_MULTIPLIER: Record<Activity, number> = {
  sedentary: 1.2,
  light:     1.375,
  moderate:  1.55,
  active:    1.725,
};

function calcBMR(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  // Mifflin-St Jeor
  if (sex === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

export function calculateMacros(
  heightFt: number,
  heightIn: number,
  weightLbs: number,
  age: number,
  sex: Sex,
  goal: Goal,
  activity: Activity,
  supplements: Supplement[]
): { macros: MacroTargets; explanation: string } {
  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;

  const bmr = calcBMR(weightKg, heightCm, age, sex);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER[activity]);

  let targetCalories: number;
  let goalLabel: string;

  if (goal === "bulk") {
    targetCalories = tdee + 350;
    goalLabel = "+350 cal bulk surplus";
  } else if (goal === "cut") {
    targetCalories = tdee - 450;
    goalLabel = "-450 cal cut deficit";
  } else {
    targetCalories = tdee;
    goalLabel = "maintenance";
  }

  // Raw protein target: ~0.85g per lb bodyweight
  let rawProtein = Math.round(weightLbs * 0.85);

  // On a cut, protein can't exceed ~40% of calories
  const proteinFromCals = Math.round((targetCalories * 0.40) / 4);
  if (goal === "cut" && rawProtein > proteinFromCals) {
    rawProtein = proteinFromCals;
  }

  // Subtract supplement macros
  const suppCalories = supplements.reduce((s, x) => s + (Number(x.calories) || 0), 0);
  const suppProtein  = supplements.reduce((s, x) => s + (Number(x.protein) || 0), 0);

  const foodCalories = Math.max(0, targetCalories - suppCalories);
  const foodProtein  = Math.max(0, rawProtein - suppProtein);

  // Rough carbs/fat split from remaining calories after protein
  const proteinCals    = foodProtein * 4;
  const remainingCals  = Math.max(0, foodCalories - proteinCals);
  const foodCarbs      = Math.round((remainingCals * 0.55) / 4);
  const foodFat        = Math.round((remainingCals * 0.45) / 9);

  const suppNote = supplements.length > 0
    ? ` After subtracting ${suppCalories} cal and ${suppProtein}g protein from supplements, food targets are ${foodCalories} cal and ${foodProtein}g protein.`
    : "";

  const explanation = `TDEE is ~${tdee} cal/day (${goalLabel}).${suppNote} Optimize for calories and protein — carbs/fat estimates are shown for guidance.`;

  return {
    macros: {
      calories: foodCalories,
      protein:  foodProtein,
      carbs:    foodCarbs,
      fat:      foodFat,
    },
    explanation,
  };
}
