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

// Pair each image with the heading + paragraph that immediately follow it.
for (const img of imgs) {
  const heading = headings.find((h) => h.idx > img.idx);
  if (!heading) continue;
  const para = paras.find((p) => p.idx > heading.idx);
  out.push({
    name: heading.text,
    reason: para?.text || "",
    imageUrl: img.url,
  });
}

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
