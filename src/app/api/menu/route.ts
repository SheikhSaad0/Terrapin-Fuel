import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { DailyMenu } from "@/types";

/**
 * GET /api/menu?locationNum=19&date=2026-04-12
 *
 * Returns the cached daily menu for a dining hall.
 * If not yet scraped, returns { data: null } so the frontend
 * can prompt the user to trigger a scrape.
 */
export async function GET(req: NextRequest) {
  try {
    const locationNum = Number(req.nextUrl.searchParams.get("locationNum"));
    const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().split("T")[0];

    if (!locationNum) return NextResponse.json({ error: "Missing locationNum" }, { status: 400 });

    const rows = await sql`
      SELECT menu_data, scraped_at, dining_hall
      FROM cached_menus
      WHERE location_num = ${locationNum}
        AND date = ${date}::date
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ data: null, message: "No menu cached for this date. Use the Scrape button." });
    }

    const row = rows[0];
    return NextResponse.json({
      data: row.menu_data as DailyMenu,
      scrapedAt: row.scraped_at,
      diningHall: row.dining_hall,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
