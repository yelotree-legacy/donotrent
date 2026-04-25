import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCompany, isVerified } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";
import { logAudit } from "@/lib/audit";
import { normalizeLicense, normalizeName, splitName } from "@/lib/normalize";

async function createEntry(formData: FormData) {
  "use server";
  const me = await requireCompany();
  if (!me) redirect("/login?err=auth");
  if (!isVerified(me)) redirect("/dashboard/upload?err=unverified");

  const fullName = String(formData.get("fullName") || "").trim();
  const licenseId = String(formData.get("licenseId") || "").trim();
  const licenseState = String(formData.get("licenseState") || "").trim().toUpperCase().slice(0, 2) || null;
  const dobRaw = String(formData.get("dob") || "").trim();
  const primaryReason = String(formData.get("primaryReason") || "").trim();
  const detailedNotes = String(formData.get("detailedNotes") || "").trim() || null;
  const severity = String(formData.get("severity") || "MEDIUM");
  const damageRaw = String(formData.get("damageAmount") || "").trim();
  const incidentDate = String(formData.get("incidentDate") || "").trim();
  const incidentCity = String(formData.get("incidentCity") || "").trim() || null;
  const incidentState = String(formData.get("incidentState") || "").trim().toUpperCase().slice(0, 2) || null;
  const aliasesRaw = String(formData.get("aliases") || "").trim();
  const categories = formData.getAll("categories").map(String);

  if (!fullName || !primaryReason) redirect("/dashboard/upload?err=missing");

  const licenseFront = formData.get("licenseFront") as File | null;
  const licenseBack = formData.get("licenseBack") as File | null;
  const damagePhotos = formData.getAll("damagePhotos") as File[];

  const photoData: { url: string; kind: string; caption?: string }[] = [];
  if (licenseFront && licenseFront.size > 0) {
    photoData.push({ url: await saveUpload(licenseFront, "licenses"), kind: "LICENSE_FRONT" });
  }
  if (licenseBack && licenseBack.size > 0) {
    photoData.push({ url: await saveUpload(licenseBack, "licenses"), kind: "LICENSE_BACK" });
  }
  for (const p of damagePhotos) {
    if (p && p.size > 0) {
      photoData.push({ url: await saveUpload(p, "damage"), kind: "DAMAGE" });
    }
  }

  const parts = splitName(fullName);
  const aliases = aliasesRaw
    ? aliasesRaw.split(/[,\n]/).map((a) => a.trim()).filter(Boolean)
    : [];

  const entry = await prisma.dnrEntry.create({
    data: {
      fullName,
      fullNameNorm: normalizeName(fullName),
      firstName: parts.first,
      middleName: parts.middle,
      lastName: parts.last,
      aliases: aliases.length ? JSON.stringify(aliases) : null,
      licenseId: licenseId || null,
      licenseIdNorm: licenseId ? normalizeLicense(licenseId) : null,
      licenseState,
      dateOfBirth: dobRaw ? new Date(dobRaw) : null,
      primaryReason,
      detailedNotes,
      severity,
      damageAmount: damageRaw ? parseFloat(damageRaw) : null,
      incidentDate: incidentDate ? new Date(incidentDate) : null,
      incidentCity,
      incidentState,
      status: "ACTIVE",
      createdById: me.id,
      photos: photoData.length ? { create: photoData } : undefined,
      reasons: { create: [{ text: primaryReason, amount: damageRaw ? parseFloat(damageRaw) : null, occurredAt: incidentDate ? new Date(incidentDate) : null }] },
    },
  });

  if (categories.length) {
    const cats = await prisma.category.findMany({ where: { slug: { in: categories } } });
    await prisma.entryCategory.createMany({
      data: cats.map((c) => ({ entryId: entry.id, categoryId: c.id })),
    });
  }

  await logAudit("entry.create", entry.id, { fullName, licenseId });
  redirect(`/entry/${entry.id}`);
}

export default async function UploadPage({ searchParams }: { searchParams: { err?: string } }) {
  const me = await requireCompany();
  if (!me) redirect("/login?next=/dashboard/upload");

  // Show a friendly gate for unverified operators instead of a blank page after submit.
  if (!isVerified(me)) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="card border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <h1 className="text-xl font-bold text-amber-200">Pending verification</h1>
          <p className="mt-2 text-sm text-amber-100/80">
            Your account is awaiting admin approval. Once verified, you can post DNR entries and broker reviews.
          </p>
          <p className="mt-3 text-xs text-amber-100/60">
            Most approvals take under 24 hours. We'll reach out at <strong>{me.email}</strong> if we need more information.
          </p>
          <Link href="/dashboard" className="btn-ghost mt-5 inline-flex">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const categories = await prisma.category.findMany({ orderBy: { label: "asc" } });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Add a new DNR entry</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Capture license ID and full name accurately — these are the two primary keys other operators will search by.
        </p>
      </header>

      {searchParams.err && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {searchParams.err === "unverified"
            ? "Your account isn't verified yet. Wait for admin approval to post entries."
            : "Please complete the required fields (full name + primary reason)."}
        </div>
      )}

      <form action={createEntry} encType="multipart/form-data" className="card divide-y divide-ink-800">
        <Section title="Identity">
          <Grid>
            <Field label="Full name *" hint="As it appears on the license, including middle name">
              <input className="input" name="fullName" required placeholder="Tyler Darrell Treasure" />
            </Field>
            <Field label="License ID" hint="Number printed on the license — primary search key">
              <input className="input font-mono" name="licenseId" placeholder="T426-789-94-321-0" />
            </Field>
            <Field label="License state">
              <input className="input" name="licenseState" maxLength={2} placeholder="FL" />
            </Field>
            <Field label="Date of birth">
              <input className="input" name="dob" type="date" />
            </Field>
            <Field label="Aliases / alternate spellings" hint="Comma-separated">
              <input className="input" name="aliases" placeholder="Ty Treasure, T. Treasure" />
            </Field>
          </Grid>
        </Section>

        <Section title="Incident">
          <Grid>
            <Field label="Primary reason *" full hint="Short summary shown in search results">
              <input className="input" name="primaryReason" required placeholder="Hit-and-run; vehicle abandonment" />
            </Field>
            <Field label="Detailed notes" full>
              <textarea className="input min-h-[100px]" name="detailedNotes" placeholder="Describe the incident in your own words…" />
            </Field>
            <Field label="Severity">
              <select className="input" name="severity" defaultValue="MEDIUM">
                <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
              </select>
            </Field>
            <Field label="Damages ($)">
              <input className="input" name="damageAmount" type="number" min="0" step="0.01" placeholder="0" />
            </Field>
            <Field label="Incident date">
              <input className="input" name="incidentDate" type="date" />
            </Field>
            <Field label="Incident city">
              <input className="input" name="incidentCity" placeholder="Miami" />
            </Field>
            <Field label="Incident state">
              <input className="input" name="incidentState" maxLength={2} placeholder="FL" />
            </Field>
          </Grid>
        </Section>

        <Section title="Categories">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {categories.map((c) => (
              <label key={c.slug} className="flex cursor-pointer items-center gap-2 rounded border border-ink-700 bg-ink-900 px-3 py-2 text-sm hover:bg-ink-800">
                <input type="checkbox" name="categories" value={c.slug} className="accent-accent" />
                {c.label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="License & damage photos">
          <Grid>
            <Field label="License (front)" hint="JPG/PNG/WebP up to 8MB">
              <input className="input" name="licenseFront" type="file" accept="image/*" />
            </Field>
            <Field label="License (back)">
              <input className="input" name="licenseBack" type="file" accept="image/*" />
            </Field>
            <Field label="Damage photos" hint="Multiple allowed" full>
              <input className="input" name="damagePhotos" type="file" accept="image/*" multiple />
            </Field>
          </Grid>
        </Section>

        <div className="flex items-center justify-end gap-3 p-5">
          <Link href="/dashboard" className="btn-link">Cancel</Link>
          <button type="submit" className="btn-primary">Submit entry</button>
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
