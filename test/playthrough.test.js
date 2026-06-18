import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { simulateScenario } from "../dist/simulator.js";

const scenariosDir = join(process.cwd(), "scenarios");
const scenarioFiles = readdirSync(scenariosDir).filter((file) => file.endsWith(".json")).sort();

function loadScenario(fileName) {
  return JSON.parse(readFileSync(join(scenariosDir, fileName), "utf8"));
}

function scenarioTimeline(result) {
  return new Map(result.snapshots.map((snapshot) => [snapshot.date, snapshot]));
}

function assertNonNegativeNumber(value, label) {
  assert.equal(Number.isFinite(value), true, `${label} should be finite`);
  assert.equal(value >= 0, true, `${label} should not be negative`);
}

test("all bundled scenarios preserve core snapshot invariants", () => {
  for (const scenarioFile of scenarioFiles) {
    const scenario = loadScenario(scenarioFile);
    const result = simulateScenario(scenario);
    const systemIds = new Set(scenario.systems.map((system) => system.id));
    let previousSnapshot = null;

    for (const snapshot of result.snapshots) {
      for (const [systemId, system] of Object.entries(snapshot.systems)) {
        assert.equal(systemIds.has(systemId), true, `${scenarioFile} unknown system ${systemId}`);
        assertNonNegativeNumber(system.saltStockpile, `${scenarioFile} ${snapshot.date} ${systemId} salt`);
        assertNonNegativeNumber(system.metalStockpile, `${scenarioFile} ${snapshot.date} ${systemId} metal`);
        assertNonNegativeNumber(system.probeStockpile, `${scenarioFile} ${snapshot.date} ${systemId} probes`);
        assertNonNegativeNumber(system.defense, `${scenarioFile} ${snapshot.date} ${systemId} defense`);
        assertNonNegativeNumber(system.controlAgeDays, `${scenarioFile} ${snapshot.date} ${systemId} control age`);
        assertNonNegativeNumber(system.captureProgress, `${scenarioFile} ${snapshot.date} ${systemId} capture progress`);
        assertNonNegativeNumber(system.claimProgress, `${scenarioFile} ${snapshot.date} ${systemId} claim progress`);
      }

      for (const [fleetId, fleet] of Object.entries(snapshot.fleets)) {
        assertNonNegativeNumber(fleet.ships, `${scenarioFile} ${snapshot.date} ${fleetId} ships`);
        assert.equal(fleet.ships > 0, true, `${scenarioFile} ${snapshot.date} ${fleetId} must keep at least 1 ship while active`);
        assertNonNegativeNumber(fleet.cargoSalt, `${scenarioFile} ${snapshot.date} ${fleetId} cargo salt`);
        assertNonNegativeNumber(fleet.metals, `${scenarioFile} ${snapshot.date} ${fleetId} cargo metal`);

        if (fleet.status === "transit") {
          assert.equal(typeof fleet.destinationSystemId === "string", true, `${scenarioFile} ${snapshot.date} ${fleetId} transit fleet missing destination`);
          assert.equal(typeof fleet.arrivalDate === "string", true, `${scenarioFile} ${snapshot.date} ${fleetId} transit fleet missing arrival`);
          assert.equal(systemIds.has(fleet.originSystemId), true, `${scenarioFile} ${snapshot.date} ${fleetId} origin must exist`);
          assert.equal(systemIds.has(fleet.destinationSystemId), true, `${scenarioFile} ${snapshot.date} ${fleetId} destination must exist`);
          assert.equal(fleet.arrivalDate >= snapshot.date, true, `${scenarioFile} ${snapshot.date} ${fleetId} transit fleet cannot arrive in the past`);
        }

        if (fleet.status === "stationed") {
          assert.equal(typeof fleet.currentSystemId === "string", true, `${scenarioFile} ${snapshot.date} ${fleetId} stationed fleet missing system`);
          assert.equal(systemIds.has(fleet.currentSystemId), true, `${scenarioFile} ${snapshot.date} ${fleetId} stationed fleet system must exist`);
        }
      }

      for (const [probeId, probe] of Object.entries(snapshot.probes)) {
        assert.equal(systemIds.has(probe.anchorSystemId), true, `${scenarioFile} ${snapshot.date} ${probeId} anchor must exist`);

        if (probe.status === "transit") {
          assert.equal(typeof probe.originSystemId === "string", true, `${scenarioFile} ${snapshot.date} ${probeId} transit probe missing origin`);
          assert.equal(typeof probe.arrivalDate === "string", true, `${scenarioFile} ${snapshot.date} ${probeId} transit probe missing arrival`);
          assert.equal(systemIds.has(probe.originSystemId), true, `${scenarioFile} ${snapshot.date} ${probeId} origin must exist`);
          assert.equal(probe.arrivalDate >= snapshot.date, true, `${scenarioFile} ${snapshot.date} ${probeId} transit probe cannot arrive in the past`);
        }

        if (probe.status === "deployed") {
          assert.equal(probe.currentSystemId, probe.anchorSystemId, `${scenarioFile} ${snapshot.date} ${probeId} deployed probe should sit at its anchor`);
        }
      }

      for (const faction of scenario.factions) {
        const factionView = snapshot.factions[faction.id];
        assert.ok(factionView, `${scenarioFile} ${snapshot.date} missing faction snapshot for ${faction.id}`);

        const ownedSystems = Object.values(snapshot.systems).filter((system) => system.ownerId === faction.id);
        const ownedSalt = ownedSystems.reduce((total, system) => total + system.saltStockpile, 0);
        const ownedMetal = ownedSystems.reduce((total, system) => total + system.metalStockpile, 0);
        const totalShips = Object.values(snapshot.fleets)
          .filter((fleet) => fleet.factionId === faction.id)
          .reduce((total, fleet) => total + fleet.ships, 0);

        assert.equal(factionView.ownedSystems, ownedSystems.length, `${scenarioFile} ${snapshot.date} ${faction.id} owned system count drifted`);
        assert.equal(factionView.totalSaltStockpile, ownedSalt, `${scenarioFile} ${snapshot.date} ${faction.id} salt total drifted`);
        assert.equal(factionView.totalMetalStockpile, ownedMetal, `${scenarioFile} ${snapshot.date} ${faction.id} metal total drifted`);
        assert.equal(factionView.totalShips, totalShips, `${scenarioFile} ${snapshot.date} ${faction.id} ship total drifted`);

        if (previousSnapshot) {
          assert.equal(
            factionView.reportCount >= previousSnapshot.factions[faction.id].reportCount,
            true,
            `${scenarioFile} ${snapshot.date} ${faction.id} report count should not go backward`,
          );
        }
      }

      previousSnapshot = snapshot;
    }
  }
});

test("frontier expansion playthrough reaches claim then stabilizes the new holding", () => {
  const scenario = loadScenario("profile_frontier_vs_turtle.json");
  const result = simulateScenario(scenario);
  const timeline = scenarioTimeline(result);
  const opening = timeline.get("2240-04-01");
  const arrival = timeline.get("2240-04-02");
  const transfer = timeline.get("2240-04-05");
  const finale = timeline.get("2240-04-20");

  assert.equal(opening.fleets["fleet-1"].status, "transit");
  assert.equal(opening.fleets["fleet-1"].destinationSystemId, "blue_frontier_a");
  assert.equal(opening.fleets["fleet-1"].ships, 4);
  assert.equal(opening.systems.blue_home.saltStockpile < scenario.systems.find((system) => system.id === "blue_home").saltStockpile, true);

  assert.equal(arrival.fleets["fleet-1"].status, "stationed");
  assert.equal(arrival.fleets["fleet-1"].currentSystemId, "blue_frontier_a");
  assert.equal(arrival.systems.blue_frontier_a.claimProgress, 1);
  assert.equal(arrival.systems.blue_frontier_a.ownerId, null);

  assert.equal(transfer.systems.blue_frontier_a.ownerId, "blue");
  assert.equal(transfer.systems.blue_frontier_a.claimProgress, 0);
  assert.equal(transfer.factions.blue.ownedSystems, 2);

  assert.equal(finale.systems.blue_frontier_a.ownerId, "blue");
  assert.equal(finale.systems.blue_frontier_a.saltStockpile > 0, true);
  assert.equal(finale.systems.blue_frontier_a.metalStockpile > 0, true);
  assert.equal(finale.factions.blue.ownedSystems, 2);
  assert.equal(finale.factions.green.ownedSystems, 1);
});

test("starter constellation exposes a larger live frontier with probes and fleet movement", () => {
  const scenario = loadScenario("starter_constellation.json");
  const result = simulateScenario(scenario);
  const finale = result.snapshots.at(-1);

  assert.equal(result.passed, true);
  assert.equal(scenario.systems.length > 6, true);
  assert.equal(Object.keys(finale.probes).length >= 1, true);
  assert.equal(
    Object.values(finale.fleets).some((fleet) => fleet.status === "transit"),
    true,
  );
  assert.equal(finale.factions.blue.ownedSystems >= 2, true);
  assert.equal(finale.factions.green.ownedSystems >= 2, true);
});

test("probe warning playthrough delivers reconnaissance before the frontier fully falls", () => {
  const scenario = loadScenario("information_probe_warning.json");
  const result = simulateScenario(scenario);
  const timeline = scenarioTimeline(result);
  const burn = timeline.get("2240-02-02");
  const impact = timeline.get("2240-02-04");
  const finale = timeline.get("2240-02-08");

  assert.equal(burn.factions.blue.reportCount, 0);
  assert.equal(burn.fleets["fleet-2"].status, "transit");
  assert.equal(burn.fleets["fleet-2"].ships, 6);
  assert.equal(burn.fleets["fleet-2"].destinationSystemId, "frontier_west");

  assert.equal(impact.factions.blue.reportCount >= 2, true);
  assert.equal(impact.probes["probe-1"].status, "deployed");
  assert.equal(impact.probes["probe-1"].currentSystemId, "watch");
  assert.equal(impact.fleets["fleet-2"].status, "stationed");
  assert.equal(impact.fleets["fleet-2"].ships < 6, true);
  assert.equal(impact.systems.frontier_west.ownerId, "blue");

  assert.equal(finale.probes["probe-1"].status, "deployed");
  assert.equal(finale.systems.frontier_west.ownerId, "blue");
  assert.equal(finale.systems.frontier_west.captureProgress > 0, true);
  assert.equal(finale.fleets["fleet-2"].currentSystemId, "frontier_west");
});

test("sparse full-scale campaign concentrates salt into a few anchor systems and exposes current comms balance", () => {
  const scenario = loadScenario("economy_sparse_full_scale.json");
  const result = simulateScenario(scenario);
  const finale = result.snapshots.at(-1);
  const saltProducers = scenario.systems.filter((system) => system.saltProfile !== "none");
  const noSaltSystems = scenario.systems.filter((system) => system.saltProfile === "none");
  const chatPigeons = result.log.filter((line) => line.includes("chat sent pigeon")).length;

  assert.equal(result.passed, true);
  assert.equal(noSaltSystems.length > saltProducers.length, true);
  assert.equal(saltProducers.every((system) => system.id.endsWith("_home") || system.saltProfile === "productive"), true);

  assert.equal(finale.systems.disc_ore.saltStockpile, 0);
  assert.equal(finale.systems.disc_ore.ownerId, null);
  assert.equal(finale.systems.chat_ore.ownerId, null);
  assert.equal(finale.systems.center_screen.ownerId, null);

  assert.equal(chatPigeons >= 6, true);
  assert.equal(finale.factions.chat.reportCount >= 20, true);
  assert.equal(finale.factions.chat.totalSaltStockpile > finale.factions.disc.totalSaltStockpile, true);
  assert.equal(finale.factions.chat.ownedSystems, 2);
  assert.equal(finale.factions.disc.ownedSystems, 3);
});

test("long information campaign produces combat around the frontier objective and rewards prepared defense", () => {
  const scenario = loadScenario("long_horizon_information_campaign.json");
  const result = simulateScenario(scenario);
  const finale = result.snapshots.at(-1);
  const combatLog = result.log.filter((line) => line.includes("combat at crown"));
  const blockadeLog = result.log.filter((line) => line.includes("screen-") || line.includes("was intercepted"));

  assert.equal(result.passed, true);
  assert.equal(combatLog.length > 0, true);
  assert.equal(blockadeLog.length > 0, true);
  assert.equal(finale.systems.crown.ownerId, "bad");
  assert.equal(finale.systems.b_gate.ownerId, "napoleon");
  assert.equal(finale.factions.bad.reportCount >= 20, true);
  assert.equal(finale.factions.napoleon.reportCount >= 8, true);
});
