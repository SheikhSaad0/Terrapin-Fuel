import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * GET /api/reviews?profileId=xxx&limit=200
 * Returns all reviews for a profile, with avg rating per food item.
 *
 * POST /api/reviews
 * Body: { profileId, reviews: [{ foodName, rating, notes?, meal? }] }
 * Upserts ratings (one per food per day).
 *
 * DELETE /api/reviews?profileId=xxx&foodName=yyy
 * Removes all reviews for a specific food item.
 */

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");
    if (!profileId) return NextResponse.json({ error: "Missing profileId" }, { status: 400 });

    // Return per-food aggregate stats + recent individual reviews
    const aggregates = await sql`
      SELECT
        food_name,
        ROUND(AVG(rating)::numeric, 1)::float AS avg_rating,
        COUNT(*) AS review_count,
        MAX(date) AS last_reviewed
      FROM reviews
      WHERE profile_id = ${profileId}
      GROUP BY food_name
      ORDER BY avg_rating DESC, review_count DESC
    `;

    const recent = await sql`
      SELECT id, food_name, rating, notes, date::text, meal, created_at
      FROM reviews
      WHERE profile_id = ${profileId}
      ORDER BY date DESC, created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ data: { aggregates, recent } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profileId, reviews } = await req.json();
    if (!profileId || !Array.isArray(reviews)) {
      return NextResponse.json({ error: "Missing profileId or reviews array" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    for (const r of reviews) {
      const { foodName, rating, notes, meal } = r;
      if (!foodName || rating == null) continue;
      const mealVal = meal ?? "other";
      await sql`
        INSERT INTO reviews (profile_id, food_name, rating, notes, date, meal)
        VALUES (${profileId}, ${foodName}, ${rating}, ${notes ?? ""}, ${today}::date, ${mealVal})
        ON CONFLICT (profile_id, food_name, date)
        DO UPDATE SET rating = EXCLUDED.rating, notes = EXCLUDED.notes, meal = EXCLUDED.meal
      `;
    }

    return NextResponse.json({ data: { saved: reviews.length } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");
    const foodName  = req.nextUrl.searchParams.get("foodName");
    if (!profileId) return NextResponse.json({ error: "Missing profileId" }, { status: 400 });

    if (foodName) {
      await sql`DELETE FROM reviews WHERE profile_id = ${profileId} AND food_name = ${foodName}`;
    } else {
      await sql`DELETE FROM reviews WHERE profile_id = ${profileId}`;
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
