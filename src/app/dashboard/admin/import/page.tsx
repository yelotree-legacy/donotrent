import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { ImportForm } from "./ImportForm";

export default async function BulkImportPage() {
  const me = await requireCompany();
  if (!me?.isAdmin) redirect("/dashboard");

  const sources = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, kind: true, _count: { select: { entries: true } } },
  });

  return (
    <div className="space-y-6 fade-in">
      <Link href="/dashboard/admin" className="btn-link">← Back to admin</Link>

      <header>
        <h1 className="text-2xl font-bold text-white">Bulk import</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Paste a CSV of flagged renters. They become entries under the source you pick.
          Idempotent — re-importing updates existing rows.
        </p>
      </header>

      <ImportForm sources={sources} />

      <details className="card p-5">
        <summary className="cursor-pointer text-sm font-semibold text-white">
          CSV format reference
        </summary>
        <div className="mt-3 space-y-3 text-sm text-neutral-300">
          <p>The first row is headers. Columns are case-insensitive. All optional except <code className="font-mono text-neutral-200">full_name</code>.</p>
          <table className="w-full text-xs">
            <thead className="text-left text-neutral-400">
              <tr>
                <th className="pb-2 pr-3">Column</th>
                <th className="pb-2 pr-3">Required</th>
                <th className="pb-2">Notes</th>
              </tr>
            </thead>
            <tbody className="font-mono text-neutral-300">
              {[
                ["full_name", "✓", "First Middle Last"],
                ["license_id", "—", "Any format; normalized for search"],
                ["license_state", "—", "2-letter code (FL, CA…)"],
                ["dob", "—", "YYYY-MM-DD or MM/DD/YYYY"],
                ["primary_reason", "—", "Short summary; defaults to 'Imported entry'"],
                ["detailed_notes", "—", "Long-form description"],
                ["severity", "—", "LOW · MEDIUM · HIGH · CRITICAL (default MEDIUM)"],
                ["damage_amount", "—", "USD; e.g. 1500 or $1,500"],
                ["incident_date", "—", "YYYY-MM-DD or MM/DD/YYYY"],
                ["incident_city", "—", "Free text"],
                ["incident_state", "—", "2-letter code"],
                ["categories", "—", "Slugs separated by ; e.g. theft;reckless"],
                ["aliases", "—", "Alt spellings separated by ;"],
                ["photo_url", "—", "https:// URL or /uploads/...path"],
              ].map(([col, req, note]) => (
                <tr key={col} className="border-t border-ink-800">
                  <td className="py-1.5 pr-3 text-white">{col}</td>
                  <td className="py-1.5 pr-3 text-neutral-400">{req}</td>
                  <td className="py-1.5 text-neutral-400">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pt-2 text-xs text-neutral-500">
            Need a sample? Copy this:
          </p>
          <pre className="overflow-x-auto rounded border border-ink-700 bg-ink-950/60 p-3 text-[11px] font-mono text-neutral-300">
{`full_name,license_id,license_state,severity,primary_reason,categories,photo_url
"John Adam Doe","F1234567","FL","HIGH","Crashed Lambo, refused to pay","damage;nonpayment","https://example.com/john.jpg"
"Jane Smith",,"GA","MEDIUM","Excessive speeding","reckless",`}
          </pre>
        </div>
      </details>
    </div>
  );
}
