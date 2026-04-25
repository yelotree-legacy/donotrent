"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type LinkSpec = { href: string; label: string; primary?: boolean };

export function MobileNav({
  signedIn,
  signOut,
}: {
  signedIn: boolean;
  signOut: React.ReactNode; // server-rendered button placeholder
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const links: LinkSpec[] = signedIn
    ? [
        { href: "/search", label: "Search" },
        { href: "/check", label: "Rent Report" },
        { href: "/browse", label: "Browse" },
        { href: "/sources", label: "Sources" },
        { href: "/pricing", label: "Pricing" },
        { href: "/dashboard", label: "Dashboard" },
        { href: "/dashboard/api", label: "API" },
        { href: "/dashboard/billing", label: "Billing" },
        { href: "/dashboard/upload", label: "+ Upload entry", primary: true },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/pricing", label: "Pricing" },
        { href: "/login", label: "Sign in" },
        { href: "/signup", label: "Register", primary: true },
      ];

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-md border border-ink-700 bg-ink-900/60 text-neutral-200 transition hover:bg-ink-800 md:hidden"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm fade-in"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute right-0 top-0 flex h-full w-72 flex-col border-l border-ink-800 bg-ink-950 shadow-2xl shadow-black/60 slide-up">
            <div className="flex items-center justify-between border-b border-ink-800 p-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Menu</span>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-neutral-400 hover:bg-ink-800 hover:text-white" aria-label="Close menu">
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-0.5">
                {links.map((l) => {
                  const active = pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href));
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className={
                          l.primary
                            ? "btn-primary w-full justify-center my-1"
                            : `block rounded-md px-3 py-2.5 text-sm transition-colors ${
                                active
                                  ? "bg-accent/15 text-red-300"
                                  : "text-neutral-200 hover:bg-ink-800"
                              }`
                        }
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            {signedIn && <div className="border-t border-ink-800 p-3">{signOut}</div>}
          </nav>
        </div>
      )}
    </>
  );
}

function MenuIcon() {
  return (
    <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
