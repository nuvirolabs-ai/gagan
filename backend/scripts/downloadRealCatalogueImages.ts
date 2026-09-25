import fs from "node:fs/promises";
import path from "node:path";
import type { RealCatalogueManifest } from "../src/modules/catalog/realCatalogue";

function argument(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  const manifestPath = path.resolve(argument("--manifest") ?? "../docs/real-catalogue/real-catalogue-manifest.json");
  const outputDir = path.resolve(argument("--output") ?? "../backend/assets/catalog/real");
  const archiveDir = path.resolve(argument("--archive") ?? "/tmp/gagan-catalogue-source-20260917-drive-images");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as RealCatalogueManifest;
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(archiveDir, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  for (const record of manifest.records) {
    if (record.image.status !== "matched" || record.image.candidates.length !== 1 || !record.image.assetPath) {
      skipped += 1;
      continue;
    }
    const source = record.image.candidates[0];
    const response = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(source.driveFileId)}&export=download&confirm=t`);
    if (!response.ok) throw new Error(`image_download_failed_${source.driveFileId}_${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("image")) throw new Error(`image_content_type_invalid_${source.driveFileId}`);
    const body = Buffer.from(await response.arrayBuffer());
    const rawPath = path.join(archiveDir, `${record.variantKey.slice("real-catalogue:variant:".length)}-${safeName(source.fileName)}`);
    const assetPath = path.join(outputDir, path.basename(record.image.assetPath));
    await fs.writeFile(rawPath, body, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
      return undefined;
    });
    await fs.writeFile(assetPath, body);
    downloaded += 1;
  }
  console.log(JSON.stringify({ downloaded, skipped, outputDir, archiveDir }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "catalogue_image_download_failed");
  process.exitCode = 1;
});
