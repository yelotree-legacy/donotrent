import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { uniqueBrokerSlug, recomputeBrokerAggregates, EXPERIENCE_TYPES } from "@/lib/brokers";
import { logAudit } from "@/lib/audit";

async function createBrokerWithReview(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me) redirect("/login?next=/brokers/new");

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/brokers/new?err=name");

  const email = (String(formData.get("email") || "").trim().toLowerCase()) || null;
  const phone = (String(formData.get("phone") || "").trim()) || null;
  const website = (String(formData.get("website") || "").trim()) || null;
  const instagram = (String(formData.get("instagram") || "").trim().replace(/^@/, "")) || null;
  const city = (String(formData.get("city") || "").trim()) || null;
  const state = (String(formData.get("state") || "").trim().toUpperCase().slice(0, 2)) || null;
  const description = (String(formData.get("description") || "").trim()) || null;
  const aliasesRaw = String(formData.get("aliases") || "").trim();
  const aliases = aliasesRaw ? JSON.stringify(aliasesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) : null;

  // Review fields
  const rating = Math.min(5, Math.max(1, parseInt(String(formData.get("rating") || "3"), 10) || 3));
  const experienceType = String(formData.get("experienceType") || "") || null;
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const incidentDateRaw = String(formData.get("incidentDate") || "").trim();
  const damageRaw = String(formData.get("damageAmount") || "").trim();

  if (!title || !body) redirect("/brokers/new?err=review");

  const slug = await uniqueBrokerSlug(name);
  const broker = await prisma.broker.create({
    data: {
      slug, name, aliases, email, phone, website, instagram, city, state, description,
    },
  });

  await prisma.brokerReview.create({
    data: {
      brokerId: broker.id,
      reviewerCompanyId: me.id,
      rating,
      experienceType,
      title,
      body,
      incidentDate: incidentDateRaw ? new Date(incidentDateRaw) : null,
      damageAmount: damageRaw ? parseFloat(damageRaw) : null,
    },
  });
  await recomputeBrokerAggregates(broker.id);
  await logAudit("broker.create", broker.id, { name });

  redirect(`/brokers/${broker.slug}`);
}

export default async function NewBrokerPage({ searchParams }: { searchParams: { err?: string } }) {
  const me = await requireCompany();
  if (!me) redirect("/login?next=/brokers/new");
  const err = searchParams.err;

  return (
    <div className="space-y-5 fade-in">
      <Link href="/brokers" className="btn-link">← All brokers</Link>
      <header>
        <h1 className="text-2xl font-bold text-white">Add a broker</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Adding a broker requires your first review. Other operators can add reviews afterward.
        </p>
      </header>

      {err && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err === "name" ? "Broker name is required." : "Review title and description are required."}
        </div>
      )}

      <form action={createBrokerWithReview} className="card divide-y divide-ink-800">
        <Section title="Broker info">
          <Grid>
            <Field label="Name *">
              <input name="name" className="input" required placeholder="Jane Doe Brokerage" />
            </Field>
            <Field label="Aliases" hint="Comma-separated">
              <input name="aliases" className="input" placeholder="JD Cars, J. Doe" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className="input" placeholder="jane@brokerage.com" />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" />
            </Field>
            <Field label="Website">
              <input name="website" className="input" placeholder="https://example.com" />
            </Field>
            <Field label="Instagram handle">
              <input name="instagram" className="input" placeholder="janedoebrokerage" />
            </Field>
            <Field label="City">
              <input name="city" className="input" placeholder="Miami" />
            </Field>
            <Field label="State (2-letter)">
              <input name="state" className="input" maxLength={2} placeholder="FL" />
            </Field>
            <Field label="Description" full>
              <textarea name="description" className="input min-h-[80px]" placeholder="What kind of broker / agent is this? What do they do?" />
            </Field>
          </Grid>
        </Section>

        <Section title="Your review">
          <Grid>
            <Field label="Rating *">
              <select name="rating" className="input" required defaultValue="3">
                <option value="5">★★★★★ — Excellent</option>
                <option value="4">★★★★☆ — Good</option>
                <option value="3">★★★☆☆ — Mixed</option>
                <option value="2">★★☆☆☆ — Poor</option>
                <option value="1">★☆☆☆☆ — Avoid</option>
              </select>
            </Field>
            <Field label="Experience type">
              <select name="experienceType" className="input" defaultValue="">
                <option value="">— select —</option>
                {EXPERIENCE_TYPES.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Headline *" full>
              <input name="title" className="input" required placeholder="One-line summary of your experience" />
            </Field>
            <Field label="Details *" full hint="What happened, what they did or didn't do, what other operators should know">
              <textarea name="body" className="input min-h-[140px]" required />
            </Field>
            <Field label="Incident date">
              <input name="incidentDate" type="date" className="input" />
            </Field>
            <Field label="Damages ($)">
              <input name="damageAmount" type="number" min="0" step="0.01" className="input" />
            </Field>
          </Grid>
        </Section>

        <div className="flex items-center justify-end gap-3 p-5">
          <Link href="/brokers" className="btn-link">Cancel</Link>
          <button type="submit" className="btn-primary">Add broker + review</button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}
function Field({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
