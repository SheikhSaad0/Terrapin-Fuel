/**
 * AI Meal Plan Generator
 *
 * Uses Claude to select and arrange real UMD menu items into
 * a Breakfast / Lunch / Dinner plan optimized for the user's
 * calorie + protein goals.
 *
 * Portion strategy:
 *   - Calories are OVERESTIMATED by ~15-20% per item (conservative accounting).
 *     This means the plan total stays WITHIN budget, but the actual food
 *     the student eats will have slightly fewer calories, leaving a buffer.
 *   - For BULKING: minimum-calorie focus. AI tries to hit AT LEAST the target.
 *     Overestimation still applies but is less critical; student eats full portions.
 *   - For CUT/MAINTAIN: student takes ~80% of listed portions to eat slightly less
 *     than the AI's conservative estimate, creating a natural deficit buffer.
 */

import Anthropic from "@anthropic-ai/sdk";
import { MenuItem, MealPlan, Profile, MacroTargets, DailyMenu } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ReviewSummary {
  loved:   string[]; // rating >= 7
  disliked: string[]; // rating <= 4
}

interface GenerateOptions {
  cuisinePreference?: string;
  editInstruction?:  string;
}

export async function generateMealPlan(
  profile: Profile,
  menu: DailyMenu,
  diningHall: string,
  locationNum: number,
  date: string,
  reviews: ReviewSummary,
  options?: GenerateOptions
): Promise<MealPlan> {
  const { macros } = profile;

  // Build a compact menu string for each meal (only items with >0 calories)
  const menuSummary = (items: MenuItem[]): string => {
    return items
      .filter((i) => i.calories > 0 || i.protein > 0)
      .map((i) => {
        const tags = i.tags.length ? ` [${i.tags.join(",")}]` : "";
        return `• ${i.name}${tags} — ${i.calories}cal, ${i.protein}g pro, ${i.carbs}g carb, ${i.fat}g fat (serving: ${i.servingSize}) [section: ${i.section}]`;
      })
      .join("\n");
  };

  const portionInstruction = profile.goal === "bulk"
    ? `BULKING mode: The student needs to hit AT LEAST ${macros.calories} calories. Recommend full portions. When estimating calories, use the listed amount — do NOT underestimate. It's fine to go slightly over the target.`
    : `CUT/MAINTAIN mode: Overestimate each item's calories by 15-20% when building the plan total. This means the plan total should appear to hit the target, but the ACTUAL calories consumed will be lower. Tell the student to take about 80% of each listed portion — this natural buffer helps the cut. The plan total should be at or slightly under ${macros.calories} cal using this inflated accounting.`;

  const filterNote = profile.dietaryPrefs.length > 0
    ? `The student's dietary restrictions: ${profile.dietaryPrefs.join(", ")}. EXCLUDE items tagged with any of these allergens/filters (e.g. if gluten-free, exclude items tagged gluten). If "halal" is selected, only include halal-tagged items for meat dishes.`
    : "No dietary restrictions.";

  const reviewNote = [
    reviews.loved.length > 0  ? `LOVES (prefer these if on menu): ${reviews.loved.slice(0, 15).join(", ")}` : "",
    reviews.disliked.length > 0 ? `AVOID (do not include): ${reviews.disliked.slice(0, 15).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const cuisineNote = options?.cuisinePreference
    ? `\n## Cuisine / Craving Preference\nThe student is in the mood for: "${options.cuisinePreference}". Prioritize items on the menu that best match this preference or cuisine style. If no close match exists, pick the nearest flavour profile.`
    : "";

  const editNote = options?.editInstruction
    ? `\n## Required Changes (User-Requested Edit)\nThe student wants these specific modifications applied to this plan: "${options.editInstruction}". This takes priority over other preferences — honour it exactly.`
    : "";

  const prompt = `You are a sports nutrition AI for UMD college students. Select items from today's REAL dining hall menu to build an optimal meal plan.

## Student Profile
Goal: ${profile.goal.toUpperCase()} | Activity: ${profile.activity}
Daily food targets — PRIMARY: ${macros.calories} calories, ${macros.protein}g protein${macros.carbs ? ` | SECONDARY (optional): ${macros.carbs}g carbs, ${macros.fat}g fat` : " | Carbs/fat: not being tracked"}
Supplements already consumed (do NOT add these): ${profile.supplements.map(s => `${s.name} (${s.calories}cal, ${s.protein}g protein)`).join(", ") || "none"}
Other preferences: ${profile.otherPrefs || "none"}

## Dietary Restrictions
${filterNote}

## Past Ratings (personalization)
${reviewNote || "No rating history yet."}
${cuisineNote}${editNote}

## Today's Menu at ${diningHall}
### BREAKFAST
${menuSummary(menu.breakfast) || "No breakfast items available."}

### LUNCH
${menuSummary(menu.lunch) || "No lunch items available."}

### DINNER
${menuSummary(menu.dinner) || "No dinner items available."}

## Portion Strategy
${portionInstruction}

## Instructions
1. Select 2–4 items per meal from the EXACT items listed above. Do not invent items.
2. OPTIMIZE primarily for hitting the calorie and protein targets. Carbs and fat are secondary.
3. For each item, provide a "portion" string (e.g. "1 full plate", "2 scoops", "1 piece") and an "estimatedCalories" that accounts for the portion strategy above.
4. Write a short "tip" for each item (1 sentence max) with practical advice.
5. Write a meal-level "note" (1 sentence) about the meal strategy.
6. The "portionStrategy" field should be 1–2 sentences explaining how the student should approach portions today for their goal.
7. Sum up dailyTotals from your estimated values (NOT the raw menu values).

Return ONLY valid JSON matching this exact structure (no markdown fences, no extra fields):
{
  "meals": {
    "breakfast": {
      "items": [
        { "name": "...", "section": "...", "portion": "...", "estimatedCalories": 0, "protein": 0, "carbs": 0, "fat": 0, "tip": "..." }
      ],
      "note": "..."
    },
    "lunch": { "items": [...], "note": "..." },
    "dinner": { "items": [...], "note": "..." }
  },
  "dailyTotals": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "portionStrategy": "..."
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text
    .replace(/```json|```/g, "")
    .trim();

  const parsed = JSON.parse(raw);

  return {
    profileId:   profile.id,
    date,
    diningHall,
    locationNum,
    meals:       parsed.meals,
    dailyTotals: parsed.dailyTotals as MacroTargets,
    portionStrategy: parsed.portionStrategy,
  };
}

// ─── AI Macro Calculator ───────────────────────────────────────────────────────
export async function aiCalculateMacros(params: {
  heightFt: number; heightIn: number; weightLbs: number;
  age: number; sex: string; goal: string; activity: string;
  supplements: { name: string; protein: number; calories: number }[];
}): Promise<{ macros: MacroTargets; explanation: string }> {
  const prompt = `Calculate daily macro targets (food-only, after subtracting supplements). Use Mifflin-St Jeor TDEE.

Stats: ${params.heightFt}ft ${params.heightIn}in, ${params.weightLbs}lbs, age ${params.age}, sex: ${params.sex}
Goal: ${params.goal} | Activity: ${params.activity}
Daily supplements: ${JSON.stringify(params.supplements)}

Rules:
- Bulk: +350 cal surplus. Maintain: TDEE. Cut: -450 cal deficit.
- Protein: 0.85g/lb bodyweight. For cut, cap protein at 40% of calories (÷4) if too high.
- Subtract supplement calories and protein from targets.
- Rough carbs: 55% of remaining cals after protein. Rough fat: 45% of remaining.
- Optimize food plan for calories and protein. Carbs/fat are rough guidance only.
- Round all to integers.

Return ONLY this JSON (no fences):
{"calories":0,"protein":0,"carbs":0,"fat":0,"explanation":"2 sentences"}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text
    .replace(/```json|```/g, "")
    .trim();

  const result = JSON.parse(raw);
  return {
    macros: {
      calories: result.calories,
      protein:  result.protein,
      carbs:    result.carbs ?? null,
      fat:      result.fat ?? null,
    },
    explanation: result.explanation,
  };
}
