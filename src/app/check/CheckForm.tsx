"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function CheckForm({
  initial = {},
}: {
  initial?: { license?: string; name?: string; dob?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [license, setLicense] = useState(initial.license || "");
  const [name, setName] = useState(initial.name || "");
  const [dob, setDob] = useState(initial.dob || "");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(() => {
      const usp = new URLSearchParams();
      if (license) usp.set("license", license);
      if (name) usp.set("name", name);
      if (dob) usp.set("dob", dob);
      router.push(`/check?${usp.toString()}`);
    });
  }

  function reset() {
    setLicense(""); setName(""); setDob("");
    router.push("/check");
  }

  const hasAny = license || name || dob;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-1">
        <label className="label">License ID</label>
        <input
          className="input font-mono"
          placeholder="e.g. F5362380 or C650-552-00-626-0"
          value={license}
          onChange={(e) => setLicense(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="md:col-span-1">
        <label className="label">Full name</label>
        <input
          className="input"
          placeholder="e.g. Tyler Treasure"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="md:col-span-1">
        <label className="label">Date of birth (optional)</label>
        <input
          className="input"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
      </div>
      <div className="md:col-span-3 flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-neutral-500">
          Provide at least a name or license ID. Adding both increases match precision.
        </p>
        <div className="flex items-center gap-2">
          {hasAny && <button type="button" onClick={reset} className="btn-link">Reset</button>}
          <button type="submit" className="btn-primary" disabled={pending || (!license && !name)}>
            {pending ? "Running…" : "Run cross-check"}
          </button>
        </div>
      </div>
    </form>
  );
}
