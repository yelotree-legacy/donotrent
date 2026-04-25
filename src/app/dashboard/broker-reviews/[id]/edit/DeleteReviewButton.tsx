"use client";
import { useTransition } from "react";

export function DeleteReviewButton({
  reviewId,
  action,
}: {
  reviewId: string;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("Delete this review? This cannot be undone.")) {
      e.preventDefault();
      return;
    }
  }

  return (
    <form action={action} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={reviewId} />
      <button
        type="submit"
        className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Deleting…" : "Delete review"}
      </button>
    </form>
  );
}
