import test from "node:test";
import assert from "node:assert/strict";
import { nextTick } from "vue";
import worker from "../dist/index.js";
import { createCommandState } from "../ui/src/useCommandState.js";

function createWorkerFetch() {
  return async function workerFetch(input, init) {
    const url = typeof input === "string" ? input : input.url;
    const request = new Request(`https://example.com${url}`, init);
    return worker.fetch(request);
  };
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test("ui state loads scenario through worker and exposes player-facing reports", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.currentSeat.value?.faction.id, "blue");
  assert.equal(store.currentSeatHomeSystem.value?.name, "Sol");
  assert.equal(store.selectedSystemOverview.value?.title, "Sol");
  assert.equal(store.selectedSystemOverview.value?.homeLabel, "Your home system");
  assert.equal(store.summaryCards.value.some((card) => card.label === "Ships"), true);
  assert.equal(store.feedItems.value.some((item) => item.title.includes("Crimson Wake launched 6 ships toward Barnard's Star")), true);
  assert.equal(store.starlaneSegments.value.length > 0, true);
});

test("ui state updates probe status and feed immediately after a successful probe launch", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  store.selectSystem("enemy_home");
  await nextTick();
  await store.submitImmediateProbe("enemy_home");
  await nextTick();

  assert.equal(store.api.status, "Probe en route to Tau Ceti");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.label, "Probe arrives in 2 years");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.actionable, false);
  assert.equal(store.feedItems.value[0]?.title, "Aster Crown dispatched a probe toward Tau Ceti");
  assert.equal(store.reconSummary.value.inTransit, 1);
  assert.equal(store.reconSummary.value.onStation, 1);
  assert.equal(store.reconSummary.value.items.some((item) => item.label === "Tau Ceti" && item.status === "in_transit"), true);
  assert.equal(store.probeMarkers.value.some((marker) => marker.status === "in_transit"), true);
});

test("ui state allows direct probe travel to distant systems without route gating", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
  });

  await store.loadInitialData();
  store.selectSystem("green_frontier_a");
  await nextTick();
  await store.submitImmediateProbe("green_frontier_a");
  await nextTick();

  assert.equal(store.api.status, "Probe en route to Epsilon Eridani");
  assert.match(store.selectedSystemOverview.value?.probeStatus?.label ?? "", /^Probe arrives in /u);
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.actionable, false);
});

test("ui state disables redeploying a probe while one is already en route", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  store.selectSystem("enemy_home");
  await nextTick();
  await store.submitImmediateProbe("enemy_home");
  await nextTick();
  store.prepareProbeForSystem("enemy_home");
  await nextTick();

  assert.equal(store.ui.activeAction, "deploy_probe");
  assert.equal(store.orderSubmission.value.label, "Probe already en route");
  assert.equal(store.orderSubmission.value.disabled, true);
  assert.equal(store.ui.orderDraft.anchorId, "enemy_home");
});

test("ui state shows on-station probes as active reconnaissance", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  store.selectSystem("watch");
  await nextTick();

  assert.equal(store.selectedSystemOverview.value?.probeStatus?.label, "Probe on station");
  assert.equal(store.selectedSystemOverview.value?.canSeeLocalIntel, true);
  assert.equal(store.reconSummary.value.onStation, 1);
  assert.equal(store.reconSummary.value.items.some((item) => item.label === "Ross 154" && item.status === "on_station"), true);
});

test("ui state drafts probe orders with an affordable suggested origin", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=probe_origin_choice&seat=blue",
  });

  await store.loadInitialData();
  store.selectSystem("green_target");
  await nextTick();
  store.prepareProbeForSystem("green_target");
  await nextTick();

  assert.equal(store.ui.activeAction, "deploy_probe");
  assert.equal(store.ui.orderDraft.anchorId, "green_target");
  assert.equal(store.ui.orderDraft.probeOriginId, "blue_home");
  assert.equal(store.selectedSystem.value?.system.id, "blue_home");
  assert.equal(store.probeOriginOptions.value.some((option) => option.value === "blue_frontier"), true);
  assert.equal(store.orderSubmission.value.disabled, false);
});

test("ui state blocks probe launch from an understocked origin and succeeds after changing origin", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=probe_origin_choice&seat=blue",
  });

  await store.loadInitialData();
  store.prepareProbeForSystem("green_target");
  await nextTick();

  store.setProbeOriginSystemId("blue_frontier");
  await nextTick();
  assert.equal(store.selectedSystem.value?.system.id, "blue_frontier");
  assert.equal(store.orderSubmission.value.disabled, true);
  assert.match(store.orderSubmission.value.reason, /needs 2 salt and 1 ready probe/u);

  store.setProbeOriginSystemId("blue_home");
  await nextTick();
  assert.equal(store.orderSubmission.value.disabled, false);

  await store.submitActiveOrder();
  await nextTick();

  assert.equal(store.api.status, "Probe en route to Wolf 359");
  assert.equal(store.selectedSystem.value?.system.id, "green_target");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.label, "Probe arrives in 4 years");
  assert.equal(
    store.probeEntries.value.some(
      (probe) =>
        probe.originSystemId === "blue_home"
        && probe.anchorSystemId === "green_target"
        && probe.status === "transit",
    ),
    true,
  );
});

test("ui state supports multiple friendly probes and shows them in the recon net and on the map", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
  });

  await store.loadInitialData();
  store.selectSystem("green_frontier_a");
  await nextTick();
  await store.submitImmediateProbe("green_frontier_a");
  await nextTick();

  store.selectSystem("green_home");
  await nextTick();
  await store.submitImmediateProbe("green_home");
  await nextTick();

  assert.equal(store.reconSummary.value.inTransit, 2);
  assert.equal(store.reconSummary.value.items.some((item) => item.label === "Epsilon Eridani"), true);
  assert.equal(store.reconSummary.value.items.some((item) => item.label === "Tau Ceti"), true);
  assert.equal(store.probeMarkers.value.filter((marker) => marker.status === "in_transit").length, 2);
  assert.equal(store.snapshotSystem("blue_home")?.probeStockpile, 1);
});

test("ui state shows estimated in-transit fleet positions after a launch", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
  });

  await store.loadInitialData();
  store.setActiveAction("attack");
  store.ui.orderDraft.destinationId = "blue_frontier_b";
  store.ui.orderDraft.ships = 1;
  await nextTick();
  await store.submitActiveOrder();
  await nextTick();

  assert.equal(store.api.status, "Attack order transmitted");
  assert.equal(store.fleetMarkers.value.length > 0, true);
  assert.match(store.fleetMarkers.value[0]?.detail ?? "", /ETA/u);
});

test("ui state submits blockade orders as blockade missions", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
  });

  await store.loadInitialData();
  store.setActiveAction("blockade");
  store.ui.orderDraft.destinationId = "blue_frontier_a";
  store.ui.orderDraft.ships = 2;
  await nextTick();
  await store.submitActiveOrder();
  await nextTick();

  const issuedCommands = store.world.scenario.commands ?? [];
  const issuedCommand = issuedCommands[issuedCommands.length - 1];
  assert.equal(store.api.status, "Blockade order transmitted");
  assert.equal(issuedCommand?.type, "launch_fleet");
  assert.equal(issuedCommand?.mission, "blockade");
  assert.equal(store.orderBrief.value?.title, "Blockade Order");
});

test("ui state exposes starlanes and blockade status for the map", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=starlane_blockade_interception&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.starlaneSegments.value.length, 2);
  assert.equal(store.blockadeStatus("screen").status, "hostile");
  assert.equal(store.selectedSystemOverview.value?.laneText, "1 starlane connected");
});

test("ui state keeps production schedules and speculation in player planning state", async () => {
  const storage = createMemoryStorage();
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
    storage,
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.productionPlannerRows.value.length >= 1, true);
  assert.equal(store.productionPlannerRows.value.some((row) => row.systemId === "blue_home" && row.systemName === "Sol"), true);

  store.setProductionFocus("blue_home", "probes");
  store.setProductionQuantity("blue_home", 3);
  store.setProductionPosture("blue_home", "siege");
  store.setSpeculationText("Verdant Bastion is likely banking ships for Tau Ceti.");
  await nextTick();

  const updatedHomeRow = store.productionPlannerRows.value.find((row) => row.systemId === "blue_home");
  assert.equal(updatedHomeRow?.focus, "probes");
  assert.equal(updatedHomeRow?.quantity, 3);
  assert.equal(updatedHomeRow?.posture, "siege");
  assert.equal(store.ui.planner.speculation, "Verdant Bastion is likely banking ships for Tau Ceti.");

  const reloaded = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
    storage,
  });
  await reloaded.loadInitialData();
  await nextTick();

  const reloadedHomeRow = reloaded.productionPlannerRows.value.find((row) => row.systemId === "blue_home");
  assert.equal(reloadedHomeRow?.focus, "probes");
  assert.equal(reloadedHomeRow?.quantity, 3);
  assert.equal(reloadedHomeRow?.posture, "siege");
  assert.equal(reloaded.ui.planner.speculation, "Verdant Bastion is likely banking ships for Tau Ceti.");
});
