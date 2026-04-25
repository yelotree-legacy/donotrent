"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded px-3 py-1.5 text-sm text-neutral-300 hover:bg-ink-800 disabled:opacity-50"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.refresh();
          router.push("/");
        })
      }
    >
      {pending ? "…" : "Sign out"}
    </button>
  );
}
