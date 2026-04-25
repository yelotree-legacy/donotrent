"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function CheckrStatusPoller({ checkId }: { checkId: string }) {
  const router = useRouter();
  const lastStatus = useRef<string>("pending");

  useEffect(() => {
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const r = await fetch(`/api/checkr/status?checkId=${encodeURIComponent(checkId)}`, { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          if (data.checkrStatus && data.checkrStatus !== lastStatus.current) {
            lastStatus.current = data.checkrStatus;
            router.refresh();
          }
        }
      } catch {}
      // Slow poll — Checkr reports take from minutes to days
      if (!stopped) setTimeout(tick, 30000);
    }
    setTimeout(tick, 30000);
    return () => { stopped = true; };
  }, [checkId, router]);

  return null;
}
