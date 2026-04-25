import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { getMigrationStatus, findBlobToken, listBlobEnvNames } from "@/lib/photo-migration";
import { MigrationRunner } from "./MigrationRunner";

export default async function PhotoMigrationPage() {
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");

  const status = await getMigrationStatus();
  const { token, name: tokenName } = findBlobToken();
  const blobConfigured = Boolean(token);
  const blobEnvNames = listBlobEnvNames();

  return (
    <div className="space-y-6 fade-in">
      <Link href="/dashboard/admin" className="btn-link">← Back to admin</Link>
      <header>
        <h1 className="text-2xl font-bold text-white">Photo migration</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Move imported license photos from external CDNs onto Vercel Blob, so the
          registry is fully self-hosted and not dependent on partner sites.
        </p>
      </header>

      {!blobConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p><strong>Blob not configured.</strong> No <code className="rounded bg-amber-500/10 px-1 font-mono">*_BLOB_READ_WRITE_TOKEN</code> env var found in this deployment.</p>
          <p className="mt-2 text-xs">
            <strong>Detected blob-related env vars:</strong>{" "}
            {blobEnvNames.length === 0 ? <em>(none)</em> : blobEnvNames.join(", ")}
          </p>
          <p className="mt-2 text-xs">
            Fix: Vercel project → <strong>Storage</strong> → your Blob store → <strong>Connect to Project</strong> (all environments) → redeploy.
          </p>
        </div>
      )}
      {blobConfigured && tokenName && tokenName !== "BLOB_READ_WRITE_TOKEN" && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs text-blue-200">
          Using non-default env var name: <code className="font-mono">{tokenName}</code>. Migration will work fine.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Total photos" value={status.total} />
        <Stat label="On Vercel Blob" value={status.onBlob} accent={status.onBlob === status.total} />
        <Stat label="External / pending" value={status.remaining} accent={status.remaining > 0} accentColor="amber" />
      </div>

      <MigrationRunner blobConfigured={blobConfigured} initialRemaining={status.remaining} initialOnBlob={status.onBlob} initialTotal={status.total} />

      <div className="card p-5 text-sm text-neutral-400">
        <h2 className="font-semibold text-neutral-200">How this works</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
          <li>Each batch fetches up to 20 photos at ~4-way concurrency.</li>
          <li>For each photo: download from current URL → upload to Vercel Blob → update Photo.url in DB.</li>
          <li>Idempotent — already-migrated photos are skipped.</li>
          <li>Safe to run repeatedly. The "Run all" button loops until remaining = 0.</li>
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label, value, accent, accentColor = "emerald",
}: { label: string; value: number; accent?: boolean; accentColor?: "emerald" | "amber" }) {
  const accentBg = accentColor === "amber" ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5";
  const accentText = accentColor === "amber" ? "text-amber-300" : "text-emerald-300";
  return (
    <div className={`rounded-lg border ${accent ? accentBg : "border-ink-700 bg-ink-900/60"} p-4`}>
      <div className={`text-3xl font-bold ${accent ? accentText : "text-white"}`}>{value.toLocaleString()}</div>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}
