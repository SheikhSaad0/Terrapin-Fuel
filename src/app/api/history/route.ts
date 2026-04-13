import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { HistoryEntry, MealPlan, Review, MacroTargets } from "@/types";

const sql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/history?profileId=xxx
 * Returns dated history entries combining meal plans and reviews.
 * Each entry contains: date, mealPlan (if any), reviews for that date, and dailyTotals.
 */
export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");
    if (!profileId) return NextResponse.json({ error: "Missing profileId" }, { status: 400 });

    // Get all distinct dates from both reviews and meal_plans
    const dateRows = await sql`
      SELECT DISTINCT date::text AS date FROM reviews WHERE profile_id = ${profileId}
      UNION
      SELECT DISTINCT date::text AS date FROM meal_plans WHERE profile_id = ${profileId}
      ORDER BY date DESC
      LIMIT 60
    `;

    if (dateRows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // For each date, fetch the latest meal plan and all reviews
    const entries: HistoryEntry[] = [];

    for (const { date } of dateRows) {
      const [planRows, reviewRows] = await Promise.all([
        sql`
          SELECT plan_data FROM meal_plans
          WHERE profile_id = ${profileId} AND date = ${date}::date
          ORDER BY created_at DESC LIMIT 1
        `,
        sql`
          SELECT id, food_name, rating, notes, date::text, meal, created_at
          FROM reviews
          WHERE profile_id = ${profileId} AND date = ${date}::date
          ORDER BY meal, food_name
        `,
      ]);

      const mealPlan = planRows.length > 0 ? (planRows[0].plan_data as MealPlan) : null;
      const reviews  = reviewRows.map((r) => ({
        id:        r.id as string,
        profileId,
        foodName:  r.food_name as string,
        rating:    r.rating as number,
        notes:     (r.notes as string) ?? "",
        date:      r.date as string,
        meal:      (r.meal as Review["meal"]) ?? "other",
        createdAt: r.created_at as string,
      }));

      // Compute daily totals from meal plan if available
      let dailyTotals: MacroTargets | null = null;
      if (mealPlan?.dailyTotals) {
        dailyTotals = mealPlan.dailyTotals;
      }

      entries.push({ date: date as string, mealPlan, reviews, dailyTotals });
    }

    return NextResponse.json({ data: entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/history]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
