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

test("ui state loads scenario through worker and exposes player-facing reports", async () => {
  const store = createCommandState({
    fetchImpl: createWorkerFetch(),
    locationSearch: "?scenario=information_probe_warning&seat=blue",
  });

  await store.loadInitialData();
  await nextTick();

  assert.equal(store.currentSeat.value?.faction.id, "blue");
  assert.equal(store.selectedSystemOverview.value?.title, "Home");
  assert.equal(store.summaryCards.value.some((card) => card.label === "Ships"), true);
  assert.equal(store.feedItems.value.some((item) => item.title.includes("Red Compact launched 6 ships toward Frontier West")), true);
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

  assert.equal(store.api.status, "Probe en route to Enemy Home");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.label, "Probe arrives in 2 days");
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.actionable, false);
  assert.equal(store.feedItems.value[0]?.title, "Blue League dispatched a probe toward Enemy Home");
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

  assert.equal(store.api.status, "Probe en route to Green Frontier A");
  assert.match(store.selectedSystemOverview.value?.probeStatus?.label ?? "", /^Probe arrives in /u);
  assert.equal(store.selectedSystemOverview.value?.probeStatus?.actionable, false);
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
