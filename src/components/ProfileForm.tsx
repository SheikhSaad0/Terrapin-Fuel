"use client";

import { useState } from "react";
import { Profile, Supplement, MacroTargets, DIETARY_PREF_OPTIONS, DietaryTag } from "@/types";
import { Pill, Spinner } from "./ui";

const AVATAR_COLORS = [
  "#CC0033", "#ff6b35", "#f59e0b", "#10b981",
  "#06b6d4", "#6366f1", "#8b5cf6", "#ec4899",
];

const GOALS = [
  { id: "bulk",     label: "Bulk",     emoji: "🏋️", desc: "+350 cal surplus" },
  { id: "maintain", label: "Maintain", emoji: "⚖️", desc: "TDEE maintenance" },
  { id: "cut",      label: "Cut",      emoji: "⚡", desc: "-450 cal deficit" },
] as const;

const ACTIVITIES = [
  { id: "sedentary", label: "Sedentary",        desc: "Little/no exercise" },
  { id: "light",     label: "Light (1–3×/wk)",  desc: "Light workouts" },
  { id: "moderate",  label: "Moderate (3–5×/wk)", desc: "Gym or sport 3–5 days" },
  { id: "active",    label: "Very Active",       desc: "Daily sport or physical job" },
] as const;

// ─── Blank form state ──────────────────────────────────────────────────────────
function blankForm() {
  return {
    name: "",
    avatarColor: AVATAR_COLORS[0],
    heightFt: "",
    heightIn: "",
    weightLbs: "",
    age: "",
    sex: "male" as "male" | "female",
    goal: "bulk" as "bulk" | "maintain" | "cut",
    activity: "moderate" as "sedentary" | "light" | "moderate" | "active",
    dietaryPrefs: [] as DietaryTag[],
    otherPrefs: "",
    supplements: [] as Supplement[],
    useAIMacros: true,
    calories: "",
    protein: "",
    carbs: "",   // optional
    fat: "",     // optional
  };
}

// ─── Profile Card ─────────────────────────────────────────────────────────────
export function ProfileCard({
  profile,
  active,
  onSelect,
  onDelete,
}: {
  profile: Profile;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const initials = profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const goalEmoji = { bulk: "🏋️", maintain: "⚖️", cut: "⚡" }[profile.goal];

  return (
    <div
      className="card card-hover cursor-pointer transition-all duration-200 p-4 flex items-center gap-4"
      style={{ borderColor: active ? "var(--umd-red)" : undefined, boxShadow: active ? "0 0 0 1px var(--umd-red)" : undefined }}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl text-white flex-shrink-0"
        style={{ background: profile.avatarColor }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary truncate">{profile.name}</span>
          {active && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--umd-red)", color: "#fff" }}>
              Active
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{goalEmoji} {profile.goal}</span>
          <span>·</span>
          <span>{profile.macros.calories} cal / {profile.macros.protein}g protein</span>
          {profile.dietaryPrefs.length > 0 && (
            <>
              <span>·</span>
              <span>{profile.dietaryPrefs.slice(0, 2).join(", ")}{profile.dietaryPrefs.length > 2 ? ` +${profile.dietaryPrefs.length - 2}` : ""}</span>
            </>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-text-muted hover:text-umd-red transition-colors text-lg flex-shrink-0 p-1"
        title="Delete profile"
      >
        ×
      </button>
    </div>
  );
}

// ─── Profile Creation / Edit Form ─────────────────────────────────────────────
export function ProfileForm({
  onSave,
  onCancel,
}: {
  onSave: (profile: Omit<Profile, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blankForm());
  const [suppInput, setSuppInput] = useState({ name: "", protein: "", calories: "" });
  const [macroResult, setMacroResult] = useState<{ macros: MacroTargets; explanation: string } | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const up = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const togglePref = (p: DietaryTag) =>
    up("dietaryPrefs", form.dietaryPrefs.includes(p)
      ? form.dietaryPrefs.filter((x) => x !== p)
      : [...form.dietaryPrefs, p]);

  const addSupp = () => {
    if (!suppInput.name) return;
    up("supplements", [...form.supplements, {
      name: suppInput.name,
      protein: Number(suppInput.protein) || 0,
      calories: Number(suppInput.calories) || 0,
    }]);
    setSuppInput({ name: "", protein: "", calories: "" });
  };

  const calcMacros = async () => {
    setCalcLoading(true); setError("");
    try {
      const params = new URLSearchParams({
        heightFt: form.heightFt, heightIn: form.heightIn || "0",
        weightLbs: form.weightLbs, age: form.age,
        sex: form.sex, goal: form.goal, activity: form.activity,
        supplements: JSON.stringify(form.supplements),
      });
      const res = await fetch(`/api/plan?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMacroResult(json.data);
    } catch (e) {
      setError(`Calculation failed: ${e}`);
    }
    setCalcLoading(false);
  };

  const canAdvance = [
    !!form.name && !!form.heightFt && !!form.weightLbs && !!form.age,
    !!form.goal && !!form.activity,
    true, // dietary prefs optional
    true, // supplements optional
    form.useAIMacros ? !!macroResult : (!!form.calories && !!form.protein),
  ];

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const macros: MacroTargets = form.useAIMacros && macroResult
        ? macroResult.macros
        : {
            calories: Number(form.calories),
            protein:  Number(form.protein),
            carbs:    form.carbs ? Number(form.carbs) : null,
            fat:      form.fat  ? Number(form.fat)  : null,
          };

      await onSave({
        name: form.name.trim(),
        avatarColor: form.avatarColor,
        heightFt: Number(form.heightFt),
        heightIn: Number(form.heightIn) || 0,
        weightLbs: Number(form.weightLbs),
        age: Number(form.age),
        sex: form.sex,
        goal: form.goal,
        activity: form.activity,
        dietaryPrefs: form.dietaryPrefs,
        otherPrefs: form.otherPrefs,
        supplements: form.supplements,
        macros,
      });
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  const STEPS = ["About You", "Your Goal", "Diet", "Supplements", "Macros"];

  return (
    <div className="animate-fade-in">
      {/* Step indicator */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="h-1 w-full rounded-full transition-all duration-300"
              style={{ background: i <= step ? "var(--umd-red)" : "var(--surface-3)" }}
            />
            <span className="text-[10px] font-medium hidden sm:block"
              style={{ color: i === step ? "var(--umd-red)" : "var(--text-muted)" }}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* ── Step 0: Basic Info ── */}
      {step === 0 && (
        <div className="space-y-4 animate-slide-up">
          <h3 className="font-display text-2xl tracking-widest text-text-primary">WHO ARE YOU?</h3>
          <p className="text-sm text-text-muted">Build your profile to unlock personalized meal plans.</p>

          {/* Avatar color */}
          <div>
            <label className="label">Profile Color</label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => up("avatarColor", c)}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    boxShadow: form.avatarColor === c ? `0 0 0 2px var(--surface-1), 0 0 0 4px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Full Name</label>
            <input className="input" placeholder="e.g. Alex Smith" value={form.name}
              onChange={(e) => up("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Height (ft)</label>
              <input className="input" type="number" min="4" max="7" placeholder="6"
                value={form.heightFt} onChange={(e) => up("heightFt", e.target.value)} />
            </div>
            <div>
              <label className="label">Height (in)</label>
              <input className="input" type="number" min="0" max="11" placeholder="2"
                value={form.heightIn} onChange={(e) => up("heightIn", e.target.value)} />
            </div>
            <div>
              <label className="label">Weight (lbs)</label>
              <input className="input" type="number" placeholder="175"
                value={form.weightLbs} onChange={(e) => up("weightLbs", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Age</label>
              <input className="input" type="number" min="16" max="60" placeholder="20"
                value={form.age} onChange={(e) => up("age", e.target.value)} />
            </div>
            <div>
              <label className="label">Biological Sex</label>
              <select className="input" value={form.sex}
                onChange={(e) => up("sex", e.target.value as "male" | "female")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Goal + Activity ── */}
      {step === 1 && (
        <div className="space-y-5 animate-slide-up">
          <h3 className="font-display text-2xl tracking-widest text-text-primary">YOUR GOAL</h3>
          <div>
            <label className="label">Physique Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {GOALS.map((g) => (
                <button key={g.id} type="button" onClick={() => up("goal", g.id)}
                  className="p-4 rounded-xl border-2 text-center transition-all duration-150 cursor-pointer"
                  style={{
                    borderColor: form.goal === g.id ? "var(--umd-red)" : "var(--surface-3)",
                    background: form.goal === g.id ? "var(--umd-red)18" : "var(--surface-2)",
                  }}>
                  <div className="text-2xl mb-1">{g.emoji}</div>
                  <div className="font-display text-lg tracking-wide"
                    style={{ color: form.goal === g.id ? "var(--umd-red)" : "var(--text-secondary)" }}>
                    {g.label}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Activity Level</label>
            <div className="space-y-2">
              {ACTIVITIES.map((a) => (
                <button key={a.id} type="button" onClick={() => up("activity", a.id)}
                  className="w-full p-3 rounded-xl border-2 text-left transition-all cursor-pointer"
                  style={{
                    borderColor: form.activity === a.id ? "var(--umd-red)" : "var(--surface-3)",
                    background: form.activity === a.id ? "var(--umd-red)10" : "var(--surface-2)",
                  }}>
                  <div className="font-semibold text-sm"
                    style={{ color: form.activity === a.id ? "var(--umd-red)" : "var(--text-primary)" }}>
                    {a.label}
                  </div>
                  <div className="text-xs text-text-muted">{a.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Dietary Prefs ── */}
      {step === 2 && (
        <div className="space-y-4 animate-slide-up">
          <h3 className="font-display text-2xl tracking-widest text-text-primary">DIETARY PREFS</h3>
          <p className="text-sm text-text-muted">
            Select your dietary restrictions. AI will only show you compatible items.
          </p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_PREF_OPTIONS.map((p) => (
              <Pill key={p.id} label={p.label} emoji={p.emoji}
                active={form.dietaryPrefs.includes(p.id)}
                onClick={() => togglePref(p.id)} />
            ))}
          </div>
          <div>
            <label className="label">Other notes / allergies</label>
            <textarea className="input min-h-[80px] resize-y" placeholder="e.g. No shellfish, love high-protein options..."
              value={form.otherPrefs} onChange={(e) => up("otherPrefs", e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Step 3: Supplements ── */}
      {step === 3 && (
        <div className="space-y-4 animate-slide-up">
          <h3 className="font-display text-2xl tracking-widest text-text-primary">SUPPLEMENTS</h3>
          <p className="text-sm text-text-muted">
            Add daily protein shakes, bars, or anything else you take outside the dining hall.
            We'll subtract these from your food targets so the AI doesn't double-count.
          </p>
          <div className="grid grid-cols-[1fr_68px_68px_40px] gap-2 items-end">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Fairlife shake" value={suppInput.name}
                onChange={(e) => setSuppInput((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Protein (g)</label>
              <input className="input" type="number" placeholder="30" value={suppInput.protein}
                onChange={(e) => setSuppInput((s) => ({ ...s, protein: e.target.value }))} />
            </div>
            <div>
              <label className="label">Calories</label>
              <input className="input" type="number" placeholder="170" value={suppInput.calories}
                onChange={(e) => setSuppInput((s) => ({ ...s, calories: e.target.value }))} />
            </div>
            <button type="button" onClick={addSupp}
              className="h-[42px] w-full flex items-center justify-center rounded-lg text-white font-bold text-xl"
              style={{ background: "var(--umd-red)" }}>
              +
            </button>
          </div>
          {form.supplements.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-6">
              No supplements added — skip this step if you don't take any.
            </p>
          ) : (
            <div className="space-y-2">
              {form.supplements.map((s, i) => (
                <div key={i} className="card flex items-center justify-between p-3 gap-3">
                  <span className="text-sm font-medium text-text-primary truncate">{s.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold" style={{ color: "var(--umd-red)" }}>{s.protein}g P</span>
                    <span className="text-xs font-bold" style={{ color: "var(--umd-gold)" }}>{s.calories} cal</span>
                    <button onClick={() => up("supplements", form.supplements.filter((_, j) => j !== i))}
                      className="text-text-muted hover:text-umd-red text-lg transition-colors">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Macro Targets ── */}
      {step === 4 && (
        <div className="space-y-4 animate-slide-up">
          <h3 className="font-display text-2xl tracking-widest text-text-primary">MACRO TARGETS</h3>
          <p className="text-sm text-text-muted">
            Set your daily food targets. <strong className="text-text-secondary">Calories and protein are the main goals</strong> — carbs and fat are optional tracking numbers.
          </p>

          {/* Toggle */}
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((ai) => (
              <button key={String(ai)} type="button" onClick={() => up("useAIMacros", ai)}
                className="py-3 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer"
                style={{
                  borderColor: form.useAIMacros === ai ? "var(--umd-red)" : "var(--surface-3)",
                  background: form.useAIMacros === ai ? "var(--umd-red)18" : "var(--surface-2)",
                  color: form.useAIMacros === ai ? "var(--umd-red)" : "var(--text-muted)",
                }}>
                {ai ? "🤖 AI Calculate" : "✏️ Enter Manually"}
              </button>
            ))}
          </div>

          {form.useAIMacros ? (
            <>
              <button type="button" onClick={calcMacros} disabled={calcLoading}
                className="btn-primary w-full" style={{ fontSize: "20px" }}>
                {calcLoading ? <span className="flex items-center justify-center gap-2"><Spinner size={18} /> CALCULATING...</span>
                  : macroResult ? "✓ RECALCULATE" : "CALCULATE MY MACROS"}
              </button>
              {error && <p className="text-sm" style={{ color: "var(--umd-red)" }}>{error}</p>}
              {macroResult && (
                <div className="card p-4 space-y-3 animate-slide-up">
                  <p className="text-xs text-text-muted leading-relaxed">{macroResult.explanation}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["🔥 Calories", macroResult.macros.calories, "var(--umd-gold)"],
                      ["💪 Protein",  `${macroResult.macros.protein}g`, "var(--umd-red)"],
                      ["🌾 Carbs",    macroResult.macros.carbs != null ? `${macroResult.macros.carbs}g` : "—", "var(--macro-carbs)"],
                      ["🥑 Fat",      macroResult.macros.fat != null ? `${macroResult.macros.fat}g` : "—", "var(--macro-fat)"],
                    ].map(([l, v, c]) => (
                      <div key={String(l)} className="rounded-lg p-3 text-center" style={{ background: "var(--surface-2)" }}>
                        <div className="font-display text-xl" style={{ color: c as string }}>{v}</div>
                        <div className="text-[10px] text-text-muted mt-0.5">{l}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-text-muted">
                    ✱ Carbs & fat are rough estimates for reference. AI optimizes your plan for <strong>calories + protein</strong>.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">🔥 Calories / day <span style={{ color: "var(--umd-red)" }}>*</span></label>
                  <input className="input" type="number" placeholder="2500"
                    value={form.calories} onChange={(e) => up("calories", e.target.value)} />
                </div>
                <div>
                  <label className="label">💪 Protein (g) <span style={{ color: "var(--umd-red)" }}>*</span></label>
                  <input className="input" type="number" placeholder="175"
                    value={form.protein} onChange={(e) => up("protein", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">🌾 Carbs (g) <span className="text-text-muted font-normal">optional</span></label>
                  <input className="input" type="number" placeholder="leave blank"
                    value={form.carbs} onChange={(e) => up("carbs", e.target.value)} />
                </div>
                <div>
                  <label className="label">🥑 Fat (g) <span className="text-text-muted font-normal">optional</span></label>
                  <input className="input" type="number" placeholder="leave blank"
                    value={form.fat} onChange={(e) => up("fat", e.target.value)} />
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                ✱ AI optimizes for calories & protein. Carbs and fat are optional — leave blank if you're not tracking them.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Nav buttons */}
      {error && step !== 4 && <p className="text-sm mt-2" style={{ color: "var(--umd-red)" }}>{error}</p>}
      <div className="flex gap-3 mt-6">
        <button type="button" onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          className="btn-ghost flex-1">
          {step === 0 ? "Cancel" : "← Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => canAdvance[step] && setStep((s) => s + 1)}
            className="btn-primary flex-[2]" disabled={!canAdvance[step]}>
            NEXT →
          </button>
        ) : (
          <button type="button" onClick={handleSave}
            className="btn-primary flex-[2]" disabled={!canAdvance[step] || saving}>
            {saving ? <span className="flex items-center justify-center gap-2"><Spinner size={18} /> SAVING...</span> : "🐢 CREATE PROFILE"}
          </button>
        )}
      </div>
    </div>
  );
}
