// OCR every downloaded license image with tesseract.js. Cache plain-text output
// to scripts/out/ocr/<filename>.txt so re-running is cheap. Uses sharp to upscale
// and increase contrast — Tesseract's default settings are weak on license photos.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

type Enriched = { name: string; reason: string; imageUrl: string; localPath: string; bytes: number };

const downloads: Enriched[] = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "out", "downloads.json"), "utf8")
);

const ocrDir = join(process.cwd(), "scripts", "out", "ocr");
mkdirSync(ocrDir, { recursive: true });

async function preprocess(srcPath: string, dstPath: string) {
  if (existsSync(dstPath) && statSync(dstPath).size > 0) return;
  // Upscale 2x, grayscale, normalize, modestly sharpen.
  await sharp(srcPath)
    .resize({ width: 1800, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .jpeg({ quality: 90 })
    .toFile(dstPath);
}

(async () => {
  const worker = await createWorker("eng", 1, {
    logger: () => {},
  });
  // PSM 6 = uniform block of text, ideal for license cards.
  await worker.setParameters({ tessedit_pageseg_mode: "6" as any });

  console.log(`→ OCRing ${downloads.length} licenses…`);
  let done = 0, cached = 0, failed = 0;
  const startedAt = Date.now();

  for (const d of downloads) {
    if (!d.localPath) { failed++; continue; }
    const filename = basename(d.localPath);
    const txtPath = join(ocrDir, `${filename}.txt`);

    if (existsSync(txtPath) && statSync(txtPath).size > 0) {
      cached++;
      done++;
      continue;
    }

    const srcAbs = join(process.cwd(), "public", d.localPath);
    if (!existsSync(srcAbs)) { failed++; done++; continue; }
    const preAbs = join(ocrDir, `__pre__${filename}.jpg`);

    try {
      await preprocess(srcAbs, preAbs);
      const result = await worker.recognize(preAbs);
      writeFileSync(txtPath, result.data.text);
    } catch (e: any) {
      writeFileSync(txtPath, "");
      console.warn(`  ! OCR failed for ${filename}: ${e?.message || e}`);
      failed++;
    }

    done++;
    if (done % 5 === 0 || done === downloads.length) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      const eta = Math.round(((Date.now() - startedAt) / done) * (downloads.length - done) / 1000);
      console.log(`  …${done}/${downloads.length} (cached ${cached}, fail ${failed}) — ${elapsed}s elapsed, ~${eta}s left`);
    }
  }

  await worker.terminate();
  console.log(`✓ OCR complete (${cached} cached, ${failed} failed)`);
})();
