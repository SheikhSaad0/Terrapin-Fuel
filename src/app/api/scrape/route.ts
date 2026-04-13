import { NextRequest, NextResponse } from "next/server";
import { scrapeFullDay } from "@/lib/scraper";
import { sql } from "@/lib/db";
import { DINING_HALLS } from "@/types";

/**
 * POST /api/scrape
 * Body: { locationNum?: number, date?: string (YYYY-MM-DD), all?: boolean }
 *
 * Scrapes UMD dining hall menu for the given date and caches it.
 * - In beta: call manually via the Scrape button.
 * - In production: call via a cron job at 4am daily.
 *
 * If "all" is true, scrapes all 3 dining halls.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dateStr: string = body.date ?? new Date().toISOString().split("T")[0];
    const date = new Date(dateStr + "T12:00:00"); // noon to avoid timezone issues
    const scrapeAll: boolean = body.all === true;

    const targets = scrapeAll
      ? DINING_HALLS
      : DINING_HALLS.filter((h) => body.locationNum ? h.locationNum === body.locationNum : h.locationNum === DINING_HALLS[0].locationNum);

    const results: { hall: string; items: number; error?: string }[] = [];

    for (const hall of targets) {
      try {
        console.log(`[Scraper] Scraping ${hall.label} for ${dateStr}...`);
        const menu = await scrapeFullDay(hall.locationNum, date);

        const total = menu.breakfast.length + menu.lunch.length + menu.dinner.length;

        // Upsert into cached_menus
        await sql`
          INSERT INTO cached_menus (location_num, dining_hall, date, menu_data)
          VALUES (
            ${hall.locationNum},
            ${hall.label},
            ${dateStr}::date,
            ${JSON.stringify(menu)}::jsonb
          )
          ON CONFLICT (location_num, date)
          DO UPDATE SET
            menu_data  = EXCLUDED.menu_data,
            scraped_at = now()
        `;

        results.push({ hall: hall.label, items: total });
        console.log(`[Scraper] Done: ${hall.label} — ${total} items`);
      } catch (e) {
        console.error(`[Scraper] Error for ${hall.label}:`, e);
        results.push({ hall: hall.label, items: 0, error: String(e) });
      }
    }

    return NextResponse.json({ data: { date: dateStr, results } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
