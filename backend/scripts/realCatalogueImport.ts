import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  applyRealCatalogueManifest,
  buildRealCatalogueManifest,
  promoteRealCatalogueManifest,
  publishRealCatalogueManifest,
  retireRealCatalogueCandidates,
  readImageIndex,
  resolveRealCatalogueDecisions,
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
    published: manifest.records.filter((record) => record.catalogStatus === "published").length,
    exactImages: manifest.records.filter((record) => record.image.status === "matched").length,
    ambiguousImages: manifest.records.filter((record) => record.image.status === "ambiguous").length,
    missingImages: manifest.records.filter((record) => record.image.status === "missing").length,
    blockedCaseConversions: manifest.records.filter((record) => record.unitsPerCase === null || record.unitWeightKg === null).length,
  };
  console.log(JSON.stringify({ source: manifest.source, imageSource: manifest.imageSource, counts }, null, 2));
}

async function main() {
  const inputPath = argument("--input") ?? process.env.REAL_CATALOGUE_XLSX;
  const manifestInputPath = argument("--manifest-input");
  if (!inputPath && !manifestInputPath) throw new Error("--input=<workbook-path> or --manifest-input=<manifest.json> is required");
  const imageIndexPath = argument("--image-index");
  const outputPath = argument("--manifest");
  const manifest: RealCatalogueManifest = manifestInputPath
    ? JSON.parse(fs.readFileSync(path.resolve(manifestInputPath), "utf8")) as RealCatalogueManifest
    : (() => {
      const buffer = fs.readFileSync(path.resolve(inputPath!));
      const imageIndexBuffer = imageIndexPath ? fs.readFileSync(path.resolve(imageIndexPath)) : null;
      const built = buildRealCatalogueManifest(
        buffer,
        path.basename(inputPath!),
        readImageIndex(imageIndexPath ? path.resolve(imageIndexPath) : undefined),
      );
      if (imageIndexBuffer) built.imageSource.indexSha256 = crypto.createHash("sha256").update(imageIndexBuffer).digest("hex");
      return built;
    })();
  const decisionsPath = argument("--decisions");
  const phase = argument("--phase") ?? "import";
  if (phase !== "import" && phase !== "promote" && phase !== "publish" && phase !== "retire") throw new Error("--phase must be import, promote, publish or retire");
  let reviewedManifest = manifest;
  let decisions: unknown;
  let approvalSha256: string | undefined;
  let approvalMetadata: {
    approvalId: string;
    approvalRevision: number;
    approvalSha256: string;
    imageMappingRevision: string;
    scope: string;
  } | undefined;
  if (decisionsPath) {
    decisions = JSON.parse(fs.readFileSync(path.resolve(decisionsPath), "utf8"));
    const resolved = resolveRealCatalogueDecisions(manifest, decisions);
    reviewedManifest = resolved.manifest;
    approvalSha256 = resolved.approvalSha256;
    approvalMetadata = {
      approvalId: resolved.decisions.approval.approvalId,
      approvalRevision: resolved.decisions.approval.revision,
      approvalSha256,
      imageMappingRevision: resolved.decisions.imageMappingRevision,
      scope: resolved.decisions.approval.scope,
    };
  }
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(reviewedManifest, null, 2)}\n`, { mode: 0o644 });
  printSummary(reviewedManifest);
  if (!hasFlag("--apply")) {
    console.log(`DRY RUN (${phase}): no database write performed.${approvalSha256 ? ` approvalSha256=${approvalSha256}` : ""}`);
    return;
  }
  const actorStaffId = argument("--actor");
  const targetLabel = argument("--target");
  if (!actorStaffId || !targetLabel) throw new Error("--apply requires --actor=<staff-id> and --target=<disposable-local|gagan-staging>");
  if (process.env.REAL_CATALOGUE_CONFIRM !== "REAL_CATALOGUE_V1") throw new Error("explicit catalogue apply confirmation required");
  if ((phase === "promote" || phase === "publish" || phase === "retire") && !decisions) throw new Error(`--phase=${phase} requires --decisions=<approved-decisions.json>`);
  const targetIdentity = {
    serviceName: argument("--service"),
    serviceId: argument("--service-id"),
    hostname: argument("--hostname"),
    databaseName: argument("--database"),
    schema: argument("--schema"),
  };
  const approvedPendingGstScope = hasFlag("--approved-pending-gst-scope")
    ? (resolvedPendingGstKeys(decisions) ?? (() => { throw new Error("approved_pending_gst_scope_missing"); })())
    : undefined;
  const database = new PrismaClient();
  try {
    const result = phase === "promote"
      ? await promoteRealCatalogueManifest(database, manifest, { actorStaffId, targetLabel, decisions, targetIdentity, variantKeys: approvedPendingGstScope, includeRetireCandidates: approvedPendingGstScope === undefined })
      : phase === "publish"
        ? await publishRealCatalogueManifest(database, manifest, { actorStaffId, targetLabel, decisions, targetIdentity })
        : phase === "retire"
          ? await retireRealCatalogueCandidates(database, manifest, { actorStaffId, targetLabel, decisions, targetIdentity })
          : await applyRealCatalogueManifest(database, reviewedManifest, { actorStaffId, targetLabel, targetIdentity, approval: approvalMetadata });
    console.log(JSON.stringify({ applied: true, result }, null, 2));
  } finally {
    await database.$disconnect();
  }
}

function resolvedPendingGstKeys(value: unknown) {
  if (!value || typeof value !== "object" || !("gstPendingOrdering" in value)) return undefined;
  const scope = (value as { gstPendingOrdering?: { variantKeys?: unknown } }).gstPendingOrdering;
  return Array.isArray(scope?.variantKeys) && scope.variantKeys.every((key): key is string => typeof key === "string")
    ? scope.variantKeys
    : undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "catalogue_import_failed");
  process.exitCode = 1;
});
