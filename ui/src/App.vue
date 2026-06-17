<script setup>
import { computed, onMounted, ref, watch } from "vue";
import Toolbar from "primevue/toolbar";
import Panel from "primevue/panel";
import Card from "primevue/card";
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
  { key: "send_pigeon", label: "Send Pigeon", icon: "pi pi-send" },
  { key: "launch_fleet", label: "Launch Fleet", icon: "pi pi-directions-alt" },
  { key: "deploy_probe", label: "Deploy Probe", icon: "pi pi-search" },
  { key: "trade", label: "Trade", icon: "pi pi-sync" },
];

const scenarioList = ref([]);
const scenario = ref(null);
const result = ref(null);
const seatFactionId = ref(null);
const selectedSystemId = ref(null);
const activeAction = ref("send_pigeon");
const loadingError = ref("");
const apiTone = ref("success");
const apiStatus = ref("Link live");

const orderDraft = ref({
  destinationId: null,
  packetType: "intel",
  ships: 3,
  mission: "attack",
  anchorId: null,
  tradeFocus: "salt",
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
    .filter((system) => system.id !== selectedSystem.value.system.id)
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
    const x = 92 + (columnIndex / Math.max(1, columnCount - 1 || 1)) * 650;
    const laneCount = Math.max(1, systemIds.length);
    for (const [index, systemId] of systemIds.entries()) {
      const y = laneCount === 1 ? 240 : 78 + (index / (laneCount - 1)) * 340;
      layout.set(systemId, { x, y });
    }
  }

  return layout;
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
    stats: [
      { label: "Star", value: titleCase(system.starType) },
      { label: "Metals", value: titleCase(system.metalRichness) },
      { label: "Defense", value: formatNumber(snapshot.defense) },
      { label: "Friendly Ships", value: formatNumber(friendlyShips) },
      { label: "Enemy Ships", value: formatNumber(enemyShips) },
      { label: "Salt Output", value: `${STAR_OUTPUT[system.starType]}/day` },
      { label: "Local Salt", value: formatNumber(snapshot.saltStockpile) },
      { label: "Local Metals", value: formatNumber(snapshot.metalStockpile) },
    ],
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

  if (activeAction.value === "send_pigeon") {
    return {
      title: "Courier Dispatch",
      lines: [
        `${system.name} to ${destinationName}`,
        `Transit estimate: ${plan?.travelDays ?? "?"} days`,
        "Cost: 1 salt",
        "A low-friction way to move intent or logistics updates.",
      ],
    };
  }

  if (activeAction.value === "launch_fleet") {
    const ships = Number(orderDraft.value.ships || 1);
    const burn = plan ? requiredBurnSalt(ships, 0, 0, plan.distance) : null;
    return {
      title: "Fleet Launch",
      lines: [
        `${ships} ships toward ${destinationName}`,
        `Mission: ${titleCase(orderDraft.value.mission)}`,
        `Transit estimate: ${plan?.travelDays ?? "?"} days`,
        `Projected burn cost: ${burn ?? "?"} salt`,
        `Post-launch local salt: ${Math.max(0, snapshot.saltStockpile - (burn ?? 0))}`,
      ],
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
      ],
    };
  }

  return {
    title: "Trade Run",
    lines: [
      `${system.name} to ${destinationName}`,
      `Cargo priority: ${titleCase(orderDraft.value.tradeFocus)}`,
      `Transit estimate: ${plan?.travelDays ?? "?"} days`,
      `Local production: ${STAR_OUTPUT[system.starType]} salt / ${METAL_OUTPUT[system.metalRichness]} metals per day`,
    ],
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
  seatFactionId.value = chooseDefaultSeatId();
  selectedSystemId.value =
    scenario.value.factions.find((faction) => faction.id === seatFactionId.value)?.homeSystemId
    ?? scenario.value.systems[0]?.id
    ?? null;
}

function selectSystem(systemId) {
  selectedSystemId.value = systemId;
}

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
    <Toolbar class="command-header">
      <template #start>
        <div class="header-brand">
          <span class="header-eyebrow">Dead Reckoning</span>
          <span class="header-title">Command Table</span>
        </div>
      </template>

      <template #end>
        <div class="header-meta">
          <Tag v-if="currentSeat" severity="contrast" rounded>{{ currentSeat.faction.name }}</Tag>
          <Tag v-if="result" severity="info" rounded>{{ result.endDate }}</Tag>
          <Tag :severity="apiTone" rounded>{{ apiStatus }}</Tag>
        </div>
      </template>
    </Toolbar>

    <Message v-if="loadingError" severity="error" class="loading-message">
      {{ loadingError }}
    </Message>

    <section v-if="summaryCards.length" class="summary-row">
      <Card v-for="card in summaryCards" :key="card.label" class="summary-card">
        <template #content>
          <div class="summary-label">{{ card.label }}</div>
          <div class="summary-value">{{ card.value }}</div>
        </template>
      </Card>
    </section>

    <main class="battlefield">
      <Panel class="map-panel">
        <template #header>
          <div class="panel-heading">
            <div>
              <div class="panel-kicker">Operational Picture</div>
              <div class="panel-title">Galaxy Map</div>
            </div>
          </div>
        </template>

        <div v-if="selectedSystemOverview" class="selection-strip">
          <div class="selection-block selection-title">
            <div class="selection-name">{{ selectedSystemOverview.title }}</div>
            <div class="selection-subtitle">{{ selectedSystemOverview.owner }}</div>
          </div>
          <div
            v-for="stat in selectedSystemOverview.stats"
            :key="`${selectedSystemOverview.title}-${stat.label}`"
            class="selection-block"
          >
            <div class="selection-label">{{ stat.label }}</div>
            <div class="selection-value">{{ stat.value }}</div>
          </div>
        </div>

        <div class="map-stage">
          <svg viewBox="0 0 820 520" class="galaxy-map" @click="selectedSystemId = null">
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
      </Panel>

      <Panel class="feed-panel">
        <template #header>
          <div class="panel-heading">
            <div>
              <div class="panel-kicker">Live Feed</div>
              <div class="panel-title">Command Feed</div>
            </div>
            <Tag severity="info" rounded>{{ feedItems.length }} items</Tag>
          </div>
        </template>

        <div class="feed-scroll">
          <Card v-for="(item, index) in feedItems" :key="`${item.date}-${index}`" class="feed-card">
            <template #content>
              <div class="feed-card-top">
                <Tag :severity="item.tone" rounded>{{ item.date }}</Tag>
              </div>
              <div class="feed-title">{{ item.title }}</div>
              <p class="feed-copy">{{ item.summary }}</p>
              <p class="feed-impact">{{ item.impact }}</p>
            </template>
          </Card>
        </div>
      </Panel>
    </main>

    <Panel class="orders-panel">
      <template #header>
        <div class="panel-heading">
          <div>
            <div class="panel-kicker">Orders Tray</div>
            <div class="panel-title">Immediate Action</div>
          </div>
          <Tag :severity="selectedSystemFriendly ? 'success' : 'secondary'" rounded>
            {{ selectedSystemFriendly ? "Ready to draft" : "Select a friendly system" }}
          </Tag>
        </div>
      </template>

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

      <div class="orders-layout">
        <Card class="orders-form">
          <template #content>
            <Message v-if="!selectedSystem" severity="secondary">
              Select a star on the map to see draftable orders.
            </Message>
            <Message v-else-if="!selectedSystemFriendly" severity="warn">
              This system can be inspected, but not commanded from.
            </Message>
            <div v-else class="form-grid">
              <div class="field">
                <label>Origin</label>
                <div class="static-field">{{ selectedSystem.system.name }}</div>
              </div>

              <div v-if="activeAction !== 'deploy_probe'" class="field">
                <label>Destination</label>
                <Select v-model="orderDraft.destinationId" :options="destinationOptions" option-label="label" option-value="value" fluid />
              </div>

              <div v-if="activeAction === 'send_pigeon'" class="field">
                <label>Packet Type</label>
                <Select v-model="orderDraft.packetType" :options="['intel', 'orders', 'logistics', 'diplomatic']" fluid />
              </div>

              <div v-if="activeAction === 'launch_fleet'" class="field">
                <label>Mission</label>
                <Select v-model="orderDraft.mission" :options="['attack', 'reinforce', 'resupply', 'trade']" fluid />
              </div>

              <div v-if="activeAction === 'launch_fleet'" class="field">
                <label>Ships</label>
                <InputNumber
                  v-model="orderDraft.ships"
                  :min="1"
                  :max="Math.max(1, totalShipsAtSystem(selectedSystem.system.id, currentSeat.faction.id))"
                  show-buttons
                  fluid
                />
              </div>

              <div v-if="activeAction === 'deploy_probe'" class="field">
                <label>Anchor</label>
                <Select v-model="orderDraft.anchorId" :options="anchorOptions" option-label="label" option-value="value" fluid />
              </div>

              <div v-if="activeAction === 'trade'" class="field">
                <label>Cargo Focus</label>
                <Select v-model="orderDraft.tradeFocus" :options="['salt', 'metals']" fluid />
              </div>
            </div>
          </template>
        </Card>

        <Card class="orders-brief">
          <template #content>
            <div class="brief-title">{{ orderBrief.title }}</div>
            <ul class="brief-list">
              <li v-for="line in orderBrief.lines" :key="line">{{ line }}</li>
            </ul>
            <p class="brief-footnote">
              Draft preview only for now. This tray is focused on the player decision flow first.
            </p>
          </template>
        </Card>
      </div>
    </Panel>
  </div>
</template>
