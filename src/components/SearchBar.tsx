"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchBar({ initial = "", initialField = "any" }: { initial?: string; initialField?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [field, setField] = useState(initialField);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(() => {
      const usp = new URLSearchParams(params.toString());
      if (q) usp.set("q", q); else usp.delete("q");
      if (field && field !== "any") usp.set("field", field); else usp.delete("field");
      router.push(`/?${usp.toString()}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row">
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <select
          className="border-r border-ink-700 bg-transparent py-3 pr-3 text-sm text-neutral-300 focus:outline-none"
          value={field}
          onChange={(e) => setField(e.target.value)}
        >
          <option value="any">Any field</option>
          <option value="name">Full name</option>
          <option value="license">License ID</option>
        </select>
        <input
          autoFocus
          className="flex-1 bg-transparent py-3 text-sm placeholder:text-neutral-500 focus:outline-none"
          placeholder="Search by full name or license ID — e.g. Tyler Treasure or FL-1234567"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button type="button" className="text-neutral-500 hover:text-white" onClick={() => setQ("")}>
            ✕
          </button>
        )}
      </div>
      <button className="btn-primary md:w-32" disabled={pending}>{pending ? "Searching…" : "Search"}</button>
    </form>
  );
}
