"use client";
import { useState } from "react";

export function CheckForm({
  initial = {},
  action,
}: {
  initial?: { license?: string; name?: string; dob?: string };
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [license, setLicense] = useState(initial.license || "");
  const [name, setName] = useState(initial.name || "");
  const [dob, setDob] = useState(initial.dob || "");

  return (
    <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-1">
        <label className="label">License ID</label>
        <input
          name="license"
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
          name="name"
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
          name="dob"
          className="input"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
      </div>
      <div className="md:col-span-3 flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-neutral-500">
          At least a name or license ID is required. Adding both increases match precision.
        </p>
        <button
          type="submit"
          className="btn-primary"
          disabled={!license && !name}
        >
          Run cross-check
        </button>
      </div>
    </form>
  );
}
