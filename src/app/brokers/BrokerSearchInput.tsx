"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BrokerSearchInput({ initial = "" }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(() => {
      const usp = new URLSearchParams();
      if (q.trim()) usp.set("q", q.trim());
      router.push(`/brokers${usp.toString() ? "?" + usp.toString() : ""}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/80 px-3 backdrop-blur transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
      <svg className="size-4 shrink-0 text-neutral-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="9" r="6" />
        <path d="m17 17-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        autoFocus
        type="search"
        className="flex-1 bg-transparent py-3 text-sm placeholder:text-neutral-500 focus:outline-none"
        placeholder="Search by broker name, email, Instagram handle, or city…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q && (
        <button type="button" className="rounded p-1 text-neutral-500 hover:text-white hover:bg-ink-800" onClick={() => { setQ(""); router.push("/brokers"); }} aria-label="Clear">✕</button>
      )}
      <button className="btn-primary text-sm" disabled={pending}>{pending ? "Searching…" : "Search"}</button>
    </form>
  );
}
