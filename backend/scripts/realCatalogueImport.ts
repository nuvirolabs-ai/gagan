import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  applyRealCatalogueManifest,
  buildRealCatalogueManifest,
  readImageIndex,
  type RealCatalogueManifest,
} from "../src/modules/catalog/realCatalogue";

function argument(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function printSummary(manifest: RealCatalogueManifest) {
  const counts = {
    records: manifest.records.length,
    activeReady: manifest.records.filter((record) => record.catalogStatus === "active").length,
    pendingReview: manifest.records.filter((record) => record.catalogStatus === "pending_review").length,
    exactImages: manifest.records.filter((record) => record.image.status === "matched").length,
    ambiguousImages: manifest.records.filter((record) => record.image.status === "ambiguous").length,
    missingImages: manifest.records.filter((record) => record.image.status === "missing").length,
    blockedCaseConversions: manifest.records.filter((record) => record.unitsPerCase === null || record.unitWeightKg === null).length,
  };
  console.log(JSON.stringify({ source: manifest.source, imageSource: manifest.imageSource, counts }, null, 2));
}

async function main() {
  const inputPath = argument("--input") ?? process.env.REAL_CATALOGUE_XLSX;
  if (!inputPath) throw new Error("--input=<workbook-path> is required");
  const imageIndexPath = argument("--image-index");
  const outputPath = argument("--manifest");
  const buffer = fs.readFileSync(path.resolve(inputPath));
  const manifest = buildRealCatalogueManifest(
    buffer,
    path.basename(inputPath),
    readImageIndex(imageIndexPath ? path.resolve(imageIndexPath) : undefined),
  );
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
  printSummary(manifest);
  if (!hasFlag("--apply")) {
    console.log("DRY RUN: no database write performed.");
    return;
  }
  const actorStaffId = argument("--actor");
  const targetLabel = argument("--target");
  if (!actorStaffId || !targetLabel) throw new Error("--apply requires --actor=<staff-id> and --target=<disposable-local|gagan-staging>");
  if (process.env.REAL_CATALOGUE_CONFIRM !== "REAL_CATALOGUE_V1") throw new Error("explicit catalogue apply confirmation required");
  const database = new PrismaClient();
  try {
    const result = await applyRealCatalogueManifest(database, manifest, { actorStaffId, targetLabel });
    console.log(JSON.stringify({ applied: true, result }, null, 2));
  } finally {
    await database.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "catalogue_import_failed");
  process.exitCode = 1;
});
