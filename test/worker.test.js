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

test("worker /simulate supports building probes from metal and launching multiple probes with salt", async () => {
  const scenario = {
    name: "probe_build_and_launch",
    seed: 7,
    startDate: "2240-01-01",
    durationDays: 3,
    factions: [
      {
        id: "blue",
        name: "Aster Crown",
        homeSystemId: "home",
      },
    ],
    systems: [
      {
        id: "home",
        name: "Sol",
        position: { x: 0, y: 0 },
        starType: "yellow_star",
        saltProfile: "none",
        metalRichness: "poor",
        ownerId: "blue",
        saltStockpile: 10,
        metalStockpile: 10,
        probeStockpile: 0,
        infrastructure: 5,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { blue: 3 },
      },
      {
        id: "target_a",
        name: "Barnard's Star",
        position: { x: 2, y: 0 },
        starType: "red_dwarf",
        saltProfile: "none",
        metalRichness: "poor",
        ownerId: null,
        saltStockpile: 0,
        metalStockpile: 0,
        probeStockpile: 0,
        infrastructure: 0,
        defense: 0,
        controlAgeDays: 0,
      },
      {
        id: "target_b",
        name: "Wolf 359",
        position: { x: 3, y: 1 },
        starType: "red_dwarf",
        saltProfile: "none",
        metalRichness: "poor",
        ownerId: null,
        saltStockpile: 0,
        metalStockpile: 0,
        probeStockpile: 0,
        infrastructure: 0,
        defense: 0,
        controlAgeDays: 0,
      },
    ],
    commands: [
      {
        type: "build",
        at: "2240-01-01",
        factionId: "blue",
        systemId: "home",
        kind: "probe",
        quantity: 2,
      },
      {
        type: "deploy_probe",
        at: "2240-01-02",
        factionId: "blue",
        originSystemId: "home",
        anchorSystemId: "target_a",
        reportDestinationSystemId: "home",
      },
      {
        type: "deploy_probe",
        at: "2240-01-02",
        factionId: "blue",
        originSystemId: "home",
        anchorSystemId: "target_b",
        reportDestinationSystemId: "home",
      },
    ],
  };

  const response = await worker.fetch(
    new Request("https://example.com/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scenario),
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  const finalSnapshot = body.snapshots[body.snapshots.length - 1];
  const activeProbes = Object.values(finalSnapshot.probes);

  assert.equal(finalSnapshot.systems.home.probeStockpile, 0);
  assert.equal(activeProbes.length, 2);
  assert.equal(activeProbes.every((probe) => probe.status === "transit"), true);
});

test("worker /simulate keeps sub-threshold launches out of foreign telescope reports", async () => {
  const scenario = {
    name: "hidden_launch_threshold",
    seed: 9,
    startDate: "2240-01-01",
    durationDays: 2,
    factions: [
      {
        id: "blue",
        name: "Aster Crown",
        homeSystemId: "blue_home",
      },
      {
        id: "red",
        name: "Crimson Wake",
        homeSystemId: "red_home",
      },
    ],
    systems: [
      {
        id: "blue_home",
        name: "Sol",
        position: { x: 0, y: 0 },
        starType: "yellow_star",
        saltProfile: "none",
        metalRichness: "standard",
        ownerId: "blue",
        saltStockpile: 10,
        metalStockpile: 10,
        probeStockpile: 0,
        infrastructure: 5,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { blue: 3 },
      },
      {
        id: "red_home",
        name: "Tau Ceti",
        position: { x: 1, y: 0 },
        starType: "yellow_star",
        saltProfile: "none",
        metalRichness: "standard",
        ownerId: "red",
        saltStockpile: 10,
        metalStockpile: 10,
        probeStockpile: 0,
        infrastructure: 5,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { red: 2 },
      },
      {
        id: "screen",
        name: "Ross 154",
        position: { x: 1.2, y: 0 },
        starType: "red_dwarf",
        saltProfile: "none",
        metalRichness: "poor",
        ownerId: null,
        saltStockpile: 0,
        metalStockpile: 0,
        probeStockpile: 0,
        infrastructure: 0,
        defense: 0,
        controlAgeDays: 0,
      },
    ],
    routes: [
      {
        id: "red-screen",
        a: "red_home",
        b: "screen",
        distance: 0.1,
        travelDays: 3,
        headingFromA: "screen",
        headingFromB: "red",
      },
    ],
    commands: [
      {
        type: "launch_fleet",
        at: "2240-01-01",
        factionId: "red",
        originSystemId: "red_home",
        destinationSystemId: "screen",
        ships: 1,
        mission: "reinforce",
      },
    ],
  };

  const response = await worker.fetch(
    new Request("https://example.com/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scenario),
    }),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  const finalSnapshot = body.snapshots[body.snapshots.length - 1];
  const hostileFleet = Object.values(finalSnapshot.fleets).find(
    (fleet) => fleet.factionId === "red" && fleet.currentSystemId === "screen",
  );

  assert.equal(hostileFleet?.launchVisibleToOthers, false);
  assert.equal(finalSnapshot.factions.blue.reportCount, 0);
});
