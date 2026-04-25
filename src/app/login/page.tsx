import Link from "next/link";
import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth";
import { getSession } from "@/lib/session";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect("/login?err=missing");
  const co = await authenticate(email, password);
  if (!co) redirect("/login?err=invalid");
  const session = await getSession();
  session.companyId = co.id;
  session.email = co.email;
  session.name = co.name;
  session.isAdmin = co.isAdmin;
  await session.save();
  const next = String(formData.get("next") || "").trim();
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export default function LoginPage({ searchParams }: { searchParams: { err?: string; next?: string } }) {
  const err = searchParams.err;
  const next = searchParams.next || "";
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Sign in to your company</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Verified rental operators only. New here? <Link className="text-accent underline" href="/signup">Register your company</Link>.
        </p>
        {err && (
          <div className="mt-4 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {err === "invalid" ? "Invalid email or password." : "Please complete the form."}
          </div>
        )}
        <form action={loginAction} className="mt-5 space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          <div>
            <label className="label">Email</label>
            <input className="input" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary w-full">Sign in</button>
        </form>
      </div>
    </div>
  );
}
