"use client";

import { clsx } from "clsx";

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <div
      className={clsx("rounded-full border-2 border-surface-3 border-t-umd-red animate-spin-slow", className)}
      style={{ width: size, height: size }}
    />
  );
}

// ─── Macro Badge (inline colored chip) ───────────────────────────────────────
type MacroKey = "cal" | "protein" | "carbs" | "fat";
const MACRO_COLORS: Record<MacroKey, { bg: string; text: string; border: string }> = {
  cal:     { bg: "#FFD20015", text: "#FFD200", border: "#FFD20035" },
  protein: { bg: "#CC003315", text: "#CC0033", border: "#CC003335" },
  carbs:   { bg: "#10b98115", text: "#10b981", border: "#10b98135" },
  fat:     { bg: "#8b5cf615", text: "#8b5cf6", border: "#8b5cf635" },
};

export function MacroBadge({
  label, value, type,
}: { label: string; value: string | number; type: MacroKey }) {
  const c = MACRO_COLORS[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {label}: {value}
    </span>
  );
}

// ─── Macro Progress Bar ───────────────────────────────────────────────────────
export function MacroBar({
  label, current, target, type, compact = false,
}: {
  label: string;
  current: number;
  target: number;
  type: MacroKey;
  compact?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const over = current > target;
  const c = MACRO_COLORS[type];

  return (
    <div className={compact ? "mb-2" : "mb-3"}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted font-medium">{label}</span>
        <span className="text-xs font-semibold" style={{ color: over ? "#f59e0b" : c.text }}>
          {current} <span className="text-text-muted font-normal">/ {target}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: over ? "#f59e0b" : c.text,
            boxShadow: over ? "none" : `0 0 6px ${c.text}60`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Pill toggle ──────────────────────────────────────────────────────────────
export function Pill({
  label, active, onClick, emoji,
}: { label: string; active: boolean; onClick: () => void; emoji?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer"
      style={{
        border: `1.5px solid ${active ? "var(--umd-red)" : "var(--surface-4)"}`,
        background: active ? "var(--umd-red)" : "transparent",
        color: active ? "#fff" : "var(--text-muted)",
      }}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="text-text-secondary font-semibold text-base mb-1">{title}</div>
      {body && <div className="text-text-muted text-sm max-w-xs leading-relaxed">{body}</div>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="font-display text-2xl text-text-primary tracking-widest">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Rating color helper ──────────────────────────────────────────────────────
export function ratingColor(r: number): string {
  if (r >= 7) return "#10b981";
  if (r >= 5) return "#f59e0b";
  return "#CC0033";
}

export function ratingLabel(r: number): string {
  if (r >= 9) return "🔥 Love it";
  if (r >= 7) return "✅ Good";
  if (r >= 5) return "😐 Meh";
  if (r >= 3) return "👎 Bad";
  return "🚫 Avoid";
}
