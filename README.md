# Terrapin Fuel

> AI-powered UMD dining hall meal planner for fitness goals — built for Terps.

**Eat smart. Train harder.**

---

## What it does

- Scrapes the **real daily UMD dining hall menu** (South Campus, 251 North, Yahentamitsi)
- Filters by your dietary restrictions (Halal, Vegan, Gluten-Free, etc.)
- Uses **Claude AI** to generate a Breakfast / Lunch / Dinner plan optimized for your calorie + protein targets
- **Portion strategy**: AI overestimates calories by ~15-20% so the plan total stays within your budget; if you eat the portions exactly, you'll be slightly under — creating a natural buffer on a cut. Bulking mode targets a minimum rather than a ceiling.
- **Review system**: Rate each food 1–10. Future plans are personalized around your loved and avoided foods.
- **Supplement tracking**: Daily protein shakes / bars subtracted from food targets so nothing is double-counted.
- **Profile system**: Multiple profiles, easy switching, no passwords.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + CSS Variables |
| Backend | Next.js API Routes |
| Database | PostgreSQL via **Neon** serverless |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Scraping | Cheerio (server-side HTML parsing) |

---

## Project Structure

```
terrapin-fuel/
├── sql/
│   └── schema.sql              # Run this in Neon console first
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── profiles/       # CRUD for user profiles
│   │   │   │   └── route.ts
│   │   │   ├── scrape/         # Triggers UMD menu scraping + DB cache
│   │   │   │   └── route.ts
│   │   │   ├── menu/           # Returns cached daily menu
│   │   │   │   └── route.ts
│   │   │   ├── plan/           # AI meal plan generation
│   │   │   │   └── route.ts
│   │   │   └── reviews/        # Food review CRUD
│   │   │       └── route.ts
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Main app (plan/review/history/profile tabs)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx            # Profile selection / login
│   ├── components/
│   │   ├── ui.tsx              # Shared: MacroBadge, MacroBar, Pill, Spinner, etc.
│   │   ├── ProfileForm.tsx     # Profile card + 5-step creation form
│   │   ├── MealPlanView.tsx    # Meal plan display with expandable meals
│   │   ├── ReviewPanel.tsx     # Rate today's food 1-10
│   │   ├── HistoryPanel.tsx    # Food rating history with filters
│   │   └── BottomNav.tsx       # Tab navigation bar
│   ├── lib/
│   │   ├── db.ts               # Neon PostgreSQL client
│   │   ├── scraper.ts          # UMD nutrition.umd.edu Cheerio scraper
│   │   ├── macros.ts           # Mifflin-St Jeor TDEE + goal calculations
│   │   └── ai.ts               # Anthropic API: plan generation + macro calc
│   └── types/
│       └── index.ts            # All shared TypeScript types + constants
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd terrapin-fuel
npm install
```

### 2. Set environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL="postgresql://..."   # From Neon console → Connection String
ANTHROPIC_API_KEY="sk-ant-..."    # From console.anthropic.com
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Run the database schema

In your **Neon console** → SQL Editor, paste and run the contents of `sql/schema.sql`.

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to Use (Beta)

1. **Create a profile** — enter your stats, goal (bulk/cut/maintain), activity level, dietary prefs, supplements
2. **Go to Dashboard** → select your dining hall
3. **Scrape Menu** — click "📥 Scrape Menu Now" to fetch today's real UMD menu (run once per day per dining hall)
4. **Generate Plan** — AI picks the best items for your calorie + protein targets
5. **Eat** — follow the portion tip in the plan
6. **Rate your food** — tap "⭐ Rate Today's Food" and score each item 1-10
7. **Tomorrow** — generate a new plan; AI will prefer your loved foods and avoid disliked ones

---

## Dining Hall Location Numbers

| Hall | URL Parameter |
|---|---|
| South Campus | `locationNum=19` |
| 251 North | `locationNum=51` |
| Yahentamitsi | `locationNum=16` |

---

## UMD Dietary Icon Map

All icons scraped from `https://nutrition.umd.edu/LegendImages/`:

| Icon | Tag | Meaning |
|---|---|---|
| `icons_2016_dairy.gif` | `dairy` | Contains Dairy |
| `icons_2016_egg.gif` | `eggs` | Contains Eggs |
| `icons_2016_gluten.gif` | `gluten` | Contains Gluten |
| `icons_2016_soy.gif` | `soy` | Contains Soy |
| `icons_2016_nuts.gif` | `nuts` | Contains Nuts |
| `icons_2016_sesame.gif` | `sesame` | Contains Sesame |
| `icons_2016_shellfish.gif` | `shellfish` | Contains Shellfish |
| `icons_2016_fish.gif` | `fish` | Contains Fish |
| `icons_2016_vegetarian.gif` | `vegetarian` | Vegetarian |
| `icons_2016_vegan.gif` | `vegan` | Vegan |
| `icons_2022_HalalFriendly.gif` | `halal` | Halal Friendly |
| `icons_2016_locallyGrown.gif` | `locally-grown` | Locally Grown |
| `icons_2016_smartChoice.gif` | `smart-choice` | Smart Choice |

> ℹ️ The scraper reads these icon URLs directly from the menu HTML — no guesswork.

---

## Macro Calculation Logic

**Mifflin-St Jeor BMR:**

$$\text{BMR}_{\text{male}} = 10W + 6.25H - 5A + 5$$
$$\text{BMR}_{\text{female}} = 10W + 6.25H - 5A - 161$$

where $W$ = weight (kg), $H$ = height (cm), $A$ = age.

**TDEE** = $\text{BMR} \times \text{activity multiplier}$

| Activity | Multiplier |
|---|---|
| Sedentary | 1.20 |
| Light (1–3×/wk) | 1.375 |
| Moderate (3–5×/wk) | 1.55 |
| Very Active | 1.725 |

**Goal adjustment:**
- Bulk: $\text{TDEE} + 350$ cal
- Maintain: $\text{TDEE}$
- Cut: $\text{TDEE} - 450$ cal

**Protein target:** $\approx 0.85$ g/lb bodyweight. On a cut, capped at 40% of total calories ÷ 4.

**Supplement subtraction:** Daily supplement calories and protein are subtracted from food-only targets.

---

## Portion Strategy

| Goal | AI Behavior |
|---|---|
| **Bulk** | AI targets AT LEAST the calorie minimum. Full portions — eat everything on the plan. |
| **Cut / Maintain** | AI overestimates each item by ~15–20%. The plan total appears to hit the target, but eating exactly 80% of each portion means you're actually slightly under — building in a buffer without you needing to think about it. |

---

## Production: Automated Scraping (Remove Beta Button)

To run scraping automatically at 4am instead of manually:

**Option A — Vercel Cron (recommended):**
```json
// vercel.json
{
  "crons": [
    { "path": "/api/scrape", "schedule": "0 8 * * *" }
  ]
}
```
> Note: Use `0 8 * * *` UTC = 4am EDT. The cron must be a GET or use a secret header.

**Option B — External cron (cron-job.org):** Call `POST /api/scrape` with `{ "all": true }` at 4am.

Once automated, delete the "BETA: Menu Cache" block from `src/app/dashboard/page.tsx`.

---

## Deployment (Vercel + Neon)

```bash
npm run build
vercel --prod
```

Set the 3 env vars in Vercel dashboard → Settings → Environment Variables.

---

Built with ❤️ for UMD Terps 🐢
