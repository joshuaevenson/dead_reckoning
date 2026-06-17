import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const rootDir = process.cwd();
const scenariosDir = join(rootDir, "scenarios");
const outputDir = join(rootDir, "src", "generated");
const outputFile = join(outputDir, "scenario-catalog.ts");

const files = (await readdir(scenariosDir))
  .filter((file) => file.endsWith(".json"))
  .sort();

const catalogEntries = [];

for (const file of files) {
  const filePath = join(scenariosDir, file);
  const raw = await readFile(filePath, "utf8");
  const scenario = JSON.parse(raw);
  const id = file.replace(/\.json$/u, "");
  catalogEntries.push([id, scenario]);
}

const source = `import type { ScenarioDefinition } from "../types.js";

export const scenarioCatalog: Record<string, ScenarioDefinition> = ${JSON.stringify(Object.fromEntries(catalogEntries), null, 2)};
`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, source);
