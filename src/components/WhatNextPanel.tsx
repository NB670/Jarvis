"use client";

import { useCallback, useState } from "react";

export function WhatNextPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    recommended_focus: string;
    why_it_matters: string;
    next_smallest_action: string;
    low_energy_fallback: string;
  } | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        recommended_focus?: string;
        why_it_matters?: string;
        next_smallest_action?: string;
        low_energy_fallback?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setData({
        recommended_focus: json.recommended_focus ?? "",
        why_it_matters: json.why_it_matters ?? "",
        next_smallest_action: json.next_smallest_action ?? "",
        low_energy_fallback: json.low_energy_fallback ?? "",
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">What should I work on?</h2>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Asking…" : "Ask Jarvis"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {data ? (
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Focus</dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">{data.recommended_focus}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Why it matters</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{data.why_it_matters}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Next smallest action</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{data.next_smallest_action}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Low energy</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{data.low_energy_fallback}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Uses your active goals, open tasks, and recent reflections. Requires <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">OPENAI_API_KEY</code>.
        </p>
      )}
    </div>
  );
}
