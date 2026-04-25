"use client";
import { useState, useTransition } from "react";

export function OpenPortalButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        className={`btn-ghost${pending ? " opacity-60" : ""}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const r = await fetch("/api/billing/portal", { method: "POST" });
              const data = await r.json();
              if (!r.ok || !data.url) throw new Error(data.error || `HTTP ${r.status}`);
              window.location.href = data.url;
            } catch (e: any) {
              setError(e?.message || "Couldn't open portal");
            }
          })
        }
      >
        {pending ? "Opening…" : "Manage subscription"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </>
  );
}
