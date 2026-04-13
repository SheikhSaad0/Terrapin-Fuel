"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Profile } from "@/types";
import { ProfileCard, ProfileForm } from "@/components/ProfileForm";
import { Spinner } from "@/components/ui";

export default function HomePage() {
  const router = useRouter();
  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError]           = useState("");

  // Load profiles + previously selected profile
  useEffect(() => {
    const prev = localStorage.getItem("tf:activeProfileId");
    if (prev) setActiveId(prev);
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profiles");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setProfiles(json.data ?? []);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    localStorage.setItem("tf:activeProfileId", id);
  };

  const handleLogin = () => {
    if (!activeId) return;
    router.push(`/dashboard?profileId=${activeId}`);
  };

  const handleCreate = async (data: Omit<Profile, "id" | "createdAt">) => {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    const newProfile: Profile = json.data;
    setProfiles((p) => [...p, newProfile]);
    setActiveId(newProfile.id);
    localStorage.setItem("tf:activeProfileId", newProfile.id);
    setCreating(false);
    // Auto-login
    router.push(`/dashboard?profileId=${newProfile.id}`);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/profiles?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) { setError(json.error); return; }
    setProfiles((p) => p.filter((x) => x.id !== id));
    if (activeId === id) {
      setActiveId(null);
      localStorage.removeItem("tf:activeProfileId");
    }
    setDeleteConfirm(null);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-start py-12 px-4"
      style={{ background: "var(--surface-0)" }}>
      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="text-7xl mb-4">🐢</div>
        <h1 className="font-display text-5xl text-white tracking-[6px]"
          style={{ textShadow: "0 0 40px var(--umd-red-glow)" }}>
          TERRAPIN FUEL
        </h1>
        <p className="text-text-muted text-sm mt-2 tracking-widest uppercase">
          UMD Dining · AI Meal Planning · Built for Terps
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: "var(--umd-red)20", color: "var(--umd-red)", border: "1px solid var(--umd-red)40" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--umd-red)" }} />
          Eat smart. Train harder.
        </div>
      </div>

      <div className="w-full max-w-md">
        {creating ? (
          <div className="card p-6">
            <ProfileForm onSave={handleCreate} onCancel={() => setCreating(false)} />
          </div>
        ) : (
          <>
            {/* Profile list */}
            {loading ? (
              <div className="flex justify-center py-16"><Spinner size={36} /></div>
            ) : (
              <div className="space-y-3 stagger">
                {profiles.length === 0 && !loading && (
                  <div className="text-center py-10">
                    <div className="text-4xl mb-3">👤</div>
                    <p className="text-text-muted text-sm">No profiles yet. Create one to get started!</p>
                  </div>
                )}

                {profiles.map((p) => (
                  deleteConfirm === p.id ? (
                    // Delete confirmation inline
                    <div key={p.id} className="card p-4 animate-fade-in">
                      <p className="text-sm text-text-secondary mb-3">
                        Delete <strong className="text-text-primary">{p.name}</strong>? This removes all their meal plans and reviews.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirm(null)} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
                          style={{ background: "var(--umd-red)", color: "#fff", border: "none" }}
                        >Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div key={p.id} className="animate-slide-up">
                      <ProfileCard
                        profile={p}
                        active={activeId === p.id}
                        onSelect={() => handleSelect(p.id)}
                        onDelete={() => setDeleteConfirm(p.id)}
                      />
                    </div>
                  )
                ))}
              </div>
            )}

            {error && <p className="text-sm mt-3" style={{ color: "var(--umd-red)" }}>{error}</p>}

            <div className="mt-5 space-y-3">
              {/* Enter button */}
              {activeId && (
                <button onClick={handleLogin} className="btn-primary w-full text-xl">
                  ENTER DINING HALL 🏛️
                </button>
              )}

              {/* Create new */}
              <button onClick={() => setCreating(true)} className="btn-ghost w-full text-sm">
                + Create New Profile
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-text-muted text-xs mt-10">
        Built for UMD Terps 🐢 · Powered by Claude AI
      </p>
    </main>
  );
}
