"use client";

import { useState, useEffect } from "react";
import { HistoryEntry, Review } from "@/types";
import { ratingColor, ratingLabel, EmptyState, Spinner } from "./ui";

const MEAL_META = {
  breakfast: { icon: "🌅", label: "Breakfast", color: "#f59e0b" },
  lunch:     { icon: "☀️", label: "Lunch",     color: "#10b981" },
  dinner:    { icon: "🌙", label: "Dinner",     color: "#6366f1" },
} as const;

type MealKey = keyof typeof MEAL_META;

interface Props {
  profileId: string;
}

export function HistoryPanel({ profileId }: Props) {
  const [entries, setEntries]       = useState<HistoryEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [openDates, setOpenDates]   = useState<Set<string>>(new Set());
  const [showModal, setShowModal]   = useState(false);

  // Modal state
  const [addFoodName, setAddFoodName] = useState("");
  const [addMeal, setAddMeal]         = useState<Review["meal"]>("other");
  const [addRating, setAddRating]     = useState<number | null>(null);
  const [addNotes, setAddNotes]       = useState("");
  const [addSaving, setAddSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/history?profileId=${profileId}`);
      const json = await res.json();
      if (json.data) setEntries(json.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [profileId]);

  const toggleDate = (date: string) => {
    setOpenDates((s) => {
      const next = new Set(s);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const handleAddReview = async () => {
    if (!addFoodName.trim() || addRating == null) return;
    setAddSaving(true);
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          reviews: [{
            foodName: addFoodName.trim(),
            rating:   addRating,
            notes:    addNotes,
            meal:     addMeal,
          }],
        }),
      });
      setShowModal(false);
      setAddFoodName(""); setAddRating(null); setAddNotes(""); setAddMeal("other");
      await load();
    } catch {}
    setAddSaving(false);
  };

  const openRateModal = (foodName: string, meal: MealKey) => {
    setAddFoodName(foodName);
    setAddMeal(meal);
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  }

  return (
    <div className="space-y-3 animate-slide-up">
      {entries.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No history yet"
          body="Generate a meal plan, eat, then rate your food. Your history will appear here by date."
        />
      ) : (
        entries.map((entry) => {
          const isOpen = openDates.has(entry.date);
          // Parse date at noon to avoid timezone off-by-one
          const dateLabel = new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "short", month: "long", day: "numeric", year: "numeric",
          });

          // Build a map of food name → review for quick lookup
          const reviewMap: Record<string, Review> = {};
          entry.reviews.forEach((r) => { reviewMap[r.foodName] = r; });

          return (
            <div key={entry.date} className="card overflow-hidden">
              {/* Date header */}
              <button
                type="button"
                onClick={() => toggleDate(entry.date)}
                className="w-full flex items-center justify-between p-4 cursor-pointer"
                style={{ background: "transparent", border: "none" }}
              >
                <div className="text-left">
                  <div className="font-semibold text-sm text-text-primary">{dateLabel}</div>
                  <div className="flex gap-3 mt-0.5">
                    {entry.dailyTotals && (
                      <>
                        <span className="text-xs font-semibold" style={{ color: "var(--umd-gold)" }}>
                          {entry.dailyTotals.calories} cal
                        </span>
                        <span className="text-xs font-semibold" style={{ color: "var(--umd-red)" }}>
                          {entry.dailyTotals.protein}g protein
                        </span>
                        {entry.dailyTotals.carbs != null && (
                          <span className="text-xs" style={{ color: "var(--macro-carbs)" }}>
                            {entry.dailyTotals.carbs}g carbs
                          </span>
                        )}
                        {entry.dailyTotals.fat != null && (
                          <span className="text-xs" style={{ color: "var(--macro-fat)" }}>
                            {entry.dailyTotals.fat}g fat
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-text-muted">{entry.reviews.length} ratings</span>
                  <span
                    className="text-text-muted text-xs transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", display: "inline-block" }}
                  >▼</span>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-4 pb-4 animate-fade-in" style={{ borderTop: "1px solid var(--surface-3)" }}>
                  {(["breakfast", "lunch", "dinner"] as MealKey[]).map((meal) => {
                    const { icon, label, color } = MEAL_META[meal];
                    const planItems = entry.mealPlan?.meals[meal]?.items ?? [];
                    const mealReviews = entry.reviews.filter((r) => r.meal === meal);
                    const ratedNames  = new Set(mealReviews.map((r) => r.foodName));
                    // Unrated plan items
                    const unratedItems = planItems.filter((item) => !ratedNames.has(item.name));

                    if (planItems.length === 0 && mealReviews.length === 0) return null;

                    return (
                      <div key={meal} className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span>{icon}</span>
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
                            {label}
                          </span>
                        </div>

                        {/* Rated items */}
                        {mealReviews.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between py-2"
                            style={{ borderBottom: "1px solid var(--surface-2)" }}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-text-primary">{r.foodName}</span>
                              {r.notes && (
                                <p className="text-xs text-text-muted mt-0.5 truncate">{r.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs" style={{ color: ratingColor(r.rating) }}>
                                {ratingLabel(r.rating)}
                              </span>
                              <span
                                className="font-display text-base w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{
                                  background: `${ratingColor(r.rating)}18`,
                                  color:      ratingColor(r.rating),
                                  border:     `2px solid ${ratingColor(r.rating)}40`,
                                }}
                              >
                                {r.rating}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Unrated plan items */}
                        {unratedItems.map((item) => (
                          <div
                            key={item.name}
                            className="flex items-center justify-between py-2"
                            style={{ borderBottom: "1px solid var(--surface-2)" }}
                          >
                            <span className="text-sm text-text-muted">{item.name}</span>
                            <button
                              onClick={() => openRateModal(item.name, meal)}
                              className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                              style={{
                                background: "var(--surface-3)",
                                color:      "var(--text-secondary)",
                                border:     "1px solid var(--surface-4)",
                              }}
                            >
                              Rate
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Reviews with meal="other" (manually added) */}
                  {(() => {
                    const otherReviews = entry.reviews.filter((r) => r.meal === "other");
                    if (otherReviews.length === 0) return null;
                    return (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span>➕</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                            Other
                          </span>
                        </div>
                        {otherReviews.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between py-2"
                            style={{ borderBottom: "1px solid var(--surface-2)" }}
                          >
                            <span className="text-sm text-text-primary">{r.foodName}</span>
                            <span
                              className="text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center"
                              style={{
                                background: `${ratingColor(r.rating)}18`,
                                color:      ratingColor(r.rating),
                                border:     `2px solid ${ratingColor(r.rating)}40`,
                              }}
                            >
                              {r.rating}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Floating + button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed z-40 flex items-center justify-center text-xl font-bold text-white cursor-pointer"
        style={{
          bottom:       76,
          right:        16,
          width:        48,
          height:       48,
          borderRadius: "50%",
          background:   "var(--umd-red)",
          boxShadow:    "0 4px 20px var(--umd-red-glow)",
          border:       "none",
        }}
        title="Add custom food rating"
      >
        +
      </button>

      {/* Custom rating modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="card w-full max-w-lg mx-4 mb-4 p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl tracking-wide">Add Rating</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-muted text-2xl leading-none cursor-pointer"
                style={{ background: "transparent", border: "none" }}
              >
                ×
              </button>
            </div>

            <div>
              <label className="label">Food Name</label>
              <input
                className="input"
                value={addFoodName}
                onChange={(e) => setAddFoodName(e.target.value)}
                placeholder="e.g. Grilled Chicken, Caesar Salad..."
                autoFocus
              />
            </div>

            <div>
              <label className="label">Meal</label>
              <div className="flex gap-2">
                {(["breakfast", "lunch", "dinner", "other"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAddMeal(m)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all"
                    style={{
                      background: addMeal === m ? "var(--umd-red)" : "var(--surface-2)",
                      color:      addMeal === m ? "#fff" : "var(--text-muted)",
                      border:     `1px solid ${addMeal === m ? "var(--umd-red)" : "var(--surface-3)"}`,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Rating (1–10)</label>
              <div className="grid grid-cols-10 gap-1">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAddRating(n)}
                    className="py-2 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    style={{
                      background: addRating === n ? ratingColor(n) : "var(--surface-2)",
                      color:      addRating === n ? "#fff" : "var(--text-muted)",
                      border:     `1px solid ${addRating === n ? ratingColor(n) : "var(--surface-3)"}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <input
              className="input text-xs"
              placeholder="Notes (optional)..."
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
            />

            <button
              onClick={handleAddReview}
              disabled={!addFoodName.trim() || addRating == null || addSaving}
              className="btn-primary w-full"
            >
              {addSaving
                ? <span className="flex items-center justify-center gap-2"><Spinner size={16} /> Saving...</span>
                : "Save Rating"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
