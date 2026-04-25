"use client";
import { useEffect, useState } from "react";

export function Lightbox({
  photos,
}: {
  photos: { id: string; url: string; kind: string; caption?: string | null }[];
}) {
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    if (idx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowLeft") setIdx((i) => (i! > 0 ? i! - 1 : photos.length - 1));
      else if (e.key === "ArrowRight") setIdx((i) => (i! < photos.length - 1 ? i! + 1 : 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, photos.length]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setIdx(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-md border border-ink-700 bg-ink-800 transition-all hover:border-accent/50 hover:shadow-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption || p.kind}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-200">
              {p.kind.replace(/_/g, " ")}
            </div>
          </button>
        ))}
      </div>

      {idx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm fade-in"
          onClick={() => setIdx(null)}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[idx].url}
              alt={photos[idx].caption || ""}
              className="max-h-[85vh] w-auto max-w-full rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-2 left-2 rounded bg-ink-950/85 px-2 py-1 text-xs text-neutral-300 backdrop-blur">
              {photos[idx].kind.replace(/_/g, " ")} · {idx + 1} / {photos.length}
              {photos[idx].caption && <> · {photos[idx].caption}</>}
            </div>
            <button
              onClick={() => setIdx(null)}
              className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full bg-ink-900 text-white ring-1 ring-ink-700 transition-colors hover:bg-ink-800"
              aria-label="Close"
            >
              ✕
            </button>
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setIdx((i) => (i! > 0 ? i! - 1 : photos.length - 1))}
                  className="absolute -left-12 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-ink-900/80 text-white ring-1 ring-ink-700 transition-colors hover:bg-ink-800 max-md:left-2"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  onClick={() => setIdx((i) => (i! < photos.length - 1 ? i! + 1 : 0))}
                  className="absolute -right-12 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-ink-900/80 text-white ring-1 ring-ink-700 transition-colors hover:bg-ink-800 max-md:right-2"
                  aria-label="Next"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
