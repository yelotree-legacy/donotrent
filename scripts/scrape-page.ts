// Parse the cached HTML of supremesportrental.com/pages/do-not-rent-list and emit
// a JSON array of { name, reason, imageUrl } tuples. Pairs each <img data-srcset>
// with the FOLLOWING <h2 class="text-content-heading"> + <p>.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const html = readFileSync(join(process.cwd(), ".scrape-page.html"), "utf8");

// Tokenize: walk through the document grabbing each <img …> with a data-srcset and
// the next NAME (<h2 class="text-content-heading…">…</h2>) + REASON (<p>…</p>).
type Tuple = { name: string; reason: string; imageUrl: string };
const out: Tuple[] = [];

const imgRe = /<img\b[^>]*?data-srcset="([^"]+)"[^>]*>/g;
const headingRe = /<h2[^>]*class="[^"]*text-content-heading[^"]*"[^>]*>([\s\S]*?)<\/h2>/g;
const paraRe = /<div class="text-content-description rte">\s*<p>([\s\S]*?)<\/p>/g;

const imgs: { idx: number; url: string }[] = [];
const headings: { idx: number; text: string }[] = [];
const paras: { idx: number; text: string }[] = [];

for (let m: RegExpExecArray | null; (m = imgRe.exec(html)); ) {
  // pick the highest-width URL out of the srcset
  const candidates = m[1]
    .split(",")
    .map((s) => s.trim())
    .map((s) => {
      const [u, w] = s.split(/\s+/);
      const wn = parseInt(w?.replace(/\D/g, "") || "0", 10);
      return { u, wn };
    })
    .filter((x) => x.u);
  candidates.sort((a, b) => b.wn - a.wn);
  let url = candidates[0]?.u || "";
  if (url.startsWith("//")) url = "https:" + url;
  // strip the &width=... so we get the original
  url = url.replace(/&width=\d+/, "").replace(/[?&]width=\d+/, "");
  if (!url) continue;
  // skip transparent placeholder + banner
  if (url.includes("transparent.png")) continue;
  if (url.includes("DNR_BANNER")) continue;
  if (url.includes("Elite_access_logo")) continue;
  if (url.includes("ChatGPT_Image")) continue;
  imgs.push({ idx: m.index, url });
}
for (let m: RegExpExecArray | null; (m = headingRe.exec(html)); ) {
  const text = decodeEntities(m[1].replace(/<[^>]+>/g, "").trim());
  if (!text) continue;
  headings.push({ idx: m.index, text });
}
for (let m: RegExpExecArray | null; (m = paraRe.exec(html)); ) {
  const text = decodeEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  paras.push({ idx: m.index, text });
}

// On this page each entry is laid out as: <h2>Name</h2> <p>Reason</p> <img>License</img>
// (text-content block first, media block second). So pair each image with the
// immediately PRECEDING heading + paragraph, not the following one.
for (const img of imgs) {
  // Largest heading idx still less than img.idx
  let heading: typeof headings[number] | null = null;
  for (const h of headings) {
    if (h.idx < img.idx && (!heading || h.idx > heading.idx)) heading = h;
  }
  if (!heading) continue;
  // Paragraph between this heading and this image
  let para: typeof paras[number] | null = null;
  for (const p of paras) {
    if (p.idx > heading.idx && p.idx < img.idx) {
      if (!para || p.idx < para.idx) para = p;
    }
  }
  out.push({
    name: heading.text,
    reason: para?.text || "",
    imageUrl: img.url,
  });
}

// If multiple images share the same heading (e.g. front + back of license),
// the loop above produces multiple tuples with the same name — that's fine,
// they'll all attach as separate photos to the same person.

mkdirSync(join(process.cwd(), "scripts", "out"), { recursive: true });
writeFileSync(
  join(process.cwd(), "scripts", "out", "scrape.json"),
  JSON.stringify(out, null, 2)
);
console.log(`Wrote ${out.length} tuples to scripts/out/scrape.json`);
console.log(`(${imgs.length} images, ${headings.length} headings, ${paras.length} paragraphs)`);

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(parseInt(c, 10)));
}
