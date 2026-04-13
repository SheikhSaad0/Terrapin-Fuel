"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Profile, MealPlan, DailyMenu, WeightEntry, DINING_HALLS } from "@/types";
import { MealPlanView } from "@/components/MealPlanView";
import { ReviewPanel } from "@/components/ReviewPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { MenuViewer } from "@/components/MenuViewer";
import { BottomNav, DashTab } from "@/components/BottomNav";
import { Spinner, Pill, EmptyState, SectionHeader } from "@/components/ui";

// ─── Weight Chart ─────────────────────────────────────────────────────────────
function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const W = 300, H = 80, PAD = 10;
  const weights = entries.map((e) => e.weight);
  const minW = Math.min(...weights) - 3;
  const maxW = Math.max(...weights) + 3;
  const range = maxW - minW || 1;

  const pts = entries.map((e, i) => {
    const x = PAD + (i / Math.max(entries.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((e.weight - minW) / range) * (H - PAD * 2);
    return { x, y, entry: e };
  });

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fill     = `${PAD},${H} ${polyline} ${W - PAD},${H}`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#CC0033" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#CC0033" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((t) => {
          const y = PAD + t * (H - PAD * 2);
          return (
            <line key={t} x1={PAD} y1={y} x2={W - PAD} y2={y}
              stroke="var(--surface-3)" strokeWidth="1" strokeDasharray="4 4" />
          );
        })}
        {/* Gradient fill */}
        <polygon points={fill} fill="url(#wg)" />
        {/* Line */}
        <polyline points={polyline} fill="none"
          stroke="var(--umd-red)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5}
            fill="var(--umd-red)" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-text-muted mt-1 px-1">
        <span>{new Date(entries[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <span className="font-bold" style={{ color: "var(--umd-red)" }}>
          {entries[entries.length - 1].weight} lbs
        </span>
        <span>{new Date(entries[entries.length - 1].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}

// ─── Profile tab ──────────────────────────────────────────────────────────────
function ProfileTab({
  profile,
  onLogout,
  onProfileUpdate,
}: {
  profile: Profile;
  onLogout: () => void;
  onProfileUpdate: (p: Profile) => void;
}) {
  const [localProfile, setLocalProfile]   = useState(profile);
  const [editMode, setEditMode]           = useState(false);
  const [editForm, setEditForm]           = useState({
    name: profile.name, age: String(profile.age),
    weightLbs: String(profile.weightLbs), goal: profile.goal, activity: profile.activity,
  });
  const [saving, setSaving]               = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weightInput, setWeightInput]     = useState("");
  const [weightSaving, setWeightSaving]   = useState(false);

  useEffect(() => { setLocalProfile(profile); }, [profile]);

  const initials = localProfile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const { macros } = localProfile;
  const goalEmoji = { bulk: "🏋️", maintain: "⚖️", cut: "⚡" }[localProfile.goal];

  const handleEditSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles?id=${localProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      editForm.name,
          age:       Number(editForm.age),
          weightLbs: Number(editForm.weightLbs),
          goal:      editForm.goal,
          activity:  editForm.activity,
        }),
      });
      const json = await res.json();
      if (!json.error) {
        setLocalProfile(json.data);
        onProfileUpdate(json.data);
        setEditMode(false);
      }
    } catch {}
    setSaving(false);
  };

  const handleLogWeight = async () => {
    const w = Number(weightInput);
    if (!w || w < 50 || w > 600) return;
    setWeightSaving(true);
    const today   = new Date().toISOString().split("T")[0];
    const existing = localProfile.weightLog ?? [];
    const newLog  = [
      ...existing.filter((e) => e.date !== today),
      { date: today, weight: w },
    ].sort((a, b) => a.date.localeCompare(b.date));

    try {
      const res = await fetch(`/api/profiles?id=${localProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightLog: newLog }),
      });
      const json = await res.json();
      if (!json.error) {
        setLocalProfile(json.data);
        onProfileUpdate(json.data);
        setShowWeightInput(false);
        setWeightInput("");
      }
    } catch {}
    setWeightSaving(false);
  };

  const GOALS     = ["bulk", "maintain", "cut"] as const;
  const ACTIVITIES = ["sedentary", "light", "moderate", "active"] as const;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Hero card or edit form */}
      {editMode ? (
        <div className="card p-5 space-y-4 animate-fade-in">
          <h3 className="font-display text-xl tracking-wide">Edit Profile</h3>

          <div>
            <label className="label">Name</label>
            <input className="input" value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Age</label>
              <input className="input" type="number" value={editForm.age}
                onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value }))} />
            </div>
            <div>
              <label className="label">Weight (lbs)</label>
              <input className="input" type="number" value={editForm.weightLbs}
                onChange={(e) => setEditForm((f) => ({ ...f, weightLbs: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Goal</label>
            <div className="flex gap-2">
              {GOALS.map((g) => (
                <button key={g} type="button"
                  onClick={() => setEditForm((f) => ({ ...f, goal: g }))}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize cursor-pointer"
                  style={{
                    background: editForm.goal === g ? "var(--umd-red)" : "var(--surface-2)",
                    color:      editForm.goal === g ? "#fff" : "var(--text-muted)",
                    border:     `1px solid ${editForm.goal === g ? "var(--umd-red)" : "var(--surface-3)"}`,
                  }}>
                  {g === "bulk" ? "🏋️ Bulk" : g === "maintain" ? "⚖️ Maintain" : "⚡ Cut"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Activity Level</label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITIES.map((a) => (
                <button key={a} type="button"
                  onClick={() => setEditForm((f) => ({ ...f, activity: a }))}
                  className="py-2 rounded-lg text-xs font-semibold capitalize cursor-pointer"
                  style={{
                    background: editForm.activity === a ? "var(--umd-red)" : "var(--surface-2)",
                    color:      editForm.activity === a ? "#fff" : "var(--text-muted)",
                    border:     `1px solid ${editForm.activity === a ? "var(--umd-red)" : "var(--surface-3)"}`,
                  }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleEditSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="flex items-center justify-center gap-2"><Spinner size={16} /> Saving...</span> : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: `linear-gradient(135deg, var(--umd-red-dark), var(--umd-red))` }}>
          <div className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl text-white flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)" }}>
              {initials}
            </div>
            <div className="flex-1">
              <h2 className="font-display text-2xl text-white tracking-wide">{localProfile.name}</h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                {localProfile.heightFt}′{localProfile.heightIn || 0}″ · {localProfile.weightLbs} lbs · {localProfile.age} yrs · {localProfile.sex}
              </p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                {goalEmoji} {localProfile.goal.toUpperCase()} · {localProfile.activity}
              </div>
            </div>
            <button
              onClick={() => {
                setEditForm({
                  name: localProfile.name, age: String(localProfile.age),
                  weightLbs: String(localProfile.weightLbs),
                  goal: localProfile.goal, activity: localProfile.activity,
                });
                setEditMode(true);
              }}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              ✏️ Edit
            </button>
          </div>
        </div>
      )}

      {/* Macro targets */}
      <div className="card p-4">
        <h3 className="font-display text-lg tracking-wide mb-4" style={{ color: "var(--umd-red)" }}>
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

      {/* Weight log */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg tracking-wide" style={{ color: "var(--umd-red)" }}>
            WEIGHT LOG
          </h3>
          <button
            onClick={() => setShowWeightInput((s) => !s)}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            + Log Weight
          </button>
        </div>

        {showWeightInput && (
          <div className="flex gap-2 mb-4 animate-fade-in">
            <input
              className="input flex-1"
              type="number"
              placeholder="Enter weight (lbs)"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogWeight()}
              autoFocus
            />
            <button
              onClick={handleLogWeight}
              disabled={weightSaving}
              className="btn-primary px-4"
              style={{ fontSize: 14, padding: "10px 16px" }}
            >
              {weightSaving ? <Spinner size={16} /> : "Log"}
            </button>
          </div>
        )}

        {localProfile.weightLog && localProfile.weightLog.length >= 2 ? (
          <WeightChart entries={localProfile.weightLog.slice(-30)} />
        ) : localProfile.weightLog && localProfile.weightLog.length === 1 ? (
          <div className="text-center py-3">
            <p className="text-xs text-text-muted">
              Current: <span className="font-bold" style={{ color: "var(--umd-red)" }}>
                {localProfile.weightLog[0].weight} lbs
              </span>
            </p>
            <p className="text-xs text-text-muted mt-1">Log one more entry to see your chart.</p>
          </div>
        ) : (
          <p className="text-xs text-text-muted text-center py-4">
            Start logging your weight to track your progress over time.
          </p>
        )}
      </div>

      {/* Dietary prefs */}
      {localProfile.dietaryPrefs.length > 0 && (
        <div className="card p-4">
          <h3 className="font-display text-lg tracking-wide mb-3" style={{ color: "var(--umd-red)" }}>DIETARY FILTERS</h3>
          <div className="flex flex-wrap gap-2">
            {localProfile.dietaryPrefs.map((p) => (
              <span key={p} className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: "var(--umd-red)15", color: "var(--umd-red)", border: "1px solid var(--umd-red)30" }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Supplements */}
      {localProfile.supplements.length > 0 && (
        <div className="card p-4">
          <h3 className="font-display text-lg tracking-wide mb-3" style={{ color: "var(--umd-red)" }}>DAILY SUPPLEMENTS</h3>
          <div className="space-y-2">
            {localProfile.supplements.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2"
                style={{ borderBottom: i < localProfile.supplements.length - 1 ? "1px solid var(--surface-2)" : "none" }}>
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
  onProfileUpdate,
}: {
  profile: Profile;
  onReviewClick: () => void;
  onProfileUpdate: (p: Profile) => void;
}) {
  const [locationNum, setLocationNum]     = useState<number>(DINING_HALLS[0].locationNum);
  const [diningHall, setDiningHall]       = useState<string>(DINING_HALLS[0].label);
  const [plan, setPlan]                   = useState<MealPlan | null>(null);
  const [menu, setMenu]                   = useState<DailyMenu | null>(null);
  const [showMenu, setShowMenu]           = useState(false);
  const [cuisinePreference, setCuisinePreference] = useState("");
  const [loading, setLoading]             = useState(false);
  const [scraping, setScraping]           = useState(false);
  const [error, setError]                 = useState("");
  const [menuStatus, setMenuStatus]       = useState<"unknown" | "cached" | "missing">("unknown");
  const [scrapedAt, setScrapedAt]         = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    checkMenu(locationNum);
  }, [locationNum]);

  const checkMenu = async (num: number) => {
    try {
      const res  = await fetch(`/api/menu?locationNum=${num}&date=${today}`);
      const json = await res.json();
      if (json.data) {
        setMenuStatus("cached");
        setScrapedAt(json.scrapedAt ?? null);
        setMenu(json.data as DailyMenu);
      } else {
        setMenuStatus("missing");
        setMenu(null);
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
      // Fetch and store menu data
      const menuRes  = await fetch(`/api/menu?locationNum=${locationNum}&date=${today}`);
      const menuJson = await menuRes.json();
      if (menuJson.data) setMenu(menuJson.data as DailyMenu);
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
        body: JSON.stringify({
          profileId: profile.id, locationNum, diningHall, date: today, regenerate,
          cuisinePreference: cuisinePreference.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) {
        if (json.noMenu) { setMenuStatus("missing"); }
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

  const handlePlanUpdated = (updated: MealPlan) => {
    setPlan(updated);
    sessionStorage.setItem(`tf:plan:${profile.id}`, JSON.stringify(updated));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-display text-3xl tracking-wide text-text-primary">
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
                setMenu(null);
                setShowMenu(false);
                setError("");
              }}
            />
          ))}
        </div>
      </div>

      {/* Cuisine preference input */}
      <div>
        <label className="label">What are you feeling today? (optional)</label>
        <input
          className="input"
          placeholder="e.g. Indian, Asian, high protein, pasta, comfort food..."
          value={cuisinePreference}
          onChange={(e) => setCuisinePreference(e.target.value)}
        />
      </div>

      {/* BETA: Manual Scrape Button */}
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
              color:      scraping ? "var(--text-muted)" : "#000",
              border:     "none",
            }}
          >
            {scraping
              ? <span className="flex items-center gap-1.5"><Spinner size={12} /> Scraping...</span>
              : "📥 Scrape Menu Now"}
          </button>
        </div>
      </div>

      {/* View Full Menu toggle */}
      {menuStatus === "cached" && menu && (
        <button
          onClick={() => setShowMenu((s) => !s)}
          className="btn-ghost w-full text-sm"
        >
          {showMenu ? "▲ Hide Menu" : "📋 View Full Menu"}
        </button>
      )}
      {showMenu && menu && <MenuViewer menu={menu} />}

      {/* Generate button */}
      <button
        onClick={() => handleGenerate(!!plan)}
        disabled={loading || menuStatus === "missing"}
        className="btn-primary w-full"
        style={{ fontSize: "16px" }}
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
          profileId={profile.id}
          locationNum={locationNum}
          diningHall={diningHall}
          targetCalories={profile.macros.calories}
          targetProtein={profile.macros.protein}
          targetCarbs={profile.macros.carbs}
          targetFat={profile.macros.fat}
          onReview={onReviewClick}
          onPlanUpdated={handlePlanUpdated}
        />
      )}

      {!plan && !loading && !error && (
        <EmptyState
          icon="🤖"
          title="No plan yet"
          body="Select your dining hall, optionally pick a cuisine, make sure the menu is scraped, then hit Generate."
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
          background:     "rgba(7,7,7,0.95)",
          borderBottom:   "1px solid var(--surface-2)",
          backdropFilter: "blur(10px)",
        }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐢</span>
          <span className="font-display text-xl tracking-wide" style={{ color: "var(--umd-red)" }}>
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
      {/* Gradient bar below header */}
      <div className="header-gradient-bar" />

      {/* Tab content */}
      <main className="max-w-lg mx-auto px-4 py-5">
        {tab === "plan" && (
          <PlanTab
            profile={profile}
            onReviewClick={() => setTab("review")}
            onProfileUpdate={(p) => setProfile(p)}
          />
        )}
        {tab === "review" && (
          <ReviewPanel profileId={profile.id} onBack={() => setTab("plan")} />
        )}
        {tab === "history" && (
          <div className="space-y-4">
            <SectionHeader title="FOOD HISTORY" subtitle="Your diary by date" />
            <HistoryPanel profileId={profile.id} />
          </div>
        )}
        {tab === "profile" && (
          <ProfileTab
            profile={profile}
            onLogout={handleLogout}
            onProfileUpdate={(p) => setProfile(p)}
          />
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
