<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import Tag from "primevue/tag";
import Button from "primevue/button";
import Select from "primevue/select";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";

const SHIP_MASS = 5;
const STAR_OUTPUT = {
  red_dwarf: 2,
  yellow_star: 4,
  white_blue_star: 7,
  giant_or_exotic: 10,
};
const METAL_OUTPUT = {
  poor: 1,
  standard: 2,
  rich: 4,
  exceptional: 6,
};
const ORDER_ACTIONS = [
  { key: "attack", label: "Attack", icon: "pi pi-send" },
  { key: "reinforce", label: "Reinforce", icon: "pi pi-plus-circle" },
  { key: "resupply", label: "Resupply", icon: "pi pi-box" },
  { key: "deploy_probe", label: "Deploy Probe", icon: "pi pi-search" },
  { key: "trade", label: "Trade", icon: "pi pi-sync" },
];

const scenarioList = ref([]);
const scenario = ref(null);
const result = ref(null);
const seatFactionId = ref(null);
const selectedSystemId = ref(null);
const activeAction = ref("attack");
const loadingError = ref("");
const apiTone = ref("success");
const apiStatus = ref("Link live");
const mapViewport = ref(null);
const mapCenteredOnce = ref(false);
const systemNodes = new Map();

const orderDraft = ref({
  destinationId: null,
  ships: 3,
  anchorId: null,
  tradeFocus: "salt",
  resupplyFocus: "salt",
});

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value ?? 0);
}

function titleCase(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sentenceCase(value) {
  const text = String(value).replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function latestSnapshot() {
  return result.value?.snapshots?.[result.value.snapshots.length - 1] ?? null;
}

function systemsMap() {
  return new Map((scenario.value?.systems ?? []).map((system) => [system.id, system]));
}

function snapshotSystem(systemId) {
  return latestSnapshot()?.systems?.[systemId] ?? null;
}

function fleetEntries() {
  return Object.entries(latestSnapshot()?.fleets ?? {}).map(([fleetId, fleet]) => ({
    fleetId,
    ...fleet,
  }));
}

function fleetsAtSystem(systemId) {
  return fleetEntries().filter((fleet) => fleet.currentSystemId === systemId);
}

function inboundFleets(systemId) {
  return fleetEntries().filter(
    (fleet) => !fleet.currentSystemId && fleet.destinationSystemId === systemId,
  );
}

function totalShipsAtSystem(systemId, factionId) {
  return fleetsAtSystem(systemId)
    .filter((fleet) => fleet.factionId === factionId)
    .reduce((total, fleet) => total + fleet.ships, 0);
}

function neighboringRoutes(systemId) {
  return (scenario.value?.routes ?? []).filter(
    (route) => route.a === systemId || route.b === systemId,
  );
}

function routePlan(originSystemId, destinationSystemId) {
  if (!scenario.value) {
    return null;
  }

  const adjacency = new Map();
  for (const route of scenario.value.routes) {
    const left = adjacency.get(route.a) ?? [];
    left.push({ systemId: route.b, distance: route.distance, travelDays: route.travelDays });
    adjacency.set(route.a, left);

    const right = adjacency.get(route.b) ?? [];
    right.push({ systemId: route.a, distance: route.distance, travelDays: route.travelDays });
    adjacency.set(route.b, right);
  }

  const queue = [{ systemId: originSystemId, distance: 0, travelDays: 0 }];
  const distances = new Map([[originSystemId, queue[0]]]);

  while (queue.length > 0) {
    queue.sort((left, right) => left.distance - right.distance || left.travelDays - right.travelDays);
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (current.systemId === destinationSystemId) {
      return current;
    }

    for (const neighbor of adjacency.get(current.systemId) ?? []) {
      const candidate = {
        systemId: neighbor.systemId,
        distance: current.distance + neighbor.distance,
        travelDays: current.travelDays + neighbor.travelDays,
      };
      const known = distances.get(neighbor.systemId);
      if (
        !known ||
        candidate.distance < known.distance ||
        (candidate.distance === known.distance && candidate.travelDays < known.travelDays)
      ) {
        distances.set(neighbor.systemId, candidate);
        queue.push(candidate);
      }
    }
  }

  return null;
}

function effectiveMass(ships, cargoSalt, metals) {
  return ships * SHIP_MASS + cargoSalt + metals;
}

function requiredBurnSalt(ships, cargoSalt, metals, distance) {
  return Math.ceil(distance * effectiveMass(ships, cargoSalt, metals));
}

function translateSystemId(systemId) {
  return systemsMap().get(systemId)?.name ?? systemId;
}

function parseLogEntry(line) {
  const separator = line.indexOf(": ");
  if (separator === -1) {
    return null;
  }

  return {
    date: line.slice(0, separator),
    detail: line.slice(separator + 2),
  };
}

const currentSeat = computed(() => {
  if (!scenario.value || !result.value || !seatFactionId.value) {
    return null;
  }

  const faction = scenario.value.factions.find((candidate) => candidate.id === seatFactionId.value);
  const snapshot = latestSnapshot()?.factions?.[seatFactionId.value];
  if (!faction || !snapshot) {
    return null;
  }

  return { faction, snapshot };
});

const selectedSystem = computed(() => {
  if (!selectedSystemId.value) {
    return null;
  }

  const system = systemsMap().get(selectedSystemId.value);
  const snapshot = snapshotSystem(selectedSystemId.value);
  if (!system || !snapshot) {
    return null;
  }

  return { system, snapshot };
});

const selectedSystemFriendly = computed(() => {
  if (!selectedSystem.value || !currentSeat.value) {
    return false;
  }

  return selectedSystem.value.snapshot.ownerId === currentSeat.value.faction.id;
});

const ownedSystems = computed(() => {
  if (!currentSeat.value || !scenario.value) {
    return [];
  }

  return scenario.value.systems.filter(
    (system) => latestSnapshot()?.systems?.[system.id]?.ownerId === currentSeat.value.faction.id,
  );
});

const destinationOptions = computed(() => {
  if (!selectedSystem.value || !scenario.value) {
    return [];
  }

  return scenario.value.systems
    .filter(
      (system) =>
        system.id !== selectedSystem.value.system.id
        && routePlan(selectedSystem.value.system.id, system.id) !== null,
    )
    .map((system) => ({ label: system.name, value: system.id }));
});

const anchorOptions = computed(() => {
  if (!selectedSystem.value) {
    return [];
  }

  return neighboringRoutes(selectedSystem.value.system.id).map((route) => ({
    label: translateSystemId(route.a === selectedSystem.value.system.id ? route.b : route.a),
    value: route.a === selectedSystem.value.system.id ? route.b : route.a,
  }));
});

const summaryCards = computed(() => {
  if (!currentSeat.value || !scenario.value) {
    return [];
  }

  const transitCount = fleetEntries().filter(
    (fleet) => fleet.factionId === currentSeat.value.faction.id && fleet.status === "transit",
  ).length;
  const contested = scenario.value.systems.filter((system) => {
    const view = latestSnapshot()?.systems?.[system.id];
    return view?.ownerId === currentSeat.value.faction.id && (view.captureProgress > 0 || view.claimProgress > 0);
  }).length;

  return [
    { label: "Salt", value: formatNumber(currentSeat.value.snapshot.totalSaltStockpile) },
    { label: "Metals", value: formatNumber(currentSeat.value.snapshot.totalMetalStockpile) },
    { label: "Owned", value: formatNumber(currentSeat.value.snapshot.ownedSystems) },
    { label: "Transit", value: formatNumber(transitCount) },
    { label: "Reports", value: formatNumber(feedItems.value.length) },
    { label: "Contested", value: formatNumber(contested) },
  ];
});

const visibleFeedItems = computed(() => feedItems.value.slice(0, 7));

const mapLayout = computed(() => {
  if (!currentSeat.value || !scenario.value) {
    return new Map();
  }

  const homeSystemId = currentSeat.value.faction.homeSystemId;
  const entries = scenario.value.systems.map((system) => ({
    systemId: system.id,
    distance: routePlan(homeSystemId, system.id)?.distance ?? Number.POSITIVE_INFINITY,
  }));
  const uniqueDistances = [...new Set(entries.map((entry) => entry.distance))].sort((left, right) => left - right);
  const columns = new Map(uniqueDistances.map((distance, index) => [distance, index]));
  const grouped = new Map();
  const layout = new Map();

  for (const entry of entries) {
    const columnIndex = columns.get(entry.distance) ?? 0;
    const systems = grouped.get(columnIndex) ?? [];
    systems.push(entry.systemId);
    grouped.set(columnIndex, systems);
  }

  const columnCount = Math.max(1, uniqueDistances.length);
  for (const [columnIndex, systemIds] of grouped.entries()) {
    systemIds.sort((left, right) => left.localeCompare(right));
    const x = 170 + columnIndex * 320;
    const laneCount = Math.max(1, systemIds.length);
    for (const [index, systemId] of systemIds.entries()) {
      const y = laneCount === 1 ? 380 : 150 + index * 220;
      layout.set(systemId, { x, y });
    }
  }

  return layout;
});

const mapCanvas = computed(() => {
  const points = [...mapLayout.value.values()];
  if (points.length === 0) {
    return { width: 1280, height: 860 };
  }

  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    width: Math.max(1280, maxX + 260),
    height: Math.max(860, maxY + 220),
  };
});

function systemTone(systemId) {
  const snapshot = snapshotSystem(systemId);
  if (!snapshot || !currentSeat.value) {
    return "neutral";
  }
  if (snapshot.ownerId === currentSeat.value.faction.id) {
    return snapshot.captureProgress > 0 ? "threatened" : "friendly";
  }
  if (!snapshot.ownerId) {
    return snapshot.claimProgress > 0 ? "contested" : "open";
  }
  return "hostile";
}

function starClass(starType) {
  switch (starType) {
    case "red_dwarf":
      return "star-red";
    case "white_blue_star":
      return "star-white";
    case "giant_or_exotic":
      return "star-giant";
    default:
      return "star-yellow";
  }
}

const selectedSystemOverview = computed(() => {
  if (!selectedSystem.value || !currentSeat.value) {
    return null;
  }

  const { system, snapshot } = selectedSystem.value;
  const friendlyShips = totalShipsAtSystem(system.id, currentSeat.value.faction.id);
  const enemyShips = fleetsAtSystem(system.id)
    .filter((fleet) => fleet.factionId !== currentSeat.value.faction.id)
    .reduce((total, fleet) => total + fleet.ships, 0);

  return {
    title: system.name,
    owner:
      snapshot.ownerId === currentSeat.value.faction.id
        ? "Friendly Control"
        : snapshot.ownerId
          ? `Held by ${scenario.value.factions.find((faction) => faction.id === snapshot.ownerId)?.name ?? snapshot.ownerId}`
          : "Open System",
    starText: `${titleCase(system.starType)} star`,
    metalText: `${titleCase(system.metalRichness)} metals`,
    facts: [
      { label: "Defense", value: formatNumber(snapshot.defense) },
      { label: "Ships", value: `${formatNumber(friendlyShips)} friendly / ${formatNumber(enemyShips)} enemy` },
      { label: "Yield", value: `${STAR_OUTPUT[system.starType]} salt + ${METAL_OUTPUT[system.metalRichness]} metal / day` },
      { label: "Stores", value: `${formatNumber(snapshot.saltStockpile)} salt + ${formatNumber(snapshot.metalStockpile)} metal` },
    ],
  };
});

const commandRelay = computed(() => {
  if (!selectedSystem.value || !selectedSystemFriendly.value || !currentSeat.value) {
    return null;
  }

  const homeSystemId = currentSeat.value.faction.homeSystemId;
  if (selectedSystem.value.system.id === homeSystemId) {
    return {
      title: "Local order",
      detail: "Command seat is already present at this system.",
    };
  }

  const relayPlan = routePlan(homeSystemId, selectedSystem.value.system.id);
  return {
    title: "Courier order",
    detail: relayPlan
      ? `1 pigeon from ${translateSystemId(homeSystemId)} to ${selectedSystem.value.system.name} (${relayPlan.travelDays} days, 1 salt).`
      : `1 pigeon from ${translateSystemId(homeSystemId)} to ${selectedSystem.value.system.name} (route unresolved).`,
  };
});

const feedItems = computed(() => {
  if (!currentSeat.value || !result.value) {
    return [];
  }

  const relevantSystemIds = new Set(ownedSystems.value.map((system) => system.id));
  relevantSystemIds.add(currentSeat.value.faction.homeSystemId);
  const items = [];

  for (const line of [...result.value.log].reverse()) {
    const parsed = parseLogEntry(line);
    if (!parsed || parsed.detail.includes(" produced ")) {
      continue;
    }

    const detail = parsed.detail;
    const involvesSeat =
      detail.includes(`${currentSeat.value.faction.id} `) ||
      [...relevantSystemIds].some((systemId) => detail.includes(systemId));

    if (!involvesSeat && !detail.includes("combat at") && !detail.includes("captured")) {
      continue;
    }

    let item = null;

    const launchMatch = detail.match(/^(\w+) launched (\S+) from (\S+) to (\S+)$/u);
    if (launchMatch) {
      item = {
        date: parsed.date,
        title: `${translateSystemId(launchMatch[3])} reported a departure burn`,
        summary: `${titleCase(launchMatch[1])} launched a fleet toward ${translateSystemId(launchMatch[4])}.`,
        impact: `Likely arrival in ${routePlan(launchMatch[3], launchMatch[4])?.travelDays ?? "?"} days.`,
        tone: launchMatch[1] === currentSeat.value.faction.id ? "info" : "warn",
      };
    }

    const combatMatch = detail.match(/^combat at (\S+); attacker (\w+) lost (\d+), defender (\w+) lost (\d+)$/u);
    if (!item && combatMatch) {
      item = {
        date: parsed.date,
        title: `${translateSystemId(combatMatch[1])} saw combat`,
        summary: `Attacker losses ${combatMatch[3]}. Defender losses ${combatMatch[5]}.`,
        impact: "Local control may now be unstable.",
        tone: relevantSystemIds.has(combatMatch[1]) ? "danger" : "warn",
      };
    }

    const captureMatch = detail.match(/^(\w+) captured (\S+)$/u);
    if (!item && captureMatch) {
      item = {
        date: parsed.date,
        title: `${translateSystemId(captureMatch[2])} changed hands`,
        summary: `${titleCase(captureMatch[1])} completed a capture.`,
        impact: "Production and control now benefit the new owner.",
        tone: captureMatch[1] === currentSeat.value.faction.id ? "success" : "danger",
      };
    }

    const arrivalMatch = detail.match(/^fleet (\S+) arrived at (\S+)$/u);
    if (!item && arrivalMatch) {
      item = {
        date: parsed.date,
        title: `${translateSystemId(arrivalMatch[2])} received a fleet`,
        summary: "A new force reached orbit.",
        impact: "Inspect the map for immediate force balance changes.",
        tone: relevantSystemIds.has(arrivalMatch[2]) ? "warn" : "info",
      };
    }

    const pigeonMatch = detail.match(/^(\w+) sent pigeon (\S+) to (\S+)$/u);
    if (!item && pigeonMatch) {
      item = {
        date: parsed.date,
        title: `Courier launched for ${translateSystemId(pigeonMatch[3])}`,
        summary: `${titleCase(pigeonMatch[1])} spent salt to move information.`,
        impact: "Intel and orders are now physically in transit.",
        tone: "contrast",
      };
    }

    if (!item) {
      item = {
        date: parsed.date,
        title: sentenceCase(detail),
        summary: "A relevant theater event occurred.",
        impact: "Review the map before committing new orders.",
        tone: "secondary",
      };
    }

    items.push(item);
    if (items.length >= 12) {
      break;
    }
  }

  return items;
});

const orderBrief = computed(() => {
  if (!selectedSystem.value || !currentSeat.value) {
    return {
      title: "Orders Await Context",
      lines: ["Select a friendly system to preview an order."],
    };
  }

  if (!selectedSystemFriendly.value) {
    return {
      title: "Observation Only",
      lines: ["This system is not under your control, so it cannot originate orders."],
    };
  }

  const system = selectedSystem.value.system;
  const snapshot = selectedSystem.value.snapshot;
  const destinationId = orderDraft.value.destinationId ?? destinationOptions.value[0]?.value ?? null;
  const destinationName = destinationId ? translateSystemId(destinationId) : "No destination";
  const plan = destinationId ? routePlan(system.id, destinationId) : null;
  const relayLine = commandRelay.value ? `${commandRelay.value.title}: ${commandRelay.value.detail}` : null;

  if (activeAction.value === "attack" || activeAction.value === "reinforce") {
    const ships = Number(orderDraft.value.ships || 1);
    const burn = plan ? requiredBurnSalt(ships, 0, 0, plan.distance) : null;
    return {
      title: activeAction.value === "attack" ? "Attack Order" : "Reinforcement Order",
      lines: [
        `${ships} ships toward ${destinationName}`,
        activeAction.value === "attack"
          ? "Intent: force a fight and pressure local control."
          : "Intent: strengthen a friendly position before contact.",
        `Transit estimate: ${plan ? `${plan.travelDays} days` : "No route"}`,
        `Projected burn cost: ${burn !== null ? `${burn} salt` : "Route required"}`,
        burn !== null
          ? `Post-launch local salt: ${Math.max(0, snapshot.saltStockpile - burn)}`
          : "Post-launch local salt: unresolved until a route exists.",
        relayLine,
      ].filter(Boolean),
    };
  }

  if (activeAction.value === "resupply") {
    const ships = Number(orderDraft.value.ships || 1);
    const burn = plan ? requiredBurnSalt(ships, 0, 0, plan.distance) : null;
    return {
      title: "Resupply Order",
      lines: [
        `${ships} ships escort supplies toward ${destinationName}`,
        `Cargo priority: ${titleCase(orderDraft.value.resupplyFocus)}`,
        `Transit estimate: ${plan ? `${plan.travelDays} days` : "No route"}`,
        `Escort burn cost: ${burn !== null ? `${burn} salt` : "Route required"}`,
        "Supply mass will expand in a later draft; this preview prices the escort first.",
        relayLine,
      ].filter(Boolean),
    };
  }

  if (activeAction.value === "deploy_probe") {
    const anchorId = orderDraft.value.anchorId ?? system.id;
    const anchorPlan = routePlan(system.id, anchorId);
    return {
      title: "Probe Mission",
      lines: [
        `Anchor: ${translateSystemId(anchorId)}`,
        `Travel time: ${anchorPlan?.travelDays ?? 0} days`,
        "Cost: 2 salt and 2 metals",
        "Probes narrow uncertainty around approach lanes and turns.",
        relayLine,
      ].filter(Boolean),
    };
  }

  return {
    title: "Trade Run",
    lines: [
      `${system.name} to ${destinationName}`,
      `Cargo priority: ${titleCase(orderDraft.value.tradeFocus)}`,
      `Transit estimate: ${plan ? `${plan.travelDays} days` : "No route"}`,
      `Local production: ${STAR_OUTPUT[system.starType]} salt / ${METAL_OUTPUT[system.metalRichness]} metals per day`,
      relayLine,
    ].filter(Boolean),
  };
});

watch(destinationOptions, (options) => {
  if (options.length > 0 && !options.some((option) => option.value === orderDraft.value.destinationId)) {
    orderDraft.value.destinationId = options[0].value;
  }
});

watch(anchorOptions, (options) => {
  if (options.length > 0 && !options.some((option) => option.value === orderDraft.value.anchorId)) {
    orderDraft.value.anchorId = options[0].value;
  }
});

function chooseDefaultScenarioId() {
  const fromQuery = new URLSearchParams(window.location.search).get("scenario");
  if (fromQuery && scenarioList.value.some((entry) => entry.id === fromQuery)) {
    return fromQuery;
  }
  if (scenarioList.value.some((entry) => entry.id === "profile_frontier_vs_turtle")) {
    return "profile_frontier_vs_turtle";
  }
  return scenarioList.value[0]?.id ?? null;
}

function chooseDefaultSeatId() {
  if (!scenario.value) {
    return null;
  }

  const fromQuery = new URLSearchParams(window.location.search).get("seat");
  if (fromQuery && scenario.value.factions.some((faction) => faction.id === fromQuery)) {
    return fromQuery;
  }

  const latest = latestSnapshot();
  return [...scenario.value.factions]
    .sort((left, right) => {
      const leftOwned = latest?.factions[left.id]?.ownedSystems ?? 0;
      const rightOwned = latest?.factions[right.id]?.ownedSystems ?? 0;
      return rightOwned - leftOwned;
    })[0]
    ?.id;
}

function setSystemNode(systemId, element) {
  if (element) {
    systemNodes.set(systemId, element);
  } else {
    systemNodes.delete(systemId);
  }
}

function centerMapOnSystem(systemId) {
  const node = systemNodes.get(systemId);
  if (node?.scrollIntoView) {
    node.scrollIntoView({ block: "center", inline: "center" });
  }

  const viewport = mapViewport.value;
  const point = mapLayout.value.get(systemId);
  if (!viewport || !point) {
    return;
  }

  const left = Math.max(
    0,
    Math.min(point.x - viewport.clientWidth / 2, viewport.scrollWidth - viewport.clientWidth),
  );
  const top = Math.max(
    0,
    Math.min(point.y - viewport.clientHeight / 2, viewport.scrollHeight - viewport.clientHeight),
  );

  window.requestAnimationFrame(() => {
    viewport.scrollLeft = left;
    viewport.scrollTop = top;
  });
}

async function loadScenario(id) {
  const response = await fetch(`/api/scenarios/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(`Unable to load scenario ${id}`);
  }
  const loadedScenario = await response.json();

  const simulationResponse = await fetch("/api/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(loadedScenario),
  });
  if (!simulationResponse.ok) {
    throw new Error(`Unable to simulate scenario ${id}`);
  }

  scenario.value = loadedScenario;
  result.value = await simulationResponse.json();
  mapCenteredOnce.value = false;
  seatFactionId.value = chooseDefaultSeatId();
  selectedSystemId.value =
    scenario.value.factions.find((faction) => faction.id === seatFactionId.value)?.homeSystemId
    ?? scenario.value.systems[0]?.id
    ?? null;
}

function selectSystem(systemId) {
  selectedSystemId.value = systemId;
  window.setTimeout(() => centerMapOnSystem(systemId), 40);
}

watch(
  selectedSystemId,
  async (systemId) => {
    if (!systemId) {
      return;
    }

    await nextTick();
    window.requestAnimationFrame(() => {
      centerMapOnSystem(systemId);
      mapCenteredOnce.value = true;
    });
  },
  { flush: "post" },
);

onMounted(async () => {
  try {
    const health = await fetch("/api/health");
    if (!health.ok) {
      throw new Error("health check failed");
    }

    const response = await fetch("/api/scenarios");
    if (!response.ok) {
      throw new Error("scenario list failed");
    }

    const payload = await response.json();
    scenarioList.value = payload.scenarios;
    const scenarioId = chooseDefaultScenarioId();
    if (scenarioId) {
      await loadScenario(scenarioId);
    }
  } catch (error) {
    apiTone.value = "error";
    apiStatus.value = "Link lost";
    loadingError.value = error instanceof Error ? error.message : "Unable to initialize command table.";
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="command-header">
      <div class="header-brand">
        <span class="header-eyebrow">Dead Reckoning</span>
        <span class="header-title">Command Table</span>
      </div>

      <div v-if="summaryCards.length" class="header-analytics">
        <div v-for="card in summaryCards" :key="card.label" class="analytics-pill">
          <span class="analytics-label">{{ card.label }}</span>
          <span class="analytics-value">{{ card.value }}</span>
        </div>
      </div>

      <div class="header-meta">
        <Tag v-if="currentSeat" severity="contrast" rounded>{{ currentSeat.faction.name }}</Tag>
        <Tag v-if="result" severity="info" rounded>{{ result.endDate }}</Tag>
        <Tag :severity="apiTone" rounded>{{ apiStatus }}</Tag>
      </div>
    </header>

    <Message v-if="loadingError" severity="error" class="loading-message">
      {{ loadingError }}
    </Message>

    <main class="battlefield">
      <section class="map-panel">
        <div class="map-topline">
          <div>
            <div class="panel-kicker">Operational Picture</div>
            <div class="panel-title">Galaxy Map</div>
          </div>

          <div v-if="selectedSystemOverview" class="system-inspector">
            <div class="system-summary">
              <div class="system-name">{{ selectedSystemOverview.title }}</div>
              <div class="system-subline">{{ selectedSystemOverview.owner }}</div>
              <div class="system-subline">
                {{ selectedSystemOverview.starText }} · {{ selectedSystemOverview.metalText }}
              </div>
            </div>

            <div class="system-facts">
              <div
                v-for="fact in selectedSystemOverview.facts"
                :key="`${selectedSystemOverview.title}-${fact.label}`"
                class="system-fact"
              >
                <span class="system-fact-label">{{ fact.label }}</span>
                <span class="system-fact-value">{{ fact.value }}</span>
              </div>
            </div>
          </div>

          <div v-else class="map-empty-state">
            Select a star to inspect control, production, and available orders.
          </div>
        </div>

        <div class="map-stage">
          <div ref="mapViewport" class="map-viewport">
            <svg
              :viewBox="`0 0 ${mapCanvas.width} ${mapCanvas.height}`"
              class="galaxy-map"
              :style="{ width: `${mapCanvas.width}px`, height: `${mapCanvas.height}px` }"
              @click="selectedSystemId = null"
            >
              <line
                v-for="route in scenario?.routes ?? []"
                :key="route.id"
                :x1="mapLayout.get(route.a)?.x"
                :y1="mapLayout.get(route.a)?.y"
                :x2="mapLayout.get(route.b)?.x"
                :y2="mapLayout.get(route.b)?.y"
                class="route-line"
              />

              <g
                v-for="system in scenario?.systems ?? []"
                :key="system.id"
                :ref="(element) => setSystemNode(system.id, element)"
                class="system-group"
                :transform="`translate(${mapLayout.get(system.id)?.x ?? 0} ${mapLayout.get(system.id)?.y ?? 0})`"
                @click.stop="selectSystem(system.id)"
              >
                <circle
                  v-if="snapshotSystem(system.id)?.captureProgress > 0 || snapshotSystem(system.id)?.claimProgress > 0"
                  r="25"
                  class="system-halo"
                />
                <circle
                  :class="['system-ring', `tone-${systemTone(system.id)}`, { selected: selectedSystemId === system.id }]"
                  r="16"
                />
                <circle :class="['system-core', starClass(system.starType)]" :r="system.starType === 'giant_or_exotic' ? 10 : 8" />
                <text x="0" y="34" text-anchor="middle" class="system-label">{{ system.name }}</text>
                <g v-if="inboundFleets(system.id).length > 0">
                  <circle cx="16" cy="-16" r="10" class="incoming-marker" />
                  <text x="16" y="-12" text-anchor="middle" class="incoming-text">{{ inboundFleets(system.id).length }}</text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </section>

      <aside class="feed-panel">
        <div class="feed-header">
          <div>
            <div>
              <div class="panel-kicker">Signal Feed</div>
              <div class="panel-title">Latest Reports</div>
            </div>
          </div>
          <Tag severity="info" rounded>{{ feedItems.length }} items</Tag>
        </div>

        <div class="feed-scroll">
          <article v-for="(item, index) in visibleFeedItems" :key="`${item.date}-${index}`" class="feed-card">
            <div class="feed-card-top">
              <Tag :severity="item.tone" rounded>{{ item.date }}</Tag>
            </div>
            <div class="feed-title">{{ item.title }}</div>
            <p class="feed-copy">{{ item.summary }}</p>
            <p class="feed-impact">{{ item.impact }}</p>
          </article>

          <div v-if="feedItems.length > visibleFeedItems.length" class="feed-backlog">
            +{{ feedItems.length - visibleFeedItems.length }} older reports in backlog
          </div>
        </div>
      </aside>
    </main>

    <footer class="orders-panel">
      <div class="orders-bar">
        <div class="orders-actions">
          <Button
            v-for="action in ORDER_ACTIONS"
            :key="action.key"
            :label="action.label"
            :icon="action.icon"
            :severity="activeAction === action.key ? 'contrast' : 'secondary'"
            :outlined="activeAction !== action.key"
            @click="activeAction = action.key"
          />
        </div>

        <div class="orders-status">
          <div>
            <div class="panel-kicker">Orders Dock</div>
            <div class="panel-title">Immediate Action</div>
          </div>
          <Tag :severity="selectedSystemFriendly ? 'success' : 'secondary'" rounded>
            {{ selectedSystemFriendly ? "Ready to order" : "Select a friendly system" }}
          </Tag>
        </div>
      </div>

      <div class="orders-drawer">
        <Message v-if="!selectedSystem" severity="secondary">
          Select a star on the map to see draftable orders.
        </Message>
        <Message v-else-if="!selectedSystemFriendly" severity="warn">
          This system can be inspected, but not commanded from.
        </Message>
        <template v-else>
          <div class="orders-layout">
            <div class="form-grid">
              <div class="field">
                <label>Origin</label>
                <div class="static-field">{{ selectedSystem.system.name }}</div>
              </div>

              <div v-if="activeAction !== 'deploy_probe'" class="field">
                <label>Destination</label>
                <Select v-model="orderDraft.destinationId" :options="destinationOptions" option-label="label" option-value="value" fluid />
              </div>

              <div v-if="['attack', 'reinforce', 'resupply'].includes(activeAction)" class="field">
                <label>Ships</label>
                <InputNumber
                  v-model="orderDraft.ships"
                  :min="1"
                  :max="Math.max(1, totalShipsAtSystem(selectedSystem.system.id, currentSeat.faction.id))"
                  show-buttons
                  fluid
                />
              </div>

              <div v-if="activeAction === 'resupply'" class="field">
                <label>Cargo</label>
                <Select v-model="orderDraft.resupplyFocus" :options="['salt', 'metals']" fluid />
              </div>

              <div v-if="activeAction === 'deploy_probe'" class="field">
                <label>Anchor</label>
                <Select v-model="orderDraft.anchorId" :options="anchorOptions" option-label="label" option-value="value" fluid />
              </div>

              <div v-if="activeAction === 'trade'" class="field">
                <label>Focus</label>
                <Select v-model="orderDraft.tradeFocus" :options="['salt', 'metals']" fluid />
              </div>
            </div>

            <div class="orders-brief">
              <div class="brief-title">{{ orderBrief.title }}</div>
              <ul class="brief-list">
                <li v-for="line in orderBrief.lines" :key="line">{{ line }}</li>
              </ul>
              <p class="brief-footnote">
                Draft preview only for now. This dock is focused on fast player decisions first.
              </p>
            </div>
          </div>
        </template>
      </div>
    </footer>
  </div>
</template>
