"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// While IDV is pending, poll every 5s and refresh the page when status flips.
export function IdvStatusPoller({ checkId }: { checkId: string }) {
  const router = useRouter();
  const lastStatus = useRef<string>("pending");

  useEffect(() => {
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const r = await fetch(`/api/idv/status?checkId=${encodeURIComponent(checkId)}`, { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          if (data.status && data.status !== lastStatus.current) {
            lastStatus.current = data.status;
            router.refresh();
          }
        }
      } catch {}
      if (!stopped) setTimeout(tick, 5000);
    }
    setTimeout(tick, 5000);
    return () => { stopped = true; };
  }, [checkId, router]);

  return null;
}
