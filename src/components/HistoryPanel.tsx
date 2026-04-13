"use client";

import { useState, useEffect } from "react";
import { ratingColor, ratingLabel, EmptyState, Spinner } from "./ui";

interface FoodAggregate {
  food_name: string;
  avg_rating: number;
  review_count: number;
  last_reviewed: string;
}

interface Props {
  profileId: string;
}

type Filter = "all" | "loved" | "meh" | "avoided";

export function HistoryPanel({ profileId }: Props) {
  const [data, setData]       = useState<FoodAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("all");
  const [search, setSearch]   = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?profileId=${profileId}`);
      const json = await res.json();
      if (json.data?.aggregates) setData(json.data.aggregates);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [profileId]);

  const handleDelete = async (foodName: string) => {
    setDeleting(foodName);
    await fetch(`/api/reviews?profileId=${profileId}&foodName=${encodeURIComponent(foodName)}`, { method: "DELETE" });
    setData((d) => d.filter((x) => x.food_name !== foodName));
    setDeleting(null);
  };

  const filtered = data
    .filter((x) => {
      if (filter === "loved")   return x.avg_rating >= 7;
      if (filter === "meh")     return x.avg_rating >= 5 && x.avg_rating < 7;
      if (filter === "avoided") return x.avg_rating < 5;
      return true;
    })
    .filter((x) => x.food_name.toLowerCase().includes(search.toLowerCase()));

  const stats = {
    total:   data.length,
    loved:   data.filter((x) => x.avg_rating >= 7).length,
    avoided: data.filter((x) => x.avg_rating < 5).length,
    avg:     data.length ? (data.reduce((s, x) => s + x.avg_rating, 0) / data.length).toFixed(1) : "—",
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all",     label: `All (${stats.total})` },
    { id: "loved",   label: `✅ Love (${stats.loved})` },
    { id: "meh",     label: `😐 Meh` },
    { id: "avoided", label: `❌ Avoid (${stats.avoided})` },
  ];

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Rated", stats.total, "var(--text-primary)"],
          ["Love",  stats.loved, "#10b981"],
          ["Avg",   stats.avg,   "var(--umd-gold)"],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="card p-3 text-center">
            <div className="font-display text-2xl" style={{ color: c as string }}>{v}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No ratings yet"
          body="Generate a meal plan, eat, then come back and rate each food. Ratings improve your future plans!"
        />
      ) : (
        <>
          {/* Search */}
          <input
            className="input"
            placeholder="🔍 Search food..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: filter === f.id ? "var(--umd-red)" : "var(--surface-2)",
                  color: filter === f.id ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${filter === f.id ? "var(--umd-red)" : "var(--surface-3)"}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Food list */}
          {filtered.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-8">No items match this filter.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <div key={item.food_name}
                  className="card flex items-center gap-3 p-3">
                  {/* Rating circle */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl flex-shrink-0"
                    style={{
                      background: `${ratingColor(item.avg_rating)}18`,
                      color: ratingColor(item.avg_rating),
                      border: `2px solid ${ratingColor(item.avg_rating)}40`,
                    }}
                  >
                    {item.avg_rating.toFixed(0)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">{item.food_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: ratingColor(item.avg_rating) }}>
                        {ratingLabel(item.avg_rating)}
                      </span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs text-text-muted">{item.review_count} rating{item.review_count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(item.food_name)}
                    disabled={deleting === item.food_name}
                    className="text-text-muted hover:text-umd-red transition-colors text-lg p-1 flex-shrink-0"
                    title="Remove rating"
                  >
                    {deleting === item.food_name ? <Spinner size={16} /> : "×"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
