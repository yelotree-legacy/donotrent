"use client";
import { useState, useTransition } from "react";

export function ChoosePlanButton({
  plan,
  highlight,
}: {
  plan: string;
  highlight?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    start(async () => {
      try {
        const r = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = await r.json();
        if (!r.ok || !data.url) throw new Error(data.error || `HTTP ${r.status}`);
        window.location.href = data.url;
      } catch (e: any) {
        setError(e?.message || "Checkout failed");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className={`${highlight ? "btn-primary" : "btn-ghost"} w-full justify-center${pending ? " opacity-60" : ""}`}
      >
        {pending ? "Loading…" : "Choose plan"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </>
  );
}
