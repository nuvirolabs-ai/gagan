import "dotenv/config";
import fs from "node:fs/promises";
import { loadClientUatSource } from "../src/modules/clientUat/clientUatSource";

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
  const source = await loadClientUatSource({
    products: requiredArgument("--products"),
    pricing: requiredArgument("--pricing"),
    retailers: requiredArgument("--retailers"),
    assignments: requiredArgument("--assignments"),
  });
  const output = requiredArgument("--output");
  await fs.writeFile(output, `${JSON.stringify(source, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, counts: source.counts, sourceFiles: source.sources }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
