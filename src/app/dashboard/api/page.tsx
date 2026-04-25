import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { rotateApiKey, revokeApiKey } from "@/lib/api-key";
import { ApiKeyManager } from "./ApiKeyManager";

async function rotateAction() {
  "use server";
  const me = await requireCompany();
  if (!me) throw new Error("Sign in required");
  const plan = getPlan(me.plan);
  if (!plan.apiAccess) throw new Error("Upgrade to Pro for API access");
  const { plaintext } = await rotateApiKey(me.id);
  return plaintext;
}

async function revokeAction() {
  "use server";
  const me = await requireCompany();
  if (!me) throw new Error("Sign in required");
  await revokeApiKey(me.id);
}

export default async function ApiPage() {
  const me = await requireCompany();
  if (!me) redirect("/login?next=/dashboard/api");
  const plan = getPlan(me.plan);
  const hasAccess = plan.apiAccess;

  return (
    <div className="space-y-6 fade-in">
      <header>
        <h1 className="text-2xl font-bold text-white">API access</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Integrate They Can't Be Trusted into your booking system. POST renter info, get back a verdict in milliseconds.
        </p>
      </header>

      {!hasAccess ? (
        <div className="card border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="text-base font-semibold text-amber-200">API access requires Pro or Pro+ plan</h2>
          <p className="mt-2 text-sm text-amber-100/80">
            Your current plan: <strong>{plan.label}</strong>. Upgrade to unlock API integration into your booking flow.
          </p>
          <Link href="/pricing" className="btn-primary mt-4 inline-flex">View plans</Link>
        </div>
      ) : (
        <ApiKeyManager
          plan={plan.label}
          apiKeyHint={me.apiKeyHint}
          rotateAction={rotateAction}
          revokeAction={revokeAction}
        />
      )}

      <section className="card p-6">
        <h2 className="text-base font-semibold text-white">Endpoint</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-ink-700 bg-ink-950/60 p-4 text-xs font-mono text-neutral-300">
{`POST https://${typeof window === "undefined" ? "your-domain.com" : window.location.host}/api/v1/check
Authorization: Bearer dnr_live_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "name": "Tyler Treasure",
  "license_id": "F5362380",
  "license_state": "CA",
  "dob": "1997-04-03"
}`}
        </pre>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-white">Code examples</h2>
        <div className="mt-4 space-y-5">
          <CodeBlock title="curl">
{`curl -X POST https://your-domain.com/api/v1/check \\
  -H "Authorization: Bearer dnr_live_xxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Tyler Treasure", "license_id": "F5362380"}'`}
          </CodeBlock>
          <CodeBlock title="Node.js (fetch)">
{`const res = await fetch("https://your-domain.com/api/v1/check", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.DNR_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Tyler Treasure",
    license_id: "F5362380",
    license_state: "CA",
    dob: "1997-04-03",
  }),
});

const result = await res.json();
if (result.verdict === "DECLINE") {
  // Block the booking
}`}
          </CodeBlock>
          <CodeBlock title="Python (requests)">
{`import os, requests

r = requests.post(
    "https://your-domain.com/api/v1/check",
    headers={"Authorization": f"Bearer {os.environ['DNR_API_KEY']}"},
    json={"name": "Tyler Treasure", "license_id": "F5362380"},
)
result = r.json()
if result["verdict"] == "DECLINE":
    print("Block this booking — risk", result["risk_score"])`}
          </CodeBlock>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-white">Response shape</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-ink-700 bg-ink-950/60 p-4 text-xs font-mono text-neutral-300">
{`{
  "id": "cm…",
  "verdict": "DECLINE" | "REVIEW" | "APPROVE",
  "risk_score": 0-100,
  "matched_sources": 1,
  "total_sources": 3,
  "total_hits": 2,
  "worst_severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null,
  "ofac": {
    "status": "clear" | "match" | "error",
    "matches": [ { "name": "...", "programs": [...], "score": 950 } ]
  },
  "hits": [
    {
      "id": "...",
      "full_name": "Tyler Darrell Treasure",
      "license_id": "...",
      "severity": "CRITICAL",
      "primary_reason": "Reckless; multiple hit-and-runs...",
      "damage_amount": 8000,
      "matched_on": ["name"],
      "source": { "id": "...", "slug": "supreme-sport-rental", "name": "..." }
    }
  ],
  "plan_info": { "plan": "pro", "remaining_checks": 99 }
}`}
        </pre>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-white">Errors</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-300">
          <li><code className="font-mono text-red-300">401 unauthenticated</code> · Missing or invalid Bearer token</li>
          <li><code className="font-mono text-red-300">403 plan_required</code> · Plan doesn't include API access</li>
          <li><code className="font-mono text-red-300">429 quota_exceeded</code> · Monthly Rent Report limit reached</li>
          <li><code className="font-mono text-red-300">400 missing_input</code> · Provide name and/or license_id</li>
          <li><code className="font-mono text-red-300">400 invalid_dob</code> · DOB must be ISO YYYY-MM-DD</li>
        </ul>
      </section>
    </div>
  );
}

function CodeBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{title}</div>
      <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-950/60 p-4 text-xs font-mono text-neutral-200">
{children}
      </pre>
    </div>
  );
}
