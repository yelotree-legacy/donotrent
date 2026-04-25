import Link from "next/link";
import { redirect } from "next/navigation";
import { hashPassword, slugify } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

async function signupAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const phone = String(formData.get("phone") || "").trim() || null;
  const city = String(formData.get("city") || "").trim() || null;
  const state = String(formData.get("state") || "").trim().toUpperCase() || null;

  if (!name || !email || !password || password.length < 8) redirect("/signup?err=invalid");
  const exists = await prisma.company.findUnique({ where: { email } });
  if (exists) redirect("/signup?err=exists");

  let slug = slugify(name);
  for (let i = 0; await prisma.company.findUnique({ where: { slug } }); i++) {
    slug = `${slugify(name)}-${i + 2}`;
  }

  const co = await prisma.company.create({
    data: {
      name,
      slug,
      email,
      phone,
      city,
      state,
      passwordHash: await hashPassword(password),
      verified: false,
      // In free-tier mode, all new accounts default to enterprise (= unlimited).
      // Switch back to "free" trial when paid tiers re-enable.
      plan: process.env.BILLING_MODE === "paid" ? "free" : "enterprise",
    },
  });

  const session = await getSession();
  session.companyId = co.id;
  session.email = co.email;
  session.name = co.name;
  session.isAdmin = false;
  await session.save();
  redirect("/dashboard?welcome=1");
}

export default function SignupPage({ searchParams }: { searchParams: { err?: string } }) {
  const err = searchParams.err;
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Register your rental company</h1>
        <p className="mt-1 text-sm text-neutral-400">
          You'll be able to upload incidents and search across the network. Already registered?{" "}
          <Link className="text-accent underline" href="/login">Sign in</Link>.
        </p>
        {err && (
          <div className="mt-4 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {err === "exists" ? "An account with that email already exists." : "Please complete the form (password ≥ 8 chars)."}
          </div>
        )}
        <form action={signupAction} className="mt-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Company name</label>
            <input className="input" name="name" required placeholder="Apex Auto Rentals" />
          </div>
          <div className="col-span-2">
            <label className="label">Work email</label>
            <input className="input" name="email" type="email" required placeholder="ops@apexauto.com" />
          </div>
          <div className="col-span-2">
            <label className="label">Password</label>
            <input className="input" name="password" type="password" required minLength={8} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" name="phone" placeholder="(305) 555-0123" />
          </div>
          <div>
            <label className="label">City</label>
            <input className="input" name="city" placeholder="Miami" />
          </div>
          <div>
            <label className="label">State (2-letter)</label>
            <input className="input" name="state" maxLength={2} placeholder="FL" />
          </div>
          <div className="col-span-2 flex items-center gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">Create company account</button>
            <Link href="/" className="btn-link">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
