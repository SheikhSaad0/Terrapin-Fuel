"use client";

import { useMemo, useState } from "react";
import { DailyMenu, MenuItem, DietaryTag, MealName, TAG_ABBREV, TAG_COLORS } from "@/types";

const MEAL_TABS: { id: MealName; icon: string; label: string }[] = [
  { id: "breakfast", icon: "🌅", label: "Breakfast" },
  { id: "lunch",     icon: "☀️", label: "Lunch" },
  { id: "dinner",    icon: "🌙", label: "Dinner" },
];

function TagBadge({ tag }: { tag: DietaryTag }) {
  const color = TAG_COLORS[tag];
  return (
    <span
      style={{
        background:   `${color}20`,
        color,
        border:       `1px solid ${color}40`,
        borderRadius: 4,
        padding:      "1px 5px",
        fontSize:     10,
        fontWeight:   700,
        lineHeight:   "16px",
        whiteSpace:   "nowrap",
      }}
    >
      {TAG_ABBREV[tag]}
    </span>
  );
}

function MenuItemRow({ item }: { item: MenuItem }) {
  return (
    <div
      className="py-2.5"
      style={{ borderBottom: "1px solid var(--surface-2)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-text-primary font-medium leading-snug flex-1">{item.name}</span>
        <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
          {item.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-xs font-semibold" style={{ color: "var(--umd-gold)" }}>
          {item.calories} cal
        </span>
        <span className="text-xs font-semibold" style={{ color: "var(--umd-red)" }}>
          {item.protein}g P
        </span>
        {item.carbs > 0 && (
          <span className="text-xs" style={{ color: "var(--macro-carbs)" }}>
            {item.carbs}g C
          </span>
        )}
        {item.fat > 0 && (
          <span className="text-xs" style={{ color: "var(--macro-fat)" }}>
            {item.fat}g F
          </span>
        )}
        <span className="text-xs text-text-muted ml-auto">{item.servingSize}</span>
      </div>
    </div>
  );
}

interface Props {
  menu: DailyMenu;
}

export function MenuViewer({ menu }: Props) {
  const [activeMeal, setActiveMeal] = useState<MealName>("breakfast");

  const grouped = useMemo(() => {
    const items = menu[activeMeal] ?? [];
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const section = item.section || "Other";
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(item);
    }
    return map;
  }, [menu, activeMeal]);

  const totalItems = useMemo(() => (menu[activeMeal] ?? []).length, [menu, activeMeal]);

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Meal tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--surface-3)" }}>
        {MEAL_TABS.map((tab) => {
          const count = (menu[tab.id] ?? []).length;
          const active = activeMeal === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMeal(tab.id)}
              className="flex-1 py-3 text-xs font-semibold transition-all cursor-pointer"
              style={{
                background:   active ? "var(--surface-2)" : "transparent",
                color:        active ? "var(--text-primary)" : "var(--text-muted)",
                border:       "none",
                borderBottom: active ? "2px solid var(--umd-red)" : "2px solid transparent",
              }}
            >
              {tab.icon} {tab.label}
              <span className="ml-1 text-text-muted">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Tag legend */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5" style={{ borderBottom: "1px solid var(--surface-2)" }}>
        {(["vegetarian", "vegan", "halal", "gluten", "dairy"] as DietaryTag[]).map((tag) => (
          <div key={tag} className="flex items-center gap-1">
            <TagBadge tag={tag} />
            <span className="text-[10px] text-text-muted capitalize">
              {tag === "gluten" ? "GF" : tag === "dairy" ? "DF" : tag}
            </span>
          </div>
        ))}
        <span className="text-[10px] text-text-muted self-center ml-1">· {totalItems} items total</span>
      </div>

      {/* Menu items grouped by section */}
      <div className="px-4 pb-2 max-h-80 overflow-y-auto">
        {grouped.size === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">No items available for this meal.</p>
        ) : (
          Array.from(grouped.entries()).map(([section, items]) => (
            <div key={section} className="mt-3">
              {/* Section header */}
              <div
                className="text-[10px] font-bold uppercase tracking-widest py-1 mb-1"
                style={{
                  color:       "var(--umd-red)",
                  borderLeft:  "3px solid var(--umd-red)",
                  paddingLeft: 8,
                }}
              >
                {section}
              </div>
              {items.map((item) => (
                <MenuItemRow key={item.recNum || item.name} item={item} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
