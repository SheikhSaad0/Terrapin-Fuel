"use client";

export type DashTab = "plan" | "review" | "history" | "profile";

const TABS: { id: DashTab; label: string; icon: string }[] = [
  { id: "plan",    label: "Plan",    icon: "🍽️" },
  { id: "review",  label: "Rate",    icon: "⭐" },
  { id: "history", label: "History", icon: "📊" },
  { id: "profile", label: "Profile", icon: "👤" },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: DashTab;
  onChange: (tab: DashTab) => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: "rgba(9,9,9,0.95)",
        borderTop: "1px solid var(--surface-3)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 cursor-pointer transition-colors"
            style={{ background: "transparent", border: "none" }}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span
              className="text-[10px] font-semibold transition-colors"
              style={{ color: isActive ? "var(--umd-red)" : "var(--text-muted)" }}
            >
              {tab.label}
            </span>
            {isActive && (
              <div
                className="absolute bottom-0 rounded-t-sm transition-all"
                style={{
                  width: 28,
                  height: 2,
                  background: "var(--umd-red)",
                  position: "absolute",
                  bottom: 0,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
