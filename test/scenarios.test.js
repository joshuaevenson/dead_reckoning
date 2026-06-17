import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { simulateScenario } from "../dist/simulator.js";

const scenariosDir = join(process.cwd(), "scenarios");
const scenarioFiles = readdirSync(scenariosDir).filter((file) => file.endsWith(".json")).sort();

for (const scenarioFile of scenarioFiles) {
  test(`scenario ${scenarioFile}`, () => {
    const raw = readFileSync(join(scenariosDir, scenarioFile), "utf8");
    const scenario = JSON.parse(raw);
    const result = simulateScenario(scenario);

    assert.equal(
      result.passed,
      true,
      `${scenarioFile} failed:\n${JSON.stringify(result.assertions, null, 2)}\n${result.log.join("\n")}`,
    );
  });
}
