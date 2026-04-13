import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

function rowToProfile(row: Record<string, unknown>) {
  return {
    id:           row.id,
    name:         row.name,
    avatarColor:  row.avatar_color,
    heightFt:     row.height_ft,
    heightIn:     row.height_in,
    weightLbs:    row.weight_lbs,
    age:          row.age,
    sex:          row.sex,
    goal:         row.goal,
    activity:     row.activity,
    dietaryPrefs: row.dietary_prefs ?? [],
    otherPrefs:   row.other_prefs ?? "",
    supplements:  row.supplements ?? [],
    macros: {
      calories: row.target_calories,
      protein:  row.target_protein,
      carbs:    row.target_carbs ?? null,
      fat:      row.target_fat   ?? null,
    },
    weightLog: Array.isArray(row.weight_log) ? row.weight_log : [],
    createdAt: row.created_at,
  };
}

// GET /api/profiles
export async function GET() {
  try {
    const rows = await sql`SELECT * FROM profiles ORDER BY created_at ASC`;
    return NextResponse.json({ data: rows.map(rowToProfile) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/profiles]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/profiles — create new profile
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, avatarColor, heightFt, heightIn, weightLbs, age, sex,
      goal, activity, dietaryPrefs, otherPrefs, supplements, macros, weightLog,
    } = body;

    const prefsArray: string[]  = dietaryPrefs ?? [];
    const suppString: string    = JSON.stringify(supplements ?? []);
    const suppJson              = JSON.parse(suppString);
    const weightLogJson         = JSON.parse(JSON.stringify(weightLog ?? []));

    const rows = await sql`
      INSERT INTO profiles (
        name, avatar_color,
        height_ft, height_in, weight_lbs, age, sex,
        goal, activity,
        dietary_prefs, other_prefs, supplements,
        target_calories, target_protein, target_carbs, target_fat,
        weight_log
      ) VALUES (
        ${name ?? ""},
        ${avatarColor ?? "#CC0033"},
        ${heightFt   ?? null},
        ${heightIn   ?? 0},
        ${weightLbs  ?? null},
        ${age        ?? null},
        ${sex        ?? null},
        ${goal       ?? null},
        ${activity   ?? null},
        ${prefsArray},
        ${otherPrefs ?? ""},
        ${suppJson},
        ${macros?.calories ?? null},
        ${macros?.protein  ?? null},
        ${macros?.carbs    ?? null},
        ${macros?.fat      ?? null},
        ${weightLogJson}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: rowToProfile(rows[0]) }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/profiles]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/profiles?id=xxx — update profile
export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json();
    const {
      name, avatarColor, heightFt, heightIn, weightLbs, age, sex,
      goal, activity, dietaryPrefs, otherPrefs, supplements, macros, weightLog,
    } = body;

    const suppJson       = supplements != null ? JSON.parse(JSON.stringify(supplements)) : null;
    const prefsArray: string[] | null = dietaryPrefs ?? null;
    const weightLogJson  = weightLog != null ? JSON.parse(JSON.stringify(weightLog)) : null;

    const rows = await sql`
      UPDATE profiles SET
        name            = COALESCE(${name         ?? null}, name),
        avatar_color    = COALESCE(${avatarColor  ?? null}, avatar_color),
        height_ft       = COALESCE(${heightFt     ?? null}, height_ft),
        height_in       = COALESCE(${heightIn     ?? null}, height_in),
        weight_lbs      = COALESCE(${weightLbs    ?? null}, weight_lbs),
        age             = COALESCE(${age          ?? null}, age),
        sex             = COALESCE(${sex          ?? null}, sex),
        goal            = COALESCE(${goal         ?? null}, goal),
        activity        = COALESCE(${activity     ?? null}, activity),
        dietary_prefs   = COALESCE(${prefsArray},           dietary_prefs),
        other_prefs     = COALESCE(${otherPrefs   ?? null}, other_prefs),
        supplements     = COALESCE(${suppJson},             supplements),
        target_calories = COALESCE(${macros?.calories ?? null}, target_calories),
        target_protein  = COALESCE(${macros?.protein  ?? null}, target_protein),
        target_carbs    = ${macros != null ? (macros.carbs ?? null) : null},
        target_fat      = ${macros != null ? (macros.fat  ?? null) : null},
        weight_log      = COALESCE(${weightLogJson}, weight_log)
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json({ data: rowToProfile(rows[0]) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/profiles]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/profiles?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await sql`DELETE FROM profiles WHERE id = ${id}`;
    return NextResponse.json({ data: { deleted: true } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/profiles]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
