import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/auth";
import { isFreeTier } from "@/lib/billing-mode";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await requireCompany();
  if (!me) redirect("/login?err=auth");
  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="card sticky top-20 self-start p-3">
        <div className="px-2 pb-3 pt-1">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Signed in as</div>
          <div className="mt-1 truncate text-sm font-semibold text-white">{me.name}</div>
          <div className="truncate text-xs text-neutral-500">{me.email}</div>
          {!me.verified && (
            <div className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-[10px] uppercase text-amber-300">Pending verification</div>
          )}
        </div>
        <nav className="space-y-0.5 text-sm">
          <NavLink href="/dashboard" label="Overview" />
          <NavLink href="/dashboard/entries" label="My entries" />
          <NavLink href="/dashboard/upload" label="+ New entry" />
          <NavLink href="/dashboard/reports" label="My reports" />
          <NavLink href="/dashboard/api" label="API" />
          {!isFreeTier() && <NavLink href="/dashboard/billing" label="Billing" />}
          {me.isAdmin && <NavLink href="/dashboard/admin" label="Admin" />}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block rounded px-2 py-1.5 text-neutral-300 hover:bg-ink-800">
      {label}
    </Link>
  );
}
