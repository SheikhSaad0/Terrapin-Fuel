"use client";

import { useState, useEffect } from "react";
import { MealPlan } from "@/types";
import { ratingColor, ratingLabel, Spinner } from "./ui";

interface Props {
  profileId: string;
  plan?: MealPlan | null;
  onBack: () => void;
}

export function ReviewPanel({ profileId, plan: planProp, onBack }: Props) {
  const [plan, setPlan]       = useState<MealPlan | null>(planProp ?? null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes]     = useState<Record<string, string>>({});
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  // If no plan was passed in, try sessionStorage (set when plan is generated)
  useEffect(() => {
    if (!planProp && profileId) {
      const cached = sessionStorage.getItem(`tf:plan:${profileId}`);
      if (cached) { try { setPlan(JSON.parse(cached)); } catch {} }
    }
  }, [profileId, planProp]);

  // Get all unique food items from today's plan
  const allItems: string[] = plan
    ? [
        ...new Set(
          ["breakfast", "lunch", "dinner"].flatMap((m) =>
            (plan.meals[m as keyof typeof plan.meals]?.items ?? []).map((i) => i.name)
          )
        ),
      ]
    : [];

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const reviews = Object.entries(ratings).map(([foodName, rating]) => ({
        foodName,
        rating,
        notes: notes[foodName] ?? "",
      }));
      if (reviews.length === 0) { setError("Rate at least one item first."); setSaving(false); return; }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, reviews }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSaved(true);
      setTimeout(() => onBack(), 1500);
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-5xl">🍽️</div>
        <p className="text-text-muted text-sm text-center">
          Generate a meal plan first — then come back to rate what you ate!
        </p>
        <button onClick={onBack} className="btn-ghost">← Back to Plan</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">←</button>
        <div>
          <h2 className="font-display text-2xl tracking-widest text-text-primary">RATE TODAY'S FOOD</h2>
          <p className="text-xs text-text-muted">Your ratings personalize future meal plans</p>
        </div>
      </div>

      {allItems.map((name) => {
        const rating = ratings[name];
        return (
          <div key={name} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-text-primary">{name}</span>
              {rating != null && (
                <span className="font-display text-lg" style={{ color: ratingColor(rating) }}>
                  {rating}/10 · {ratingLabel(rating)}
                </span>
              )}
            </div>

            {/* Rating buttons 1–10 */}
            <div className="grid grid-cols-10 gap-1">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => {
                const selected = rating === n;
                const col = ratingColor(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatings((r) => ({ ...r, [name]: n }))}
                    className="py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background: selected ? col : "var(--surface-2)",
                      color: selected ? "#fff" : "var(--text-muted)",
                      border: `1px solid ${selected ? col : "var(--surface-3)"}`,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {/* Optional notes */}
            {rating != null && (
              <input
                className="input text-xs"
                placeholder="Notes (optional)..."
                value={notes[name] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [name]: e.target.value }))}
              />
            )}
          </div>
        );
      })}

      {error && <p className="text-sm" style={{ color: "var(--umd-red)" }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving || saved}
        className="btn-primary w-full"
        style={saved ? { background: "#10b981", boxShadow: "0 4px 20px #10b98144" } : {}}
      >
        {saved ? "✓ RATINGS SAVED!" : saving
          ? <span className="flex items-center justify-center gap-2"><Spinner size={18} /> SAVING...</span>
          : "SAVE RATINGS"}
      </button>
    </div>
  );
}
