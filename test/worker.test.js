import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import worker from "../dist/index.js";

test("worker lists bundled scenarios", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/scenarios"),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(Array.isArray(body.scenarios), true);
  assert.equal(body.scenarios.some((scenario) => scenario.id === "economy_frontier_claim"), true);
});

test("worker returns a bundled scenario by id", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/scenarios/economy_frontier_claim"),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.name, "economy_frontier_claim");
});

test("worker /simulate returns scenario result", async () => {
  const scenario = JSON.parse(
    readFileSync(join(process.cwd(), "scenarios", "economy_frontier_claim.json"), "utf8"),
  );

  const response = await worker.fetch(
    new Request("https://example.com/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scenario),
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.passed, true);
  assert.equal(body.scenario, "economy_frontier_claim");
});
