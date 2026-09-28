import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { seedClientUat, seedClientUatFromPaths } from "../src/modules/clientUat/clientUatSeed";
import { loadClientUatSourceManifest } from "../src/modules/clientUat/clientUatSource";

function argument(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function requiredArgument(name: string) {
  const value = argument(name);
  if (!value) throw new Error(`missing_${name.replace(/^--/, "")}`);
  return value;
}

async function main() {
  const target = process.env.CLIENT_UAT_TARGET;
  if (target !== "client-uat" && target !== "disposable-local") throw new Error("CLIENT_UAT_TARGET_MUST_BE_CLIENT_UAT_OR_DISPOSABLE_LOCAL");
  if (target === "gagan-staging" || target === "production") throw new Error("CLIENT_UAT_TARGET_PROTECTED");
  const manifest = argument("--manifest");
  const options = {
    databaseIdentity: process.env.CLIENT_UAT_DATABASE_IDENTITY,
    renderApi: process.env.CLIENT_UAT_RENDER_API,
    renderServiceId: process.env.CLIENT_UAT_RENDER_SERVICE_ID,
    adminUrl: process.env.CLIENT_UAT_ADMIN_URL,
    retailerApk: { path: process.env.CLIENT_UAT_RETAILER_APK ?? null, version: process.env.CLIENT_UAT_RETAILER_VERSION ?? null },
    salespersonApk: { path: process.env.CLIENT_UAT_SALESPERSON_APK ?? null, version: process.env.CLIENT_UAT_SALESPERSON_VERSION ?? null },
  };
  const result = manifest
    ? await seedClientUat({ source: await loadClientUatSourceManifest(manifest), ...options })
    : await seedClientUatFromPaths({
      products: requiredArgument("--products"),
      pricing: requiredArgument("--pricing"),
      retailers: requiredArgument("--retailers"),
      assignments: requiredArgument("--assignments"),
    }, options);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
