"use client";
import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-neutral-300 hover:bg-ink-700"
    >
      {done ? "Copied!" : "Copy"}
    </button>
  );
}
