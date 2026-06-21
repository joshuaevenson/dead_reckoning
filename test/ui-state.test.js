import test from "node:test";
import assert from "node:assert/strict";
import { nextTick } from "vue";
import worker from "../dist/index.js";
import {
  composeCouncilStateFromEvidence,
  councilStateOverlayPipeline,
  resolveCouncilStateFromEvidence,
} from "../src/council.js";
import {
  diplomaticPigeonOverlayPipeline,
  resolveDiplomaticPigeonSchema,
} from "../src/symbolic-schemas.js";
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

test("council composition derives commander and advisor notes from the same evidence", () => {
  const councilState = composeCouncilStateFromEvidence([
    {
      id: "evidence:probe-launch",
      date: "2240-01-03",
      eventType: "recon_launch",
      kicker: "Recon launched",
      title: "Aster Crown dispatched a probe toward Tau Ceti",
      summary: "Sol launched a probe toward Tau Ceti. Expected arrival in 2 years.",
      analysis: "When it arrives, exact local defense, ships, and stores will become visible for that system.",
      tone: "info",
      sourceLine: "Sol · Recon Wing",
      friendlySource: true,
      sourceActorName: "Recon Wing",
      sourceActorRole: "Recon Wing",
    },
  ]);

  assert.equal(councilState.actors.some((actor) => actor.kind === "advisor"), true);
  assert.equal(councilState.actors.some((actor) => actor.kind === "commander"), true);
  assert.equal(councilState.beliefs.length, 2);
  assert.equal(councilState.notes.length, 2);
  assert.equal(councilState.notes.some((note) => note.actorKind === "advisor" && /warning time/u.test(note.analysis)), true);
  assert.equal(councilState.notes.some((note) => note.actorKind === "commander" && /lane kept quiet/u.test(note.analysis)), true);
});

test("council composition derives competing advisor takes from the same hostile evidence", () => {
  const councilState = composeCouncilStateFromEvidence([
    {
      id: "evidence:incoming-threat",
      date: "2240-01-05",
      eventType: "incoming_threat",
      kicker: "Incoming threat",
      title: "Crimson Wake launched an estimated 6 ships toward Barnard's Star",
      summary: "Crimson Wake departed Tau Ceti for Barnard's Star. Estimated arrival in 2 days.",
      analysis: "The hostile force is large enough to pressure local control if it lands cleanly.",
      tone: "warn",
      sourceLine: "Tau Ceti · Telescope Net",
      friendlySource: false,
    },
  ]);

  const advisorNotes = councilState.notes.filter((note) => note.actorKind === "advisor");
  assert.equal(advisorNotes.length, 2);
  assert.equal(advisorNotes.some((note) => note.actorName === "Marshal Hale" && note.stance === "meet_force"), true);
  assert.equal(advisorNotes.some((note) => note.actorName === "Steward Sen" && note.stance === "preserve_reserve"), true);
  assert.equal(advisorNotes.some((note) => /tempo pressure/u.test(note.analysis)), true);
  assert.equal(advisorNotes.some((note) => /depots and relief routes/u.test(note.analysis)), true);
  assert.equal(advisorNotes.every((note) => note.confidenceLabel.length > 0 && note.reasoning.length > 0), true);
});

test("council overlay pipeline accepts validated enrichment without forking symbolic composition", async () => {
  const evidenceItems = [
    {
      id: "evidence:probe-launch",
      date: "2240-01-03",
      eventType: "recon_launch",
      kicker: "Recon launched",
      title: "Aster Crown dispatched a probe toward Tau Ceti",
      summary: "Sol launched a probe toward Tau Ceti. Expected arrival in 2 years.",
      analysis: "When it arrives, exact local defense, ships, and stores will become visible for that system.",
      tone: "info",
      sourceLine: "Sol · Recon Wing",
      friendlySource: true,
      sourceActorName: "Recon Wing",
      sourceActorRole: "Recon Wing",
    },
  ];

  const baseline = composeCouncilStateFromEvidence(evidenceItems);
  const result = await councilStateOverlayPipeline.run(evidenceItems, {
    aiMode: "simulated",
    enrich: ({ composed }) => ({
      ...composed,
      notes: composed.notes.map((note) => ({
        ...note,
        analysis: `Enriched: ${note.analysis}`,
      })),
    }),
  });

  assert.equal(result.meta.stageState.enrich, "completed");
  assert.equal(result.meta.stageState.validate, "completed");
  assert.equal(result.output.notes.length, baseline.notes.length);
  assert.equal(result.output.notes.every((note) => note.analysis.startsWith("Enriched: ")), true);
});

test("council state resolver keeps the symbolic output shape while honoring simulated mode", async () => {
  const evidenceItems = [
    {
      id: "evidence:probe-launch",
      date: "2240-01-03",
      eventType: "recon_launch",
      kicker: "Recon launched",
      title: "Aster Crown dispatched a probe toward Tau Ceti",
      summary: "Sol launched a probe toward Tau Ceti. Expected arrival in 2 years.",
      analysis: "When it arrives, exact local defense, ships, and stores will become visible for that system.",
      tone: "info",
      sourceLine: "Sol · Recon Wing",
      friendlySource: true,
      sourceActorName: "Recon Wing",
      sourceActorRole: "Recon Wing",
    },
  ];

  const result = await resolveCouncilStateFromEvidence(evidenceItems, {
    runtimeCapabilities: {
      ai: {
        mode: "simulated",
      },
    },
    enrich: ({ composed }) => ({
      ...composed,
      notes: composed.notes.map((note) => ({
        ...note,
        analysis: `Simulated: ${note.analysis}`,
      })),
    }),
  });

  assert.equal(Array.isArray(result.actors), true);
  assert.equal(Array.isArray(result.beliefs), true);
  assert.equal(Array.isArray(result.notes), true);
  assert.equal(result.notes.every((note) => note.analysis.startsWith("Simulated: ")), true);
});

test("diplomatic overlay pipeline falls back to the symbolic baseline when enrichment fails validation", async () => {
  const input = {
    report: {
      id: "report:pigeon",
      type: "dispatch",
      factionId: "blue",
      availableDate: "2240-01-07",
      observedAt: "2240-01-06",
      sourceSystemId: "sol",
      content: {
        packetType: "diplomatic",
        destinationSystemId: "barnards_star",
        entries: [
          "intent:threaten",
          "subject:barnards_star",
          "message:Withdraw from Barnard's Star before we answer with force.",
        ],
      },
    },
    senderFaction: {
      id: "red",
      name: "Crimson Wake",
      profile: {
        frame: "dynasty",
        doctrine: "Advance before rivals can settle the frontier.",
        values: ["expansion", "prestige", "discipline"],
        voice: {
          seed: "imperious",
          style: "court-command certainty",
          signoff: "By imperial prerogative",
        },
      },
    },
    recipientFaction: {
      id: "blue",
      name: "Aster Crown",
    },
    leverage: "high",
    getSystemName(systemId) {
      if (systemId === "sol") {
        return "Sol";
      }
      if (systemId === "barnards_star") {
        return "Barnard's Star";
      }
      return systemId;
    },
  };

  const baseline = diplomaticPigeonOverlayPipeline.runSymbolic(input).output;
  const result = await diplomaticPigeonOverlayPipeline.run(input, {
    aiMode: "simulated",
    enrich: () => ({
      id: "broken-pigeon",
      packetType: "diplomatic",
      rendered: {
        title: 7,
      },
    }),
  });

  assert.equal(result.meta.stageState.enrich, "completed");
  assert.equal(result.meta.stageState.validate, "failed");
  assert.deepEqual(result.output, baseline);
});

test("diplomatic schema resolver keeps the symbolic shape while honoring simulated mode", async () => {
  const result = await resolveDiplomaticPigeonSchema({
    report: {
      id: "report:pigeon",
      type: "dispatch",
      factionId: "blue",
      availableDate: "2240-01-07",
      observedAt: "2240-01-06",
      sourceSystemId: "sol",
      content: {
        packetType: "diplomatic",
        destinationSystemId: "barnards_star",
        entries: [
          "intent:clarify",
          "subject:barnards_star",
        ],
      },
    },
    senderFaction: {
      id: "red",
      name: "Crimson Wake",
      profile: {
        frame: "dynasty",
        doctrine: "Advance before rivals can settle the frontier.",
        values: ["expansion", "prestige", "discipline"],
        voice: {
          seed: "imperious",
          style: "court-command certainty",
          signoff: "By imperial prerogative",
        },
      },
    },
    recipientFaction: {
      id: "blue",
      name: "Aster Crown",
    },
    leverage: "balanced",
    getSystemName(systemId) {
      if (systemId === "sol") {
        return "Sol";
      }
      if (systemId === "barnards_star") {
        return "Barnard's Star";
      }
      return systemId;
    },
  }, {
    runtimeCapabilities: {
      ai: {
        mode: "simulated",
      },
    },
    enrich: ({ composed }) => ({
      ...composed,
      rendered: {
        ...composed.rendered,
        analysis: `Simulated: ${composed.rendered.analysis}`,
      },
    }),
  });

  assert.equal(result.packetType, "diplomatic");
  assert.equal(result.rendered.analysis.startsWith("Simulated: "), true);
});

test("ui state loads scenario through worker and exposes player-facing reports", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.currentSeat.value?.faction.id, "blue");
  assert.equal(store.currentSeatHomeSystem.value?.name, "Sol");
  assert.equal(store.runtimeCapabilities.value.ai.mode, "off");
  assert.equal(store.runtimeCapabilities.value.surfaces.some((surface) => surface.id === "advisor_desk"), true);
  assert.deepEqual(
    store.runtimeCapabilities.value.surfaces.find((surface) => surface.id === "advisor_desk")?.overlayPipeline?.stages,
    ["derive", "compose", "enrich", "validate"],
  );
  assert.equal(store.selectedSystemOverview.value?.title, "Sol");
  assert.equal(store.selectedSystemOverview.value?.homeLabel, "Your home system");
  assert.equal(store.summaryCards.value.some((card) => card.label === "Ships"), true);
  assert.equal(store.feedItems.value.some((item) => item.title.includes("Crimson Wake launched an estimated 6 ships toward Barnard's Star")), true);
  assert.equal(store.feedItems.value.some((item) => item.advisorName && item.advisorRole && item.analysis.length > 0), true);
  assert.equal(store.starlaneSegments.value.length > 0, true);
});

test("ui state forwards the ai mode override through the worker runtime contract", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue&ai=simulated",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.runtimeCapabilities.value.ai.requestedMode, "simulated");
  assert.equal(store.runtimeCapabilities.value.ai.mode, "simulated");
  assert.equal(store.runtimeCapabilities.value.ai.provider.status, "simulated");
});

test("advisor desk policy keeps map truth off the reports surface", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.advisorDeskPolicy.advisorOnly, true);
  assert.equal(store.advisorDeskPolicy.mapOwnsWorldIntel, true);
  assert.equal(store.advisorDeskPolicy.showDiplomaticInbox, false);
  assert.equal(store.advisorDeskPolicy.showArchive, true);
  assert.equal(store.advisorDeskPolicy.showRawSignals, false);
  assert.equal(store.advisorDeskPolicy.showReconSummary, false);
  assert.equal(store.advisorDeskPolicy.showFocusedSystem, false);
  assert.match(store.advisorDeskPolicy.mapGuidance, /galaxy map/u);
});

test("ui state keeps split advisor readings as separate missives tied to the same signal", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  const sourceCounts = new Map();
  for (const item of store.feedItems.value.filter((note) => note.actorKind === "advisor" && note.kicker !== "Morning brief")) {
    sourceCounts.set(item.sourceEvidenceId, (sourceCounts.get(item.sourceEvidenceId) ?? 0) + 1);
  }

  const sharedSourceId = [...sourceCounts.entries()].find(([, count]) => count >= 2)?.[0] ?? null;
  const disagreementNotes = store.feedItems.value.filter((note) => note.sourceEvidenceId === sharedSourceId);
  assert.equal(Boolean(sharedSourceId), true);
  assert.equal(disagreementNotes.length >= 2, true);
  assert.equal(
    new Set(disagreementNotes.filter((note) => note.actorKind === "advisor").map((note) => note.actorId)).size >= 2,
    true,
  );
  assert.equal(disagreementNotes.every((note) => note.sourceEvidenceId === sharedSourceId), true);
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
  assert.equal(store.ui.activeWorkspace, "map");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.label, "Probe arrives in 2 years");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.actionable, false);
  assert.equal(
    store.feedItems.value.some((item) => item.title === "Aster Crown dispatched a probe toward Tau Ceti"),
    true,
  );
  assert.equal(
    store.feedItems.value.some((item) => item.actorKind === "commander" && item.title === "Aster Crown dispatched a probe toward Tau Ceti"),
    true,
  );
  assert.equal(
    store.sourceLedgerItems.value.some((item) => item.title === "Aster Crown dispatched a probe toward Tau Ceti"),
    true,
  );
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

  assert.equal(store.ui.activeWorkspace, "reports");
  assert.equal(store.WORKSPACE_VIEWS[0].key, "reports");
  assert.equal(store.WORKSPACE_VIEWS[0].label, "Advisors");
  assert.equal(store.WORKSPACE_VIEWS[1].key, "map");
  assert.equal(store.WORKSPACE_VIEWS[1].label, "Galaxy");
  assert.deepEqual(store.WORKSPACE_VIEWS.map((view) => view.key), ["reports", "map", "diplomacy", "notebook"]);

  store.setActiveWorkspace("reports");
  await nextTick();
  assert.equal(store.ui.activeWorkspace, "reports");

  store.setActiveWorkspace("diplomacy");
  await nextTick();
  assert.equal(store.ui.activeWorkspace, "diplomacy");

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

test("ui state exposes a diplomacy board with inferred rival stances", async () => {
  const scenario = {
    name: "diplomacy_board",
    seed: 9,
    startDate: "2240-01-01",
    durationDays: 2,
    factions: [
      { id: "blue", name: "Aster Crown", homeSystemId: "blue_home" },
      { id: "red", name: "Crimson Wake", homeSystemId: "red_home" },
      { id: "green", name: "Verdant League", homeSystemId: "green_home" },
    ],
    systems: [
      {
        id: "blue_home",
        name: "Sol",
        position: { x: 0, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "blue",
        saltStockpile: 25,
        metalStockpile: 18,
        probeStockpile: 1,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { blue: 5 },
      },
      {
        id: "red_home",
        name: "Tau Ceti",
        position: { x: 3, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "red",
        saltStockpile: 100,
        metalStockpile: 20,
        probeStockpile: 0,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { red: 7 },
      },
      {
        id: "green_home",
        name: "Epsilon Eridani",
        position: { x: 14, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "green",
        saltStockpile: 55,
        metalStockpile: 22,
        probeStockpile: 0,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { green: 6 },
      },
    ],
    routes: [
      {
        id: "blue-red",
        a: "blue_home",
        b: "red_home",
        distance: 3,
        travelDays: 3,
        headingFromA: "red",
        headingFromB: "blue",
      },
    ],
    commands: [
      {
        type: "launch_fleet",
        at: "2240-01-01",
        factionId: "red",
        originSystemId: "red_home",
        destinationSystemId: "blue_home",
        ships: 4,
        mission: "attack",
      },
    ],
  };

  const store = createCommandState({
    fetchImpl: createScenarioFetch({ diplomacy_board: scenario }),
    locationSearch: "?scenario=diplomacy_board&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.WORKSPACE_VIEWS.some((view) => view.key === "diplomacy"), true);
  assert.equal(store.diplomacyRows.value.length, 2);
  assert.equal(store.diplomacySummary.value.hostile, 1);

  const hostileRow = store.diplomacyRows.value.find((row) => row.factionId === "red");
  const distantRow = store.diplomacyRows.value.find((row) => row.factionId === "green");

  assert.equal(hostileRow?.stanceLabel, "Hostile");
  assert.match(hostileRow?.latestSignalText ?? "", /launched ships toward Sol/u);
  assert.equal(distantRow?.stanceLabel, "Distant");
});

test("ui state surfaces delivered diplomatic pigeons with symbolic faction voice", async () => {
  const scenario = {
    name: "diplomatic_pigeons",
    seed: 11,
    startDate: "2240-01-01",
    durationDays: 3,
    commanderProfiles: [
      {
        id: "chatty",
        kind: "chatty_frontier",
      },
      {
        id: "turtle",
        kind: "turtle",
      },
    ],
    factions: [
      { id: "blue", name: "Aster Crown", homeSystemId: "blue_home" },
      { id: "red", name: "Crimson Wake", homeSystemId: "red_home", commanderProfileId: "chatty" },
      {
        id: "green",
        name: "Verdant Bastion",
        homeSystemId: "green_home",
        commanderProfileId: "turtle",
        profile: {
          frame: "house",
          doctrine: "Keep the frontier disciplined and legible.",
          values: ["order", "survival", "discipline"],
          voice: {
            seed: "deliberate",
            style: "fortress restraint",
            signoff: "By careful seal",
          },
        },
      },
    ],
    systems: [
      {
        id: "blue_home",
        name: "Sol",
        position: { x: 0, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "blue",
        saltStockpile: 30,
        metalStockpile: 18,
        probeStockpile: 1,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { blue: 5 },
      },
      {
        id: "red_home",
        name: "Tau Ceti",
        position: { x: 2, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "red",
        saltStockpile: 30,
        metalStockpile: 18,
        probeStockpile: 0,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { red: 6 },
      },
      {
        id: "green_home",
        name: "Epsilon Eridani",
        position: { x: 1, y: 0 },
        starType: "yellow_star",
        metalRichness: "standard",
        ownerId: "green",
        saltStockpile: 30,
        metalStockpile: 18,
        probeStockpile: 0,
        infrastructure: 4,
        defense: 2,
        controlAgeDays: 100,
        garrisonShips: { green: 7 },
      },
    ],
    routes: [
      {
        id: "blue-red",
        a: "blue_home",
        b: "red_home",
        distance: 2,
        travelDays: 2,
        headingFromA: "red",
        headingFromB: "blue",
      },
      {
        id: "blue-green",
        a: "blue_home",
        b: "green_home",
        distance: 1,
        travelDays: 1,
        headingFromA: "green",
        headingFromB: "blue",
      },
    ],
    commands: [
      {
        type: "send_pigeon",
        at: "2240-01-01",
        factionId: "green",
        originSystemId: "green_home",
        destinationSystemId: "blue_home",
        recipientFactionId: "blue",
        packetType: "diplomatic",
        entries: [
          "intent:threaten",
          "subject:blue_home",
          "demand:keep your scouts clear of Sol",
        ],
      },
      {
        type: "send_pigeon",
        at: "2240-01-01",
        factionId: "red",
        originSystemId: "red_home",
        destinationSystemId: "blue_home",
        recipientFactionId: "blue",
        packetType: "diplomatic",
        entries: [
          "intent:offer",
          "subject:blue_home",
          "offer:trade survey data instead of racing blind into Sol",
        ],
      },
    ],
  };

  const store = createCommandState({
    fetchImpl: createScenarioFetch({ diplomatic_pigeons: scenario }),
    locationSearch: "?scenario=diplomatic_pigeons&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.runtimeCapabilities.value.ai.mode, "off");
  assert.equal(store.runtimeCapabilities.value.surfaces.some((surface) => surface.id === "diplomacy"), true);
  assert.equal(store.diplomaticInboxItems.value.length, 2);
  assert.equal(store.feedItems.value.some((item) => item.kicker === "Diplomatic pigeon"), true);

  const greenItem = store.diplomaticInboxItems.value.find((item) => item.senderFactionId === "green");
  const redItem = store.diplomaticInboxItems.value.find((item) => item.senderFactionId === "red");
  const greenRow = store.diplomacyRows.value.find((row) => row.factionId === "green");
  const redRow = store.diplomacyRows.value.find((row) => row.factionId === "red");

  assert.match(greenItem?.title ?? "", /Verdant Bastion/u);
  assert.match(greenItem?.summary ?? "", /advise restraint around Sol/u);
  assert.match(greenItem?.analysis ?? "", /pressure from strength/u);
  assert.match(greenItem?.voiceLabel ?? "", /warning|threat/i);
  assert.equal(greenItem?.schema?.intent, "threaten");
  assert.equal(greenItem?.schema?.directives.subjectSystemId, "blue_home");
  assert.equal(greenItem?.schema?.senderProfile.voice.style, "fortress restraint");
  assert.equal(greenItem?.schema?.voice.seed, "deliberate");

  assert.match(redItem?.title ?? "", /Crimson Wake/u);
  assert.match(redItem?.summary ?? "", /trade survey data instead of racing blind into Sol/u);
  assert.match(redItem?.analysis ?? "", /terms offered from advantage|information play/u);
  assert.notEqual(greenItem?.summary, redItem?.summary);
  assert.equal(redItem?.schema?.intent, "offer");
  assert.equal(redItem?.schema?.voice.seed, "opportunistic");

  assert.match(greenRow?.latestSignalText ?? "", /advise restraint around Sol/u);
  assert.match(redRow?.latestSignalText ?? "", /trade survey data instead of racing blind into Sol/u);
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
  assert.equal(store.ui.activeWorkspace, "map");
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
    store.feedItems.value.some((item) => item.kicker !== "Morning brief" && /Crimson Wake/u.test(item.title)),
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
  assert.equal(store.commandCandidatePlan.value.kind, "blockade");
  assert.equal(store.commandCandidatePlan.value.movement.destinationSystemId, "blue_frontier_a");
  assert.equal(store.commandCandidatePlan.value.cost.burnSalt, 10);
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

test("ui state cites deterministic causal tags for launches and battles", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=starlane_blockade_interception&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  const launchNote = store.feedItems.value.find((item) =>
    item.kicker !== "Morning brief" && item.title === "Blue League launched 7 ships toward Target");
  assert.equal(launchNote?.causes.some((cause) => cause.key === "reserve_stripped"), true);
  assert.equal(launchNote?.causes.some((cause) => cause.key === "route_blockade"), true);
  assert.match(launchNote?.analysis ?? "", /Drivers:/u);
  assert.match(launchNote?.analysis ?? "", /Screen/u);

  const battleNote = store.feedItems.value.find((item) =>
    item.kicker !== "Morning brief"
    && item.title === "Fighting at Target"
    && item.causes.some((cause) => cause.key === "intercepted_approach"));
  assert.equal(Boolean(battleNote), true);
  assert.match(battleNote?.analysis ?? "", /pinned this approach/u);
});

test("ui state cites probe cover in frontier battle notes", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  const battleNote = store.feedItems.value.find((item) => item.title === "Fighting at Barnard's Star");
  assert.equal(battleNote?.causes.some((cause) => cause.key === "probe_cover"), true);
  assert.match(battleNote?.analysis ?? "", /friendly probe/u);
});

test("ui state keeps production schedules, speculation, and advisor directives in player planning state", async () => {
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
  store.setAdvisorIntentDraft("Hold a reserve at Sol and let the council plan the exact launches toward Tau Ceti.");
  store.submitAdvisorIntent();
  store.setStrategicMarking("blue_frontier_a", "expand");
  store.setStrategicMarking("green_home", "threat");
  await nextTick();

  const updatedHomeRow = store.productionPlannerRows.value.find((row) => row.systemId === "blue_home");
  assert.equal(updatedHomeRow?.focus, "probes");
  assert.equal(updatedHomeRow?.quantity, 3);
  assert.equal(updatedHomeRow?.posture, "siege");
  assert.equal(updatedHomeRow?.lines.find((line) => line.id === "yard_2")?.focus, "shipyard");
  assert.equal(store.ui.planner.speculation, "Verdant Bastion is likely banking ships for Tau Ceti.");
  assert.equal(store.ui.planner.advisorIntentDraft, "");
  assert.equal(store.advisorOrderItems.value.length, 1);
  assert.match(store.advisorOrderItems.value[0]?.text ?? "", /Hold a reserve at Sol/u);
  assert.equal(store.strategyBoardSummary.value.total, 2);
  assert.equal(store.strategicMarkingRows.value.some((row) => row.systemId === "blue_frontier_a" && row.value === "expand"), true);
  assert.equal(store.strategicMarkingRows.value.some((row) => row.systemId === "green_home" && row.value === "threat"), true);

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
  assert.equal(reloaded.advisorOrderItems.value.length, 1);
  assert.match(reloaded.advisorOrderItems.value[0]?.text ?? "", /Hold a reserve at Sol/u);
  assert.equal(reloaded.strategyBoardSummary.value.total, 2);
  assert.equal(reloaded.strategicMarkingRows.value.some((row) => row.systemId === "blue_frontier_a" && row.value === "expand"), true);
  assert.equal(reloaded.strategicMarkingRows.value.some((row) => row.systemId === "green_home" && row.value === "threat"), true);
});

test("ui state turns strategic markings into visible council advice", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
  });

  await store.loadInitialData();
  store.selectSystem("blue_frontier_a");
  await nextTick();

  store.setStrategicMarking("blue_frontier_a", "expand");
  store.setStrategicMarking("green_home", "threat");
  await nextTick();

  assert.equal(store.selectedSystemOverview.value?.strategicMarking?.label, "Expand");
  assert.equal(store.selectedSystemAdvisorBriefs.value.length >= 1, true);
  assert.equal(store.STRATEGIC_MARKING_OPTIONS.some((option) => option.value === "future_link"), true);
  assert.equal(store.advisorBriefs.value.some((brief) => brief.advisorId === "marshal" && /pin us|setting the tempo/u.test(brief.headline)), true);
  assert.equal(store.advisorBriefs.value.some((brief) => brief.advisorId === "spymaster" && /trust the picture|blind corner/u.test(`${brief.headline} ${brief.reasoning}`)), true);
  assert.equal(store.advisorBriefs.value.some((brief) => brief.advisorId === "envoy" && /Send a hard pigeon|Probe the intent/u.test(brief.headline)), true);
});

test("ui state folds marked expansion targets back into council notes", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
  });

  await store.loadInitialData();
  store.setStrategicMarking("blue_frontier_a", "expand");
  await nextTick();

  const expansionNotes = store.feedItems.value.filter((item) =>
    item.kicker !== "Morning brief" && /Barnard's Star/u.test(item.title));
  assert.equal(expansionNotes.some((item) => /Marked expand target/u.test(item.summary ?? "")), true);
  assert.equal(
    expansionNotes.some((note) =>
      /You marked Barnard's Star for expansion/u.test(note.analysis)
      && /Re-open Barnard's Star on the map/u.test(note.reasoning)
    ),
    true,
  );
});

test("ui state calls out marked threat systems inside council notes", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  store.setStrategicMarking("enemy_home", "threat");
  await nextTick();

  const threatNotes = store.feedItems.value.filter((item) =>
    item.kicker !== "Morning brief"
    && item.title.includes("Crimson Wake launched an estimated 6 ships toward Barnard's Star"),
  );
  assert.equal(threatNotes.some((item) => /Marked threat source/u.test(item.summary ?? "")), true);
  assert.equal(
    threatNotes.some((note) =>
      /You marked Tau Ceti as a threat/u.test(note.analysis)
      && /Re-check reserves, probe cover, and nearby lanes/u.test(note.reasoning)
    ),
    true,
  );
});

test("ui state frames the day as a morning brief inside the council inbox", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=profile_frontier_vs_turtle&seat=blue",
  });

  await store.loadInitialData();
  store.setStrategicMarking("blue_frontier_a", "expand");
  store.setStrategicMarking("green_home", "threat");
  await nextTick();

  assert.equal(store.dailyBrief.value?.items.length, 3);
  assert.deepEqual(store.dailyBrief.value?.items.map((item) => item.key), [
    "opportunity",
    "threat",
    "command",
  ]);
  assert.match(store.dailyBrief.value?.items[0]?.title ?? "", /Barnard's Star/u);
  assert.match(store.dailyBrief.value?.items[1]?.title ?? "", /Tau Ceti/u);
  assert.equal(store.dailyBrief.value?.items.every((item) => item.advisorName && item.advisorRole), true);
  assert.equal(store.dailyBrief.value?.items.some((item) => item.actorKind === "commander"), true);
  assert.equal((store.dailyBrief.value?.items[2]?.summary ?? "").length > 0, true);

  const morningBriefMissives = store.feedItems.value.filter((item) => item.kicker === "Morning brief");
  assert.equal(morningBriefMissives.length, 3);
  assert.equal(morningBriefMissives.some((item) => item.actorKind === "commander"), true);
});
