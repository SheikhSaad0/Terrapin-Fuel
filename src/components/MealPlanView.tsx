"use client";

import { useState } from "react";
import { MealPlan } from "@/types";
import { MacroBadge, MacroBar, Spinner } from "./ui";

const MEAL_META = {
  breakfast: { icon: "🌅", label: "BREAKFAST", color: "#f59e0b" },
  lunch:     { icon: "☀️", label: "LUNCH",     color: "#10b981" },
  dinner:    { icon: "🌙", label: "DINNER",     color: "#6366f1" },
} as const;

type MealKey = keyof typeof MEAL_META;

interface Props {
  plan:            MealPlan;
  profileId:       string;
  locationNum:     number;
  diningHall:      string;
  targetCalories:  number;
  targetProtein:   number;
  targetCarbs:     number | null;
  targetFat:       number | null;
  onReview:        () => void;
  onPlanUpdated:   (plan: MealPlan) => void;
}

export function MealPlanView({
  plan, profileId, locationNum, diningHall,
  targetCalories, targetProtein, targetCarbs, targetFat,
  onReview, onPlanUpdated,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    breakfast: true, lunch: false, dinner: false,
  });
  const [editInstruction, setEditInstruction] = useState("");
  const [editLoading, setEditLoading]         = useState(false);
  const [editError, setEditError]             = useState("");

  const toggle = (meal: string) => setExpanded((e) => ({ ...e, [meal]: !e[meal] }));

  const handleRemake = async () => {
    if (!editInstruction.trim()) return;
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          locationNum,
          diningHall,
          date:            plan.date,
          regenerate:      true,
          editInstruction: editInstruction.trim(),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      onPlanUpdated(json.data as MealPlan);
      setEditInstruction("");
    } catch (e) {
      setEditError(String(e));
    }
    setEditLoading(false);
  };

  const { dailyTotals } = plan;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Portion strategy banner */}
      <div className="rounded-xl p-4" style={{ background: "var(--umd-gold)12", border: "1px solid var(--umd-gold)30" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--umd-gold)" }}>
          <span className="font-bold">💡 Portion Strategy:</span> {plan.portionStrategy}
        </p>
      </div>

      {/* Macro progress */}
      <div className="card p-4">
        <h3 className="font-display text-lg tracking-wide text-text-primary mb-4">TODAY'S TARGETS</h3>
        <MacroBar label="🔥 Calories" current={dailyTotals.calories} target={targetCalories} type="cal" />
        <MacroBar label="💪 Protein"  current={dailyTotals.protein}  target={targetProtein}  type="protein" />
        {targetCarbs != null && (
          <MacroBar label="🌾 Carbs (est.)" current={dailyTotals.carbs ?? 0} target={targetCarbs} type="carbs" />
        )}
        {targetFat != null && (
          <MacroBar label="🥑 Fat (est.)"   current={dailyTotals.fat ?? 0}   target={targetFat}   type="fat" />
        )}
        {(targetCarbs == null || targetFat == null) && (
          <p className="text-[11px] text-text-muted mt-2">
            ✱ Only tracking calories & protein. Add carbs/fat targets in your profile to see those bars.
          </p>
        )}
      </div>

      {/* Meal cards */}
      {(["breakfast", "lunch", "dinner"] as MealKey[]).map((meal) => {
        const { icon, label, color } = MEAL_META[meal];
        const data = plan.meals[meal];
        const open = expanded[meal];
        if (!data || data.items.length === 0) return null;

        const mealCal = data.items.reduce((s, i) => s + i.estimatedCalories, 0);
        const mealPro = data.items.reduce((s, i) => s + i.protein, 0);

        return (
          <div key={meal} className="card overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => toggle(meal)}
              className="w-full flex items-center justify-between p-4 cursor-pointer"
              style={{ background: "transparent", border: "none" }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div className="text-left">
                  <div className="font-display text-lg tracking-wide" style={{ color }}>
                    {label}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted">{data.items.length} items</span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--umd-gold)" }}>{mealCal} cal</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--umd-red)" }}>{mealPro}g P</span>
                  </div>
                </div>
              </div>
              <span className="text-text-muted text-sm transition-transform duration-200"
                style={{ transform: open ? "rotate(180deg)" : "rotate(0)", display: "inline-block" }}>▼</span>
            </button>

            {/* Items */}
            {open && (
              <div className="px-4 pb-4 space-y-3 animate-fade-in">
                <div style={{ borderTop: "1px solid var(--surface-3)" }} />
                {data.items.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-text-primary">{item.name}</div>
                        <div className="text-xs text-text-muted">{item.section} · {item.portion}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <MacroBadge label="Cal" value={item.estimatedCalories} type="cal" />
                      <MacroBadge label="P"   value={`${item.protein}g`}     type="protein" />
                      <MacroBadge label="C"   value={`${item.carbs}g`}       type="carbs" />
                      <MacroBadge label="F"   value={`${item.fat}g`}         type="fat" />
                    </div>
                    {item.tip && (
                      <p className="text-xs text-text-muted leading-relaxed pl-2"
                        style={{ borderLeft: `2px solid ${color}50` }}>
                        {item.tip}
                      </p>
                    )}
                    {i < data.items.length - 1 && (
                      <div style={{ borderTop: "1px solid var(--surface-2)" }} />
                    )}
                  </div>
                ))}

                {/* Meal note */}
                {data.note && (
                  <div className="rounded-lg p-3 mt-2"
                    style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
                    <p className="text-xs" style={{ color }}>💬 {data.note}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Edit meal plan */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          ✏️ Edit This Plan
        </p>
        <input
          className="input text-sm"
          placeholder='e.g. "no boiled eggs", "more protein at breakfast", "no chicken"'
          value={editInstruction}
          onChange={(e) => setEditInstruction(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRemake()}
        />
        {editError && <p className="text-xs" style={{ color: "var(--umd-red)" }}>{editError}</p>}
        <button
          onClick={handleRemake}
          disabled={!editInstruction.trim() || editLoading}
          className="btn-ghost w-full text-sm"
        >
          {editLoading
            ? <span className="flex items-center justify-center gap-1.5"><Spinner size={14} /> Remaking plan...</span>
            : "🔄 Remake with AI"}
        </button>
      </div>

      {/* Rate food CTA */}
      <button
        onClick={onReview}
        className="w-full py-3.5 rounded-xl border-2 font-display text-lg tracking-wide transition-all cursor-pointer"
        style={{
          borderColor: "var(--umd-red)",
          color:       "var(--umd-red)",
          background:  "transparent",
          fontFamily:  "'Space Grotesk', sans-serif",
        }}
      >
        ⭐ RATE TODAY'S FOOD
      </button>
    </div>
  );
}
