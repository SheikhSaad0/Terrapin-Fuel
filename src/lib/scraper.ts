/**
 * UMD Dining Menu Scraper — v3
 *
 * Structure discovered from live HTML:
 * - Tab links: <a href="#pane-1">Brunch</a>, <a href="#pane-2">Dinner</a>
 * - Section headers: <h3>Breakfast</h3> or <li class="longmenucategory">
 * - Food items: <li><a href="label.aspx?...">Name</a><img src="LegendImages/..."/></li>
 */

import * as cheerio from "cheerio";
import { MenuItem, DietaryTag, ICON_MAP, DailyMenu } from "@/types";

const BASE_URL = "https://nutrition.umd.edu";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Map any UMD meal label → our three-slot schema
function mealSlot(label: string): "breakfast" | "lunch" | "dinner" {
  const l = label.toLowerCase();
  if (l.includes("breakfast") || l.includes("brunch") || l.includes("morning")) return "breakfast";
  if (l.includes("lunch") || l.includes("noon") || l.includes("midday"))         return "lunch";
  return "dinner";
}

// ─── Fetch nutrition for one item from label.aspx ───────────────────────────
async function fetchNutrition(recNum: string): Promise<{
  calories: number; protein: number; carbs: number; fat: number; servingSize: string;
}> {
  const empty = { calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: "1 serving" };
  try {
    const url = `${BASE_URL}/label.aspx?RecNumAndPort=${encodeURIComponent(recNum)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TerrapinFuel/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return empty;

    const html = await res.text();
    const $    = cheerio.load(html);

    // ── Strategy: regex on the full normalised page text ───────────────────
    // This is the most reliable approach since UMD's table layout varies.
    // We work line-by-line, which avoids concatenation across table cells.
    const lines = $.text()
      .split(/[\n\r]+/)
      .map(l => l.trim())
      .filter(Boolean);

    let calories = 0, protein = 0, carbs = 0, fat = 0;
    let servingSize = "1 serving";

    // Helper: extract the first decimal number from a string
    const firstNum = (s: string): number => {
      const m = s.match(/(\d+\.?\d*)/);
      return m ? parseFloat(m[1]) : 0;
    };

    for (let i = 0; i < lines.length; i++) {
      const line  = lines[i];
      const lower = line.toLowerCase().replace(/\s+/g, " ").trim();

      // Serving size
      if (lower.includes("serving size") && !servingSize.includes("g") && line.length < 80) {
        servingSize = line.replace(/serving size[:\s]*/i, "").trim() || servingSize;
      }

      // Calories: the line is exactly "Calories" and the next line is a number,
      // OR the line starts with "Calories" followed by a number (not "from Fat")
      if (lower === "calories" && calories === 0) {
        const next = firstNum(lines[i + 1] ?? "");
        if (next > 0 && next < 5000) calories = next;
      } else if (
        lower.startsWith("calories") &&
        !lower.includes("from fat") &&
        calories === 0
      ) {
        const n = firstNum(line);
        if (n > 0 && n < 5000) calories = n;
      }

      // Total Fat
      if ((lower.startsWith("total fat") || lower === "fat") && fat === 0) {
        const n = firstNum(line);
        // If number in current line is just %, check next line
        if (n > 0 && n < 500) fat = n;
        else fat = firstNum(lines[i + 1] ?? "");
      }

      // Total Carbohydrate
      if (lower.startsWith("total carbohydrate") && carbs === 0) {
        const n = firstNum(line);
        if (n > 0 && n < 1000) carbs = n;
        else carbs = firstNum(lines[i + 1] ?? "");
      }

      // Protein — UMD sometimes has "Protein" on one line and grams on the next
      if (lower === "protein" && protein === 0) {
        const next = firstNum(lines[i + 1] ?? "");
        if (next > 0 && next < 500) protein = next;
      } else if (lower.startsWith("protein") && protein === 0) {
        const n = firstNum(line);
        if (n > 0 && n < 500) protein = n;
      }
    }

    // ── Fallback: td-based parsing if text scan missed values ─────────────
    if (calories === 0 || protein === 0) {
      $("tr").each((_, row) => {
        const cells = $(row).find("td, th").toArray();
        if (cells.length < 1) return;

        const label = $(cells[0]).text().trim().toLowerCase();
        // Value is either in same cell or next cell
        const rawVal = cells[1] ? $(cells[1]).text().trim() : $(cells[0]).text().trim();
        const num = firstNum(rawVal);

        if (label.startsWith("calories") && !label.includes("from") && num > 0 && num < 5000 && calories === 0) calories = num;
        if (label.startsWith("protein")                              && num > 0 && num < 500  && protein === 0)  protein = num;
        if (label.startsWith("total fat")                           && num > 0 && num < 500  && fat === 0)     fat = num;
        if (label.startsWith("total carb")                         && num > 0 && num < 1000 && carbs === 0)   carbs = num;
      });
    }

    return { calories, protein, carbs, fat, servingSize };
  } catch (e) {
    console.error(`[Scraper] fetchNutrition error for ${recNum}:`, e);
    return empty;
  }
}

// ─── Parse items from one meal pane ─────────────────────────────────────────
function parsePaneItems(
  $: ReturnType<typeof cheerio.load>,
  paneId: string
): { name: string; recNum: string; section: string; tags: DietaryTag[] }[] {
  const items: { name: string; recNum: string; section: string; tags: DietaryTag[] }[] = [];
  const $pane = $(`#${paneId}`);
  if ($pane.length === 0) {
    console.log(`[Scraper] Pane #${paneId} not found in DOM`);
    return items;
  }

  let currentSection = "General";
  const seenRecs = new Set<string>();

  // Walk h3 elements (section headers) and li elements (items) in document order
  $pane.find("h3, li").each((_, el) => {
    const $el     = $(el);
    const tagName = ($el.prop("tagName") as string | undefined)?.toLowerCase() ?? "";

    // ── Section headers ──────────────────────────────────────────────────
    if (tagName === "h3") {
      const t = $el.text().trim();
      if (t) currentSection = t;
      return;
    }

    // ── Category li (used by some UMD pages) ────────────────────────────
    if (
      $el.hasClass("longmenucategory") ||
      $el.hasClass("menusectionname") ||
      $el.hasClass("longmenucategoryname")
    ) {
      const t = $el.text().trim();
      if (t) currentSection = t;
      return;
    }

    // ── Food item li ─────────────────────────────────────────────────────
    const $link = $el.find("a[href*='label.aspx']").first();
    if (!$link.length) return;

    const href     = $link.attr("href") ?? "";
    const name     = $link.text().trim();
    const recMatch = href.match(/RecNumAndPort=([^&"'\s]+)/);
    if (!name || !recMatch) return;

    const recNum = decodeURIComponent(recMatch[1]);
    if (seenRecs.has(recNum)) return; // deduplicate
    seenRecs.add(recNum);

    // ── Dietary tags ─────────────────────────────────────────────────────
    // Tags are img elements inside the same <li> as the food link
    const tags: DietaryTag[] = [];
    const addTags = (imgs: ReturnType<typeof $el.find>) => {
      imgs.each((_, img) => {
        const src      = $(img).attr("src") ?? "";
        const filename = src.split("/").pop() ?? "";
        const t        = ICON_MAP[filename];
        if (t && !tags.includes(t)) tags.push(t);
      });
    };

    // Try: images directly in this li
    addTags($el.find("img"));
    // Try: images that are siblings of the link
    if (tags.length === 0) addTags($link.siblings("img"));
    // Try: images in the next sibling li (some pages put icons in a separate row)
    if (tags.length === 0) addTags($el.next("li").find("img[src*='LegendImages']"));

    items.push({ name, recNum, section: currentSection, tags });
  });

  return items;
}

// ─── Scrape full day for one dining hall ────────────────────────────────────
export async function scrapeFullDay(locationNum: number, date: Date): Promise<DailyMenu> {
  const m   = date.getMonth() + 1;
  const d   = date.getDate();
  const y   = date.getFullYear();
  const url = `${BASE_URL}/?locationNum=${locationNum}&dtdate=${m}/${d}/${y}`;

  console.log(`[Scraper] ► Fetching: ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Menu page HTTP ${res.status} for ${url}`);

  const html = await res.text();
  const $    = cheerio.load(html);

  const totalLinks = $("a[href*='label.aspx']").length;
  console.log(`[Scraper] HTML ${html.length} bytes | label links: ${totalLinks}`);

  // ── Detect meal tabs dynamically ──────────────────────────────────────
  // Tabs look like: <a href="#pane-1">Brunch</a>
  const slots: { paneId: string; slot: "breakfast" | "lunch" | "dinner"; label: string }[] = [];
  const seenPanes = new Set<string>();

  $("a[href^='#pane-']").each((_, el) => {
    const href   = $(el).attr("href") ?? "";
    const paneId = href.slice(1); // strip "#"
    const label  = $(el).text().trim();
    if (!paneId || !label || seenPanes.has(paneId)) return;
    seenPanes.add(paneId);
    slots.push({ paneId, slot: mealSlot(label), label });
    console.log(`[Scraper] Tab: "${label}" → #${paneId} → slot "${mealSlot(label)}"`);
  });

  // ── Parse items from each pane ────────────────────────────────────────
  const bySlot: Record<string, { name: string; recNum: string; section: string; tags: DietaryTag[] }[]> = {
    breakfast: [], lunch: [], dinner: [],
  };

  for (const { paneId, slot, label } of slots) {
    const items = parsePaneItems($, paneId);
    console.log(`[Scraper] #${paneId} "${label}" → ${items.length} items → slot "${slot}"`);
    bySlot[slot].push(...items);
  }

  const total = bySlot.breakfast.length + bySlot.lunch.length + bySlot.dinner.length;

  // ── Fallback: grab all label.aspx links and split into meal slots ─────
  if (total === 0) {
    console.log("[Scraper] No items from panes — using page-wide fallback");
    const all: typeof bySlot.breakfast = [];
    const seen = new Set<string>();

    $("a[href*='label.aspx']").each((_, el) => {
      const $el      = $(el);
      const href     = $el.attr("href") ?? "";
      const name     = $el.text().trim();
      const recMatch = href.match(/RecNumAndPort=([^&"'\s]+)/);
      if (!name || !recMatch || seen.has(recMatch[1])) return;
      seen.add(recMatch[1]);

      const recNum = decodeURIComponent(recMatch[1]);

      // Tags from parent li / siblings
      const tags: DietaryTag[] = [];
      const $li = $el.closest("li");
      $li.find("img").each((_, img) => {
        const src = $(img).attr("src") ?? "";
        const t   = ICON_MAP[src.split("/").pop() ?? ""];
        if (t && !tags.includes(t)) tags.push(t);
      });

      // Section from nearest preceding h3 or category li
      let section = "General";
      $el.parents().each((_, parent) => {
        const prev = $(parent).prevAll("h3, li.longmenucategory, li.menusectionname").first();
        if (prev.length) { section = prev.text().trim(); return false as unknown as void; }
      });

      all.push({ name, recNum, section, tags });
    });

    console.log(`[Scraper] Fallback found ${all.length} total items`);

    // Try to split by detected meal labels from tabs
    if (slots.length === 0 || all.length === 0) {
      const t = Math.ceil(all.length / 3);
      bySlot.breakfast = all.slice(0, t);
      bySlot.lunch     = all.slice(t, t * 2);
      bySlot.dinner    = all.slice(t * 2);
    } else {
      // Rough even split across detected slots
      const slotKeys = slots.map(s => s.slot);
      const chunkSize = Math.ceil(all.length / slotKeys.length);
      slotKeys.forEach((slot, i) => {
        bySlot[slot].push(...all.slice(i * chunkSize, (i + 1) * chunkSize));
      });
    }
  }

  console.log(`[Scraper] Parsed — B:${bySlot.breakfast.length} L:${bySlot.lunch.length} D:${bySlot.dinner.length}`);

  // ── Fetch nutrition for all items in parallel batches ─────────────────
  const enrich = async (
    raw: { name: string; recNum: string; section: string; tags: DietaryTag[] }[]
  ): Promise<MenuItem[]> => {
    const result: MenuItem[] = [];
    for (let i = 0; i < raw.length; i += 5) {
      const batch     = raw.slice(i, i + 5);
      const nutrition = await Promise.all(batch.map(x => fetchNutrition(x.recNum)));
      batch.forEach((item, j) => result.push({ ...item, ...nutrition[j] }));
      if (i + 5 < raw.length) await sleep(120);
    }
    return result;
  };

  const [breakfast, lunch, dinner] = await Promise.all([
    enrich(bySlot.breakfast),
    enrich(bySlot.lunch),
    enrich(bySlot.dinner),
  ]);

  console.log(`[Scraper] Final with nutrition — B:${breakfast.length} L:${lunch.length} D:${dinner.length}`);
  return { breakfast, lunch, dinner };
}