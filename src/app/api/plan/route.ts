import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { generateMealPlan, aiCalculateMacros } from "@/lib/ai";
import { calculateMacros } from "@/lib/macros";
import { Profile, DailyMenu, DietaryTag, Supplement, WeightEntry } from "@/types";

const sql = neon(process.env.DATABASE_URL!);

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id:           row.id as string,
    name:         row.name as string,
    avatarColor:  row.avatar_color as string,
    heightFt:     row.height_ft as number,
    heightIn:     row.height_in as number,
    weightLbs:    row.weight_lbs as number,
    age:          row.age as number,
    sex:          row.sex as "male" | "female",
    goal:         row.goal as "bulk" | "maintain" | "cut",
    activity:     row.activity as "sedentary" | "light" | "moderate" | "active",
    dietaryPrefs: ((row.dietary_prefs ?? []) as string[]) as DietaryTag[],
    otherPrefs:   (row.other_prefs as string) ?? "",
    supplements:  Array.isArray(row.supplements)
                    ? (row.supplements as Supplement[])
                    : [],
    macros: {
      calories: row.target_calories as number,
      protein:  row.target_protein  as number,
      carbs:    (row.target_carbs   as number | null) ?? null,
      fat:      (row.target_fat     as number | null) ?? null,
    },
    weightLog: Array.isArray(row.weight_log)
                 ? (row.weight_log as WeightEntry[])
                 : [],
    createdAt: row.created_at as string,
  };
}

/**
 * POST /api/plan
 * Body: { profileId, locationNum, diningHall, date?, regenerate?, cuisinePreference?, editInstruction? }
 */
export async function POST(req: NextRequest) {
  try {
    const {
      profileId, locationNum, diningHall, date, regenerate,
      cuisinePreference, editInstruction,
    } = await req.json();
    const today = date ?? new Date().toISOString().split("T")[0];

    // Load profile
    const profileRows = await sql`SELECT * FROM profiles WHERE id = ${profileId} LIMIT 1`;
    if (profileRows.length === 0) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const profile = rowToProfile(profileRows[0]);

    // Return cached plan if one exists (unless regenerate=true)
    if (!regenerate) {
      const existing = await sql`
        SELECT plan_data FROM meal_plans
        WHERE profile_id = ${profileId}
          AND date = ${today}::date
          AND location_num = ${locationNum}
        ORDER BY created_at DESC LIMIT 1
      `;
      if (existing.length > 0) {
        return NextResponse.json({ data: existing[0].plan_data, cached: true });
      }
    }

    // Get today's cached menu
    const menuRows = await sql`
      SELECT menu_data FROM cached_menus
      WHERE location_num = ${locationNum}
        AND date = ${today}::date
      LIMIT 1
    `;
    if (menuRows.length === 0) {
      return NextResponse.json({
        error: "No menu scraped for today. Use the Scrape Menu button first.",
        noMenu: true,
      }, { status: 422 });
    }
    const menu = menuRows[0].menu_data as DailyMenu;

    // Get review history for personalization
    const reviewRows = await sql`
      SELECT food_name, AVG(rating)::float AS avg_rating
      FROM reviews
      WHERE profile_id = ${profileId}
      GROUP BY food_name
    `;
    const reviews = {
      loved:    reviewRows.filter((r) => (r.avg_rating as number) >= 7).map((r) => r.food_name as string),
      disliked: reviewRows.filter((r) => (r.avg_rating as number) <= 4).map((r) => r.food_name as string),
    };

    // Generate AI plan
    const plan = await generateMealPlan(
      profile, menu, diningHall, locationNum, today, reviews,
      { cuisinePreference, editInstruction }
    );

    // Save to DB
    await sql`
      INSERT INTO meal_plans (profile_id, date, location_num, dining_hall, plan_data)
      VALUES (
        ${profileId},
        ${today}::date,
        ${locationNum},
        ${diningHall},
        ${JSON.stringify(plan)}::jsonb
      )
    `;

    return NextResponse.json({ data: plan, cached: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Plan API]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/plan?heightFt=...&ai=true|false
 * Calculates macro targets (fast local formula or AI-powered)
 */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const useAI = p.get("ai") === "true";

    const params = {
      heightFt:    Number(p.get("heightFt")),
      heightIn:    Number(p.get("heightIn") ?? 0),
      weightLbs:   Number(p.get("weightLbs")),
      age:         Number(p.get("age")),
      sex:         (p.get("sex") ?? "male") as "male" | "female",
      goal:        (p.get("goal") ?? "maintain") as "bulk" | "maintain" | "cut",
      activity:    (p.get("activity") ?? "moderate") as "sedentary" | "light" | "moderate" | "active",
      supplements: JSON.parse(p.get("supplements") ?? "[]") as Supplement[],
    };

    if (useAI) {
      const result = await aiCalculateMacros(params);
      return NextResponse.json({ data: result });
    }

    const result = calculateMacros(
      params.heightFt, params.heightIn, params.weightLbs,
      params.age, params.sex, params.goal, params.activity, params.supplements
    );
    return NextResponse.json({ data: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Macros API]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
