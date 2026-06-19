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

function createScenarioFetch(scenariosById) {
  return async function scenarioFetch(input, init) {
    const url = typeof input === "string" ? input : input.url;
    const requestUrl = new URL(url, "https://example.com");

    if (requestUrl.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.pathname === "/api/scenarios") {
      return new Response(
        JSON.stringify({
          scenarios: Object.keys(scenariosById).map((id) => ({ id })),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (requestUrl.pathname.startsWith("/api/scenarios/")) {
      const scenarioId = decodeURIComponent(requestUrl.pathname.slice("/api/scenarios/".length));
      const scenario = scenariosById[scenarioId];
      return scenario
        ? new Response(JSON.stringify(scenario), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
        : new Response("missing scenario", { status: 404 });
    }

    if (requestUrl.pathname === "/api/simulate") {
      return worker.fetch(new Request(`https://example.com${requestUrl.pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: init?.body,
      }));
    }

    return new Response("not found", { status: 404 });
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
  assert.equal(store.feedItems.value.some((item) => item.title.includes("Crimson Wake launched an estimated 6 ships toward Barnard's Star")), true);
  assert.equal(store.starlaneSegments.value.length > 0, true);
});

test("ui state defaults to the larger starter constellation for local play", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.testHarness.activeScenarioId, "starter_constellation");
  assert.equal(store.currentSeat.value?.faction.id, "blue");
  assert.equal(store.world.scenario.systems.length > 6, true);
  assert.equal(store.starlaneSegments.value.length >= 10, true);
  assert.equal(store.feedItems.value.length > 0, true);
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
  assert.equal(store.ui.activeWorkspace, "probes");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.label, "Probe arrives in 2 years");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.actionable, false);
  assert.equal(store.feedItems.value[0]?.title, "Aster Crown dispatched a probe toward Tau Ceti");
  assert.equal(store.reconSummary.value.inTransit, 1);
  assert.equal(store.reconSummary.value.onStation, 1);
  assert.equal(store.reconSummary.value.items.some((item) => item.label === "Tau Ceti" && item.status === "in_transit"), true);
  assert.equal(store.probeMarkers.value.some((marker) => marker.status === "in_transit"), true);
});

test("ui state tracks workspace navigation and returns to map for command drafting", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.ui.activeWorkspace, "map");

  store.setActiveWorkspace("reports");
  await nextTick();
  assert.equal(store.ui.activeWorkspace, "reports");

  store.setActiveWorkspace("probes");
  await nextTick();
  assert.equal(store.ui.activeWorkspace, "probes");

  store.setActiveWorkspace("notebook");
  await nextTick();
  assert.equal(store.ui.activeWorkspace, "notebook");

  store.setActiveAction("trade");
  await nextTick();
  assert.equal(store.ui.activeWorkspace, "map");

  store.setActiveWorkspace("reports");
  store.prepareProbeForSystem("enemy_home");
  await nextTick();
  assert.equal(store.ui.activeWorkspace, "map");
  assert.equal(store.ui.activeAction, "deploy_probe");
  assert.equal(store.ui.orderDraft.anchorId, "enemy_home");
});

test("ui state can execute from the map dock without a selected star and expose ship operations data", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  store.setSelectedSystemId(null);
  await nextTick();

  assert.equal(store.ui.orderDraft.originSystemId, null);
  assert.match(store.orderSubmission.value.reason, /Choose a friendly origin system/u);
  assert.equal(store.actionUnderway.value.items.length, 0);

  store.ui.orderDraft.originSystemId = store.currentSeat.value?.faction.homeSystemId ?? "blue_home";
  store.ui.orderDraft.destinationId = store.destinationOptions.value[0]?.value ?? null;
  store.ui.orderDraft.ships = 1;
  await store.submitActiveOrder();
  await nextTick();

  assert.equal(store.actionUnderway.value.items.length >= 1, true);
  assert.match(store.actionUnderway.value.title, /mission.*underway/u);
  assert.equal(store.shipOperationRows.value.length >= 1, true);
  assert.equal(store.shipOperationSummary.value.total >= 1, true);
  assert.equal(store.shipOperationOriginRows.value.length >= 1, true);

  store.prepareProbeForSystem("enemy_home");
  await nextTick();

  assert.match(store.actionUnderway.value.summary, /No friendly probe is currently assigned/u);

  await store.submitActiveOrder();
  await nextTick();

  assert.equal(store.actionUnderway.value.items.length >= 1, true);
  assert.match(store.actionUnderway.value.title, /probe mission/u);
});

test("ui state can triage reports into archive and notebook follow-up, and restore them later", async () => {
  const storage = createMemoryStorage();
  const options = {
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
    storage,
  };
  const store = createCommandState(options);

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.feedItems.value.length >= 2, true);
  const followUpItem = store.feedItems.value[0];
  const archiveItem = store.feedItems.value[1];

  store.markReportForFollowUp(followUpItem);
  await nextTick();
  store.archiveReportItem(archiveItem);
  await nextTick();

  assert.equal(store.feedItems.value.some((item) => item.id === followUpItem.id), false);
  assert.equal(store.feedItems.value.some((item) => item.id === archiveItem.id), false);
  assert.equal(store.notebookTodoItems.value.some((item) => item.id === followUpItem.id), true);
  assert.equal(store.archivedReportItems.value.some((item) => item.id === archiveItem.id), true);

  const reloadedStore = createCommandState(options);
  await reloadedStore.loadInitialData();
  await nextTick();

  assert.equal(reloadedStore.notebookTodoItems.value.some((item) => item.id === followUpItem.id), true);
  assert.equal(reloadedStore.archivedReportItems.value.some((item) => item.id === archiveItem.id), true);

  reloadedStore.restoreReportToInbox(followUpItem.id);
  await nextTick();

  assert.equal(reloadedStore.notebookTodoItems.value.some((item) => item.id === followUpItem.id), false);
  assert.equal(reloadedStore.feedItems.value.some((item) => item.id === followUpItem.id), true);
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

test("ui state exposes dedicated probe workspace data for active probes and ready depots", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.reconSummary.value.total >= 1, true);
  assert.equal(store.probeCommandRows.value.some((row) => row.systemName === "Sol"), true);
  assert.equal(store.probeCommandRows.value.some((row) => row.readyProbes >= 0), true);
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
  assert.equal(store.selectedSystem.value?.system.id, "green_target");
  assert.equal(store.probeOriginOptions.value.some((option) => option.value === "blue_frontier"), true);
  assert.equal(store.orderSubmission.value.disabled, false);
  assert.match(store.api.status, /Probe draft ready/u);
});

test("ui state blocks probe launch from an understocked origin and succeeds after changing origin", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=probe_origin_choice&seat=blue",
  });

  await store.loadInitialData();
  store.prepareProbeForSystem("green_target");
  await nextTick();

  assert.equal(store.selectedSystemFriendly.value, false);
  assert.equal(store.orderSubmission.value.label, "Dispatch Probe");
  assert.equal(store.orderSubmission.value.disabled, false);

  store.setProbeOriginSystemId("blue_frontier");
  await nextTick();
  assert.equal(store.selectedSystem.value?.system.id, "green_target");
  assert.equal(store.orderSubmission.value.disabled, true);
  assert.match(store.orderSubmission.value.reason, /needs 2 salt and 1 ready probe/u);

  store.setProbeOriginSystemId("blue_home");
  await nextTick();
  assert.equal(store.selectedSystem.value?.system.id, "green_target");
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
  assert.equal(store.ui.activeWorkspace, "probes");
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
  assert.match(store.fleetMarkers.value[0]?.detail ?? "", /Cargo: 0 salt, 0 metals/u);
});

test("ui state shows hostile transit signatures as estimates", async () => {
  const scenario = {
    name: "public_hostile_transit",
    seed: 3,
    startDate: "2240-01-01",
    durationDays: 3,
    factions: [
      { id: "blue", name: "Aster Crown", homeSystemId: "blue_home" },
      { id: "red", name: "Crimson Wake", homeSystemId: "red_home" },
    ],
    systems: [
      {
        id: "blue_home",
        name: "Sol",
        position: { x: 0, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "blue",
        saltStockpile: 20,
        metalStockpile: 20,
        probeStockpile: 0,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { blue: 4 },
      },
      {
        id: "red_home",
        name: "Tau Ceti",
        position: { x: 2, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "red",
        saltStockpile: 400,
        metalStockpile: 20,
        probeStockpile: 1,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { red: 8 },
      },
      {
        id: "frontier",
        name: "Barnard's Star",
        position: { x: 9, y: 0 },
        starType: "red_dwarf",
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
        id: "red-frontier",
        a: "red_home",
        b: "frontier",
        distance: 4,
        travelDays: 4,
        headingFromA: "frontier",
        headingFromB: "red",
      },
    ],
    commands: [
      {
        type: "launch_fleet",
        at: "2240-01-01",
        factionId: "red",
        originSystemId: "red_home",
        destinationSystemId: "frontier",
        ships: 6,
        cargoSalt: 4,
        metals: 3,
        mission: "attack",
      },
    ],
  };

  const store = createCommandState({
    fetchImpl: createScenarioFetch({ public_hostile_transit: scenario }),
    locationSearch: "?scenario=public_hostile_transit&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.fleetMarkers.value.length, 1);
  assert.match(store.fleetMarkers.value[0]?.label ?? "", /^~/u);
  assert.match(store.fleetMarkers.value[0]?.detail ?? "", /Estimated foreign transit/u);
  assert.match(store.fleetMarkers.value[0]?.detail ?? "", /Estimated cargo:/u);
});

test("ui state hides sub-threshold foreign launches from other seats", async () => {
  const scenario = {
    name: "hidden_hostile_launch",
    seed: 5,
    startDate: "2240-01-01",
    durationDays: 3,
    factions: [
      { id: "blue", name: "Aster Crown", homeSystemId: "blue_home" },
      { id: "red", name: "Crimson Wake", homeSystemId: "red_home" },
    ],
    systems: [
      {
        id: "blue_home",
        name: "Sol",
        position: { x: 0, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "blue",
        saltStockpile: 20,
        metalStockpile: 20,
        probeStockpile: 0,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { blue: 4 },
      },
      {
        id: "red_home",
        name: "Tau Ceti",
        position: { x: 1, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "red",
        saltStockpile: 20,
        metalStockpile: 20,
        probeStockpile: 1,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { red: 3 },
      },
      {
        id: "screen",
        name: "Ross 154",
        position: { x: 1.2, y: 0 },
        starType: "red_dwarf",
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
        travelDays: 4,
        headingFromA: "screen",
        headingFromB: "red",
      },
    ],
    commands: [
      {
        type: "deploy_probe",
        at: "2240-01-01",
        factionId: "red",
        originSystemId: "red_home",
        anchorSystemId: "screen",
        reportDestinationSystemId: "red_home",
      },
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

  const store = createCommandState({
    fetchImpl: createScenarioFetch({ hidden_hostile_launch: scenario }),
    locationSearch: "?scenario=hidden_hostile_launch&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.fleetMarkers.value.length, 0);
  assert.equal(
    store.feedItems.value.some((item) => /Crimson Wake/u.test(item.title)),
    false,
  );
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
  assert.equal(store.productionPlannerRows.value.find((row) => row.systemId === "blue_home")?.shipyardCount, 3);

  store.setProductionFocus("blue_home", "probes");
  store.setProductionQuantity("blue_home", 3);
  store.setProductionLineFocus("blue_home", "yard_2", "shipyard");
  store.setProductionLineQuantity("blue_home", "yard_2", 1);
  store.setProductionPosture("blue_home", "siege");
  store.setSpeculationText("Verdant Bastion is likely banking ships for Tau Ceti.");
  await nextTick();

  const updatedHomeRow = store.productionPlannerRows.value.find((row) => row.systemId === "blue_home");
  assert.equal(updatedHomeRow?.focus, "probes");
  assert.equal(updatedHomeRow?.quantity, 3);
  assert.equal(updatedHomeRow?.posture, "siege");
  assert.equal(updatedHomeRow?.lines.find((line) => line.id === "yard_2")?.focus, "shipyard");
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
  assert.equal(reloadedHomeRow?.lines.find((line) => line.id === "yard_2")?.focus, "shipyard");
  assert.equal(reloaded.ui.planner.speculation, "Verdant Bastion is likely banking ships for Tau Ceti.");
});
