"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Profile, MealPlan, DINING_HALLS } from "@/types";
import { MealPlanView } from "@/components/MealPlanView";
import { ReviewPanel } from "@/components/ReviewPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { BottomNav, DashTab } from "@/components/BottomNav";
import { Spinner, Pill, EmptyState, SectionHeader, MacroBar } from "@/components/ui";

// ─── Profile tab ──────────────────────────────────────────────────────────────
function ProfileTab({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const initials = profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const { macros } = profile;
  const goalEmoji = { bulk: "🏋️", maintain: "⚖️", cut: "⚡" }[profile.goal];

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, var(--umd-red-dark), var(--umd-red))` }}>
        <div className="p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl text-white flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)" }}>
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl text-white tracking-widest">{profile.name}</h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              {profile.heightFt}′{profile.heightIn || 0}″ · {profile.weightLbs} lbs · {profile.age} yrs · {profile.sex}
            </p>
            <div className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
              {goalEmoji} {profile.goal.toUpperCase()} · {profile.activity}
            </div>
          </div>
        </div>
      </div>

      {/* Macro targets */}
      <div className="card p-4">
        <h3 className="font-display text-lg tracking-widest mb-4" style={{ color: "var(--umd-red)" }}>
          DAILY TARGETS (from food)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["🔥 Calories", macros.calories, "var(--umd-gold)"],
            ["💪 Protein",  `${macros.protein}g`, "var(--umd-red)"],
            ["🌾 Carbs",    macros.carbs != null ? `${macros.carbs}g` : "Not tracked", "var(--macro-carbs)"],
            ["🥑 Fat",      macros.fat != null  ? `${macros.fat}g`  : "Not tracked", "var(--macro-fat)"],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="rounded-xl p-3 text-center" style={{ background: "var(--surface-2)" }}>
              <div className="font-display text-xl" style={{ color: c as string }}>{v}</div>
              <div className="text-[10px] text-text-muted mt-0.5">{l}</div>
            </div>
          ))}
        </div>
        {(macros.carbs == null || macros.fat == null) && (
          <p className="text-[11px] text-text-muted mt-3">
            ✱ Only optimizing for calories & protein. Edit your profile to add optional carb/fat targets.
          </p>
        )}
      </div>

      {/* Dietary prefs */}
      {profile.dietaryPrefs.length > 0 && (
        <div className="card p-4">
          <h3 className="font-display text-lg tracking-widest mb-3" style={{ color: "var(--umd-red)" }}>DIETARY FILTERS</h3>
          <div className="flex flex-wrap gap-2">
            {profile.dietaryPrefs.map((p) => (
              <span key={p} className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: "var(--umd-red)15", color: "var(--umd-red)", border: "1px solid var(--umd-red)30" }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Supplements */}
      {profile.supplements.length > 0 && (
        <div className="card p-4">
          <h3 className="font-display text-lg tracking-widest mb-3" style={{ color: "var(--umd-red)" }}>DAILY SUPPLEMENTS</h3>
          <div className="space-y-2">
            {profile.supplements.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2"
                style={{ borderBottom: i < profile.supplements.length - 1 ? "1px solid var(--surface-2)" : "none" }}>
                <span className="text-sm font-medium text-text-primary">{s.name}</span>
                <div className="flex gap-3 text-xs font-bold">
                  <span style={{ color: "var(--umd-red)" }}>{s.protein}g protein</span>
                  <span style={{ color: "var(--umd-gold)" }}>{s.calories} cal</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <button onClick={onLogout} className="btn-ghost w-full text-sm">
        ← Switch Profile
      </button>
    </div>
  );
}

// ─── Plan tab ──────────────────────────────────────────────────────────────────
function PlanTab({
  profile,
  onReviewClick,
}: { profile: Profile; onReviewClick: () => void }) {
  const [locationNum, setLocationNum] = useState<number>(DINING_HALLS[0].locationNum);
  const [diningHall, setDiningHall]   = useState<string>(DINING_HALLS[0].label);
  const [plan, setPlan]               = useState<MealPlan | null>(null);
  const [loading, setLoading]         = useState(false);
  const [scraping, setScraping]       = useState(false);
  const [error, setError]             = useState("");
  const [menuStatus, setMenuStatus]   = useState<"unknown" | "cached" | "missing">("unknown");
  const [scrapedAt, setScrapedAt]     = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  // Check if menu is cached whenever dining hall changes
  useEffect(() => {
    checkMenu(locationNum);
    // Also try to load an existing plan for today
  }, [locationNum]);

  const checkMenu = async (num: number) => {
    try {
      const res = await fetch(`/api/menu?locationNum=${num}&date=${today}`);
      const json = await res.json();
      if (json.data) {
        setMenuStatus("cached");
        setScrapedAt(json.scrapedAt ?? null);
      } else {
        setMenuStatus("missing");
      }
    } catch {
      setMenuStatus("unknown");
    }
  };

  const handleScrape = async () => {
    setScraping(true); setError("");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationNum, date: today }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const result = json.data?.results?.[0];
      if (result?.error) throw new Error(result.error);
      setMenuStatus("cached");
      setScrapedAt(new Date().toISOString());
    } catch (e) {
      setError(`Scrape failed: ${String(e)}`);
    }
    setScraping(false);
  };

  const handleGenerate = async (regenerate = false) => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, locationNum, diningHall, date: today, regenerate }),
      });
      const json = await res.json();
      if (json.error) {
        if (json.noMenu) {
          setMenuStatus("missing");
          throw new Error("No menu scraped for today. Use the button above to fetch it first.");
        }
        throw new Error(json.error);
      }
      const planData = json.data as MealPlan;
      setPlan(planData);
      sessionStorage.setItem(`tf:plan:${profile.id}`, JSON.stringify(planData));
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-display text-3xl tracking-widest text-text-primary">
          🐢 TODAY'S PLAN
        </h2>
        <p className="text-xs text-text-muted mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          {" · "}{profile.name.split(" ")[0]} · {profile.goal}
        </p>
      </div>

      {/* Dining hall picker */}
      <div>
        <label className="label">Dining Hall</label>
        <div className="flex flex-wrap gap-2">
          {DINING_HALLS.map((h) => (
            <Pill key={h.id} label={h.label}
              active={locationNum === h.locationNum}
              onClick={() => {
                setLocationNum(h.locationNum);
                setDiningHall(h.label);
                setPlan(null);
                setError("");
              }}
            />
          ))}
        </div>
      </div>

      {/* ── BETA: Manual Scrape Button ──
          Remove this section once the 4am cron job is set up. */}
      <div className="rounded-xl p-4 border"
        style={{ background: "var(--surface-2)", borderColor: "var(--surface-4)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              🛠 BETA: Menu Cache
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {menuStatus === "cached"
                ? `✅ Menu cached${scrapedAt ? ` · scraped at ${new Date(scrapedAt).toLocaleTimeString()}` : ""}`
                : menuStatus === "missing"
                ? "⚠️ No menu for today yet — scrape it first"
                : "Checking menu status..."}
            </p>
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={{
              background: scraping ? "var(--surface-3)" : "var(--umd-gold)",
              color: scraping ? "var(--text-muted)" : "#000",
              border: "none",
            }}
          >
            {scraping
              ? <span className="flex items-center gap-1.5"><Spinner size={12} /> Scraping...</span>
              : "📥 Scrape Menu Now"}
          </button>
        </div>
      </div>
      {/* ── End Beta Block ── */}

      {/* Generate button */}
      <button
        onClick={() => handleGenerate(!!plan)}
        disabled={loading || menuStatus === "missing"}
        className="btn-primary w-full"
        style={{ fontSize: "20px" }}
      >
        {loading
          ? <span className="flex items-center justify-center gap-2"><Spinner size={20} /> AI IS COOKING...</span>
          : plan ? "🔄 REGENERATE PLAN" : "🤖 GENERATE MEAL PLAN"}
      </button>

      {error && (
        <div className="rounded-xl p-3" style={{ background: "var(--umd-red)12", border: "1px solid var(--umd-red)30" }}>
          <p className="text-sm" style={{ color: "var(--umd-red)" }}>{error}</p>
        </div>
      )}

      {/* Plan */}
      {plan && (
        <MealPlanView
          plan={plan}
          targetCalories={profile.macros.calories}
          targetProtein={profile.macros.protein}
          targetCarbs={profile.macros.carbs}
          targetFat={profile.macros.fat}
          onReview={onReviewClick}
        />
      )}

      {!plan && !loading && !error && (
        <EmptyState
          icon="🤖"
          title="No plan yet"
          body="Select your dining hall, make sure the menu is scraped, then hit Generate to get your personalized meal plan."
        />
      )}
    </div>
  );
}

// ─── Dashboard Shell ──────────────────────────────────────────────────────────
function DashboardContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const profileId    = searchParams.get("profileId");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<DashTab>("plan");
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!profileId) { router.replace("/"); return; }
    fetchProfile(profileId);
  }, [profileId]);

  const fetchProfile = async (id: string) => {
    try {
      const res  = await fetch("/api/profiles");
      const json = await res.json();
      const all: Profile[] = json.data ?? [];
      const found = all.find((p) => p.id === id);
      if (!found) { router.replace("/"); return; }
      setProfile(found);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("tf:activeProfileId");
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">🐢</div>
          <Spinner size={32} />
          <p className="text-text-muted text-sm">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-umd-red mb-4">{error || "Profile not found."}</p>
          <button onClick={() => router.replace("/")} className="btn-ghost">← Back to Profiles</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--surface-0)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(7,7,7,0.95)",
          borderBottom: "1px solid var(--surface-2)",
          backdropFilter: "blur(10px)",
        }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐢</span>
          <span className="font-display text-xl tracking-widest" style={{ color: "var(--umd-red)" }}>
            TERRAPIN FUEL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-display text-sm text-white cursor-pointer"
            style={{ background: profile.avatarColor }}
            onClick={() => setTab("profile")}
          >
            {profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="max-w-lg mx-auto px-4 py-5">
        {tab === "plan" && (
          <PlanTab profile={profile} onReviewClick={() => setTab("review")} />
        )}
        {tab === "review" && (
          <ReviewPanel profileId={profile.id} onBack={() => setTab("plan")} />
        )}
        {tab === "history" && (
          <div className="space-y-4">
            <SectionHeader title="FOOD HISTORY" subtitle="Your taste profile over time" />
            <HistoryPanel profileId={profile.id} />
          </div>
        )}
        {tab === "profile" && (
          <ProfileTab profile={profile} onLogout={handleLogout} />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <Spinner size={40} />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
