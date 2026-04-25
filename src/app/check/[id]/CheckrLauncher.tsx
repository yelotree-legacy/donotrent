"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CheckrLauncher({
  checkId,
  label = "Run Checkr report",
  className = "btn-primary",
}: {
  checkId: string;
  label?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function go() {
    setError(null);
    start(async () => {
      try {
        const r = await fetch("/api/checkr/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkId }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${r.status}`);
        }
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Failed");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={go} disabled={pending} className={`${className}${pending ? " opacity-60" : ""}`}>
        {pending ? "Starting…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </>
  );
}
