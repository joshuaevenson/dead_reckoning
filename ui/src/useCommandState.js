import { computed, reactive, toRaw, watch } from "vue";

const SHIP_MASS = 5;
const PROBE_COST_SALT = 2;
const DIRECT_TIME_MULTIPLIER = 1;
const DIRECT_SALT_MULTIPLIER = 1;
const STARLANE_TIME_MULTIPLIER = 0.7;
const STARLANE_SALT_MULTIPLIER = 0.8;
const STAR_OUTPUT = {
  red_dwarf: 0,
  yellow_star: 1,
  white_blue_star: 2,
  giant_or_exotic: 2,
};
const SALT_PROFILE_OUTPUT = {
  none: 0,
  trace: 1,
  productive: 2,
  major: 5,
};
const METAL_OUTPUT = {
  poor: 1,
  standard: 1,
  rich: 2,
  exceptional: 4,
};
const ORDER_ACTIONS = [
  { key: "attack", label: "Attack", icon: "pi pi-send" },
  { key: "reinforce", label: "Reinforce", icon: "pi pi-plus-circle" },
  { key: "blockade", label: "Blockade", icon: "pi pi-ban" },
  { key: "resupply", label: "Resupply", icon: "pi pi-box" },
  { key: "deploy_probe", label: "Deploy Probe", icon: "pi pi-search" },
  { key: "trade", label: "Trade", icon: "pi pi-sync" },
];
const WORKSPACE_VIEWS = [
  { key: "reports", label: "Advisors", icon: "pi pi-megaphone" },
  { key: "map", label: "Map", icon: "pi pi-globe" },
  { key: "probes", label: "Probes", icon: "pi pi-search" },
  { key: "operations", label: "Ship Ops", icon: "pi pi-send" },
  { key: "diplomacy", label: "Diplomacy", icon: "pi pi-users" },
  { key: "production", label: "Production", icon: "pi pi-sliders-h" },
  { key: "notebook", label: "Notebook", icon: "pi pi-book" },
];
const PRODUCTION_LINE_FOCUS_OPTIONS = [
  { label: "Build Ships", value: "ships" },
  { label: "Build Probes", value: "probes" },
  { label: "Build Defenses", value: "defenses" },
  { label: "Build Shipyard", value: "shipyard" },
  { label: "Idle", value: "idle" },
];
const PRODUCTION_FOCUS_OPTIONS = [
  { label: "Build Ships", value: "ships" },
  { label: "Build Defenses", value: "defenses" },
  { label: "Build Probes", value: "probes" },
  { label: "Build Shipyard", value: "shipyard" },
  { label: "Bank Salt", value: "bank_salt" },
  { label: "Bank Metals", value: "bank_metals" },
];
const PRODUCTION_POSTURE_OPTIONS = [
  { label: "Balanced", value: "balanced" },
  { label: "Frontier", value: "frontier" },
  { label: "Siege Prep", value: "siege" },
  { label: "Emergency", value: "emergency" },
];
const STRATEGIC_MARKING_OPTIONS = [
  {
    label: "Explore",
    value: "explore",
    severity: "info",
    summary: "Needs closer recon before we commit ships or trade.",
  },
  {
    label: "Expand",
    value: "expand",
    severity: "success",
    summary: "Candidate for near-term claim, reinforcement, or settlement.",
  },
  {
    label: "Threat",
    value: "threat",
    severity: "danger",
    summary: "Likely source of pressure, incursion, or surprise action.",
  },
  {
    label: "Screen",
    value: "screen",
    severity: "warn",
    summary: "Probe and blockade anchor where warning time matters.",
  },
  {
    label: "Economic Priority",
    value: "economic_priority",
    severity: "secondary",
    summary: "System we want to protect or exploit for long-run output.",
  },
  {
    label: "Future Link",
    value: "future_link",
    severity: "contrast",
    summary: "Candidate outward connection point for a later starlane push.",
  },
];
const STRATEGIC_MARKINGS_BY_VALUE = new Map(
  STRATEGIC_MARKING_OPTIONS.map((option) => [option.value, option]),
);
const ADVISOR_PROFILES = {
  marshal: {
    advisorId: "marshal",
    advisorName: "Marshal Hale",
    role: "Fleet Consequences",
  },
  spymaster: {
    advisorId: "spymaster",
    advisorName: "Spymaster Vey",
    role: "Reconnaissance",
  },
  steward: {
    advisorId: "steward",
    advisorName: "Steward Sen",
    role: "Logistics",
  },
  envoy: {
    advisorId: "envoy",
    advisorName: "Envoy Tal",
    role: "Signals",
  },
};

function defaultProductionLine(index) {
  return {
    id: `yard_${index}`,
    focus: index === 1 ? "ships" : "idle",
    quantity: index === 1 ? 1 : 0,
  };
}

function defaultProductionPlan() {
  return {
    focus: "ships",
    quantity: 1,
    posture: "balanced",
    lines: [defaultProductionLine(1)],
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value ?? 0);
}

function titleCase(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCountLabel(value, singular, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function formatTravelSpan(days) {
  if (!Number.isFinite(days) || days <= 0) {
    return "less than a year";
  }

  return `${days} ${days === 1 ? "year" : "years"}`;
}

function formatMissionNarrative(mission) {
  switch (mission) {
    case "attack":
      return "on an attack mission";
    case "reinforce":
      return "on a reinforcement mission";
    case "blockade":
      return "on a blockade mission";
    case "resupply":
      return "on a resupply mission";
    case "trade":
      return "on a trade mission";
    default:
      return "";
  }
}

function estimateTransitValue(value) {
  const numericValue = Math.max(0, Number(value ?? 0));
  if (numericValue === 0) {
    return "0";
  }

  const step =
    numericValue >= 20 ? 5
    : numericValue >= 8 ? 2
    : 1;
  return formatNumber(Math.max(step, Math.round(numericValue / step) * step));
}

function formatTransitCargo(cargoSalt, metals, isEstimate) {
  if (isEstimate) {
    return `Estimated cargo: ~${estimateTransitValue(cargoSalt)} salt, ~${estimateTransitValue(metals)} metals.`;
  }

  return `Cargo: ${formatNumber(cargoSalt)} salt, ${formatNumber(metals)} metals.`;
}

function saltOutputForSystem(system) {
  if (system?.saltProfile && system.saltProfile in SALT_PROFILE_OUTPUT) {
    return SALT_PROFILE_OUTPUT[system.saltProfile];
  }

  return STAR_OUTPUT[system?.starType] ?? 0;
}

function inferShipyardCount(system) {
  return Math.max(1, Math.min(4, Math.ceil((system?.infrastructure ?? 1) / 4)));
}

function normalizeProductionQuantity(focus, quantity) {
  const minimum = focus === "idle" ? 0 : 1;
  return Math.max(minimum, Number(quantity ?? minimum));
}

function normalizeProductionLines(lines, count, fallbackFocus = "ships", fallbackQuantity = 1) {
  const nextLines = [];

  for (let index = 1; index <= count; index += 1) {
    const lineId = `yard_${index}`;
    const existing = lines?.find((line) => line?.id === lineId) ?? null;
    const focus = existing?.focus ?? (index === 1 ? fallbackFocus : "idle");
    const quantity = existing?.quantity ?? (index === 1 ? fallbackQuantity : 0);
    nextLines.push({
      id: lineId,
      focus,
      quantity: normalizeProductionQuantity(focus, quantity),
    });
  }

  return nextLines;
}

function productionLineSummary(focus, quantity) {
  if (focus === "idle") {
    return "Hold this yard in reserve.";
  }

  if (focus === "shipyard") {
    return `${formatNumber(quantity)} shipyard expansion ${quantity === 1 ? "project" : "projects"} queued. Heavy metal draw.`;
  }

  return `${formatNumber(quantity)} ${titleCase(focus)} ${quantity === 1 ? "order" : "orders"} queued for this yard.`;
}

function formatStarlaneId(a, b) {
  return a < b ? `lane:${a}:${b}` : `lane:${b}:${a}`;
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

function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) {
    return null;
  }

  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }

  return Math.max(0, Math.round((to - from) / 86400000));
}

function addDays(date, days) {
  const base = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(base)) {
    return date;
  }

  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cloneScenario(scenario) {
  const rawScenario = toRaw(scenario);

  if (typeof structuredClone === "function") {
    return structuredClone(rawScenario);
  }

  return JSON.parse(JSON.stringify(rawScenario));
}

function cloneReportItem(item) {
  return {
    id: item.id,
    date: item.date,
    kicker: item.kicker,
    title: item.title,
    summary: item.summary,
    analysis: item.analysis,
    tone: item.tone,
    advisorId: item.advisorId,
    advisorName: item.advisorName,
    advisorRole: item.advisorRole,
    advisorSource: item.advisorSource,
  };
}

function sortReportsByDate(items) {
  return [...items].sort((left, right) => {
    const dateOrder = String(right.date ?? "").localeCompare(String(left.date ?? ""));
    if (dateOrder !== 0) {
      return dateOrder;
    }

    return String(left.title ?? "").localeCompare(String(right.title ?? ""));
  });
}

function findActionDefinition(actionKey) {
  return ORDER_ACTIONS.find((action) => action.key === actionKey) ?? null;
}

function strategicMarkingDefinition(value) {
  return STRATEGIC_MARKINGS_BY_VALUE.get(value) ?? null;
}

function advisorProfile(advisorId) {
  return ADVISOR_PROFILES[advisorId] ?? ADVISOR_PROFILES.envoy;
}

function advisorProfileForReport(item) {
  if (!item?.kicker) {
    return advisorProfile("envoy");
  }

  if (
    item.kicker === "Recon launched"
    || item.kicker === "Recon on station"
  ) {
    return advisorProfile("spymaster");
  }

  if (
    item.kicker === "Trade signal"
    || item.kicker === "Supply convoy"
    || item.kicker === "Frontier claim"
    || item.kicker === "Expansion burn"
    || item.kicker === "Reinforcement burn"
  ) {
    return advisorProfile("steward");
  }

  if (
    item.kicker === "Incoming threat"
    || item.kicker === "Attack burn"
    || item.kicker === "Blockade burn"
    || item.kicker === "Battle report"
    || item.kicker === "Control shift"
    || item.kicker === "Arrival burn"
  ) {
    return advisorProfile("marshal");
  }

  return advisorProfile("envoy");
}

function advisorConsequenceForReport(item, profile) {
  if (!item) {
    return "";
  }

  switch (item.kicker) {
    case "Recon launched":
      return `${profile.advisorName} says the real gain is warning time: once the probe arrives, we stop defending every rumor at once.`;
    case "Recon on station":
      return `${profile.advisorName} says this closes a blind angle, which means future enemy burns here can be answered with commitment instead of guesswork.`;
    case "Trade signal":
      return `${profile.advisorName} reads this as compounding strength: quiet cargo runs often decide who can afford the decisive move later.`;
    case "Supply convoy":
      return `${profile.advisorName} reads endurance here. If the convoy lands cleanly, the target can absorb pressure longer than its fleet count alone suggests.`;
    case "Blockade burn":
      return `${profile.advisorName} warns that this is about lane control, not only local ships. If the blockade sticks, movement through the lane gets riskier and slower to answer.`;
    case "Reinforcement burn":
      return `${profile.advisorName} reads a posture shift. Reinforcements make the next fight cheaper for them and more expensive for anyone arriving late.`;
    case "Expansion burn":
    case "Frontier claim":
      return `${profile.advisorName} says frontier gains snowball. A quiet claim today becomes extra salt, extra options, and harder eviction tomorrow.`;
    case "Incoming threat":
    case "Attack burn":
      return `${profile.advisorName} frames this as tempo pressure. If we answer from the wrong reserve, the attacker chooses both the fight and the follow-up.`;
    case "Battle report":
      return `${profile.advisorName} says the lesson is not just who traded well, but who can replace losses first and keep control after the shooting stops.`;
    case "Control shift":
      return `${profile.advisorName} treats this as a consequence chain: once local control broke, ownership followed immediately and the surrounding lane picture changed with it.`;
    case "Arrival burn":
      return `${profile.advisorName} says arrivals matter because they pin choices. A force landing in place can force us to defend the system and the nearby lane at the same time.`;
    default:
      return item.analysis;
  }
}

function withAdvisorContext(item) {
  if (!item) {
    return item;
  }

  const profile = advisorProfileForReport(item);
  return {
    ...item,
    advisorId: item.advisorId ?? profile.advisorId,
    advisorName: item.advisorName ?? profile.advisorName,
    advisorRole: item.advisorRole ?? profile.role,
    advisorSource: item.advisorSource ?? item.kicker,
    analysis: advisorConsequenceForReport(item, profile),
  };
}

function hasValidPosition(system) {
  return Number.isFinite(system?.position?.x) && Number.isFinite(system?.position?.y);
}

function normalizeScenario(inputScenario) {
  const scenario = cloneScenario(inputScenario);
  const systems = scenario.systems ?? [];

  if (systems.every((system) => hasValidPosition(system))) {
    return scenario;
  }

  const positioned = new Map();
  const systemById = new Map(systems.map((system) => [system.id, system]));
  const adjacency = new Map();

  for (const route of scenario.routes ?? []) {
    const left = adjacency.get(route.a) ?? [];
    left.push({ systemId: route.b, distance: route.distance ?? route.travelDays ?? 1 });
    adjacency.set(route.a, left);

    const right = adjacency.get(route.b) ?? [];
    right.push({ systemId: route.a, distance: route.distance ?? route.travelDays ?? 1 });
    adjacency.set(route.b, right);
  }

  for (const [index, faction] of (scenario.factions ?? []).entries()) {
    const home = systemById.get(faction.homeSystemId);
    if (home && !hasValidPosition(home)) {
      home.position = { x: index * 8, y: 0 };
    }
    if (home?.position) {
      positioned.set(home.id, home.position);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const system of systems) {
      const origin = systemById.get(system.id);
      if (!origin || !hasValidPosition(origin)) {
        continue;
      }

      const neighbors = adjacency.get(origin.id) ?? [];
      for (const [index, neighbor] of neighbors.entries()) {
        const target = systemById.get(neighbor.systemId);
        if (!target || hasValidPosition(target)) {
          continue;
        }

        const laneOffset = index - (neighbors.length - 1) / 2;
        target.position = {
          x: origin.position.x + Math.max(1, neighbor.distance),
          y: origin.position.y + laneOffset * Math.max(1, neighbor.distance),
        };
        positioned.set(target.id, target.position);
        changed = true;
      }
    }
  }

  let fallbackIndex = 0;
  for (const system of systems) {
    if (hasValidPosition(system)) {
      continue;
    }

    system.position = {
      x: fallbackIndex * 2,
      y: (fallbackIndex % 4) - 1.5,
    };
    fallbackIndex += 1;
  }

  return scenario;
}

export function useCommandState() {
  return createCommandState();
}

export function createCommandState(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const storage =
    options.storage
    ?? (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);
  const locationSearch =
    options.locationSearch
    ?? (typeof window !== "undefined" ? window.location.search : "");

  if (!fetchImpl) {
    throw new Error("createCommandState requires a fetch implementation.");
  }

  const api = reactive({
    tone: "success",
    status: "Link live",
    error: "",
    submitting: false,
  });

  const testHarness = reactive({
    scenarioList: [],
    activeScenarioId: null,
  });

  const world = reactive({
    scenario: null,
    result: null,
  });

  const ui = reactive({
    seatFactionId: null,
    selectedSystemId: null,
    activeWorkspace: "reports",
    activeAction: "attack",
    pendingProbeOrders: {},
    plannerLoadedKey: null,
    planner: {
      speculation: "",
      productionBySystemId: {},
      strategicMarkingsBySystemId: {},
      archivedReportsById: {},
      followUpReportsById: {},
    },
    orderDraft: {
      originSystemId: null,
      destinationId: null,
      ships: 3,
      anchorId: null,
      probeOriginId: null,
      tradeFocus: "salt",
      resupplyFocus: "salt",
    },
  });

  const latestSnapshot = computed(
    () => world.result?.snapshots?.[world.result.snapshots.length - 1] ?? null,
  );

  const currentWorldDate = computed(() => world.result?.endDate ?? null);

  const systemsMap = computed(
    () => new Map((world.scenario?.systems ?? []).map((system) => [system.id, system])),
  );

  function translateSystemId(systemId) {
    return systemsMap.value.get(systemId)?.name ?? systemId;
  }

  function translateFactionId(factionId) {
    return world.scenario?.factions.find((faction) => faction.id === factionId)?.name ?? titleCase(factionId);
  }

  function snapshotSystem(systemId) {
    return latestSnapshot.value?.systems?.[systemId] ?? null;
  }

  const fleetEntries = computed(() =>
    Object.entries(latestSnapshot.value?.fleets ?? {}).map(([fleetId, fleet]) => ({
      fleetId,
      ...fleet,
    })),
  );

  const probeEntries = computed(() =>
    Object.entries(latestSnapshot.value?.probes ?? {}).map(([probeId, probe]) => ({
      probeId,
      ...probe,
    })),
  );

  function canSeeTransitFleet(fleet) {
    if (!fleet) {
      return false;
    }
    if (!currentSeat.value) {
      return true;
    }

    return (
      fleet.factionId === currentSeat.value.faction.id
      || fleet.launchVisibleToOthers
    );
  }

  function fleetsAtSystem(systemId) {
    return fleetEntries.value.filter((fleet) => fleet.currentSystemId === systemId);
  }

  function inboundFleets(systemId) {
    return fleetEntries.value.filter(
      (fleet) =>
        !fleet.currentSystemId
        && fleet.destinationSystemId === systemId
        && canSeeTransitFleet(fleet),
    );
  }

  function totalShipsAtSystem(systemId, factionId) {
    return fleetsAtSystem(systemId)
      .filter((fleet) => fleet.factionId === factionId)
      .reduce((total, fleet) => total + fleet.ships, 0);
  }

  function nearbySystems(systemId, limit = 3) {
    const origin = systemsMap.value.get(systemId);
    if (!origin) {
      return [];
    }

    return (world.scenario?.systems ?? [])
      .filter((system) => system.id !== systemId)
      .map((system) => ({
        systemId: system.id,
        plan: routePlan(systemId, system.id),
      }))
      .filter((candidate) => candidate.plan !== null)
      .sort((left, right) => left.plan.distance - right.plan.distance || left.plan.travelDays - right.plan.travelDays)
      .slice(0, limit);
  }

  function routePlan(originSystemId, destinationSystemId) {
    if (!world.scenario) {
      return null;
    }

    const origin = systemsMap.value.get(originSystemId);
    const destination = systemsMap.value.get(destinationSystemId);
    if (!origin || !destination) {
      return null;
    }

    if (originSystemId === destinationSystemId) {
      return {
        systemId: destinationSystemId,
        distance: 0,
        totalDistance: 0,
        travelDays: 0,
        usesStarlane: false,
        segmentIds: [],
        pathSystemIds: [originSystemId],
      };
    }

    const systems = systemsMap.value;
    const seen = new Map();
    const queue = [{
      systemId: originSystemId,
      timeCost: 0,
      saltCostDistance: 0,
      pathSystemIds: [originSystemId],
      segmentIds: [],
      usesStarlane: false,
    }];

    const compare = (left, right) =>
      left.timeCost - right.timeCost
      || left.saltCostDistance - right.saltCostDistance
      || left.segmentIds.length - right.segmentIds.length
      || left.systemId.localeCompare(right.systemId);

    const extendPath = (node, nextSystemId, distance, timeMultiplier, saltMultiplier, segmentId, usesStarlane) => ({
      systemId: nextSystemId,
      timeCost: node.timeCost + distance * timeMultiplier,
      saltCostDistance: node.saltCostDistance + distance * saltMultiplier,
      pathSystemIds: [...node.pathSystemIds, nextSystemId],
      segmentIds: [...node.segmentIds, segmentId],
      usesStarlane: node.usesStarlane || usesStarlane,
    });

    while (queue.length > 0) {
      queue.sort(compare);
      const current = queue.shift();
      const known = seen.get(current.systemId);
      if (known && compare(known, current) <= 0) {
        continue;
      }
      seen.set(current.systemId, current);

      if (current.systemId === destinationSystemId) {
        const totalDistance = current.pathSystemIds.reduce((total, systemId, index, ids) => {
          if (index === 0) {
            return total;
          }
          const previous = systems.get(ids[index - 1]);
          const next = systems.get(systemId);
          return total + Math.hypot(next.position.x - previous.position.x, next.position.y - previous.position.y);
        }, 0);
        return {
          systemId: destinationSystemId,
          distance: current.saltCostDistance,
          totalDistance,
          travelDays: Math.max(1, Math.ceil(current.timeCost)),
          usesStarlane: current.usesStarlane,
          segmentIds: current.segmentIds,
          pathSystemIds: current.pathSystemIds,
        };
      }

      const currentSystem = systems.get(current.systemId);
      const directDistance = Math.hypot(
        destination.position.x - currentSystem.position.x,
        destination.position.y - currentSystem.position.y,
      );
      queue.push(
        extendPath(
          current,
          destinationSystemId,
          directDistance,
          DIRECT_TIME_MULTIPLIER,
          DIRECT_SALT_MULTIPLIER,
          `direct:${current.systemId}:${destinationSystemId}`,
          false,
        ),
      );

      for (const neighborId of currentSystem.starlaneLinks ?? []) {
        if (current.pathSystemIds.includes(neighborId)) {
          continue;
        }
        const neighbor = systems.get(neighborId);
        if (!neighbor) {
          continue;
        }
        const laneDistance = Math.hypot(
          neighbor.position.x - currentSystem.position.x,
          neighbor.position.y - currentSystem.position.y,
        );
        queue.push(
          extendPath(
            current,
            neighborId,
            laneDistance,
            STARLANE_TIME_MULTIPLIER,
            STARLANE_SALT_MULTIPLIER,
            formatStarlaneId(current.systemId, neighborId),
            true,
          ),
        );
      }
    }

    return null;
  }

function effectiveMass(ships, cargoSalt, metals) {
    return ships * (SHIP_MASS + 1) + metals + Math.ceil((cargoSalt ?? 0) / 3);
  }

  function requiredBurnSalt(ships, cargoSalt, metals, distance) {
    return Math.ceil(distance * effectiveMass(ships, cargoSalt, metals));
  }

  const currentSeat = computed(() => {
    if (!world.scenario || !world.result || !ui.seatFactionId) {
      return null;
    }

    const faction = world.scenario.factions.find((candidate) => candidate.id === ui.seatFactionId);
    const snapshot = latestSnapshot.value?.factions?.[ui.seatFactionId];
    if (!faction || !snapshot) {
      return null;
    }

    return { faction, snapshot };
  });

  const currentSeatHomeSystem = computed(() => {
    if (!currentSeat.value) {
      return null;
    }

    return systemsMap.value.get(currentSeat.value.faction.homeSystemId) ?? null;
  });

  const plannerStorageKey = computed(() => {
    if (!world.scenario || !ui.seatFactionId) {
      return null;
    }

    return `dead-reckoning:planner:${world.scenario.name}:${ui.seatFactionId}`;
  });

  function homeFactionForSystem(systemId) {
    if (!world.scenario) {
      return null;
    }

    return world.scenario.factions.find((faction) => faction.homeSystemId === systemId) ?? null;
  }

  const selectedSystem = computed(() => {
    if (!ui.selectedSystemId) {
      return null;
    }

    const system = systemsMap.value.get(ui.selectedSystemId);
    const snapshot = snapshotSystem(ui.selectedSystemId);
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
    if (!currentSeat.value || !world.scenario) {
      return [];
    }

    return world.scenario.systems.filter(
      (system) => latestSnapshot.value?.systems?.[system.id]?.ownerId === currentSeat.value.faction.id,
    );
  });

  function strategicMarkingRecord(systemId) {
    if (!systemId) {
      return null;
    }

    const record = ui.planner.strategicMarkingsBySystemId?.[systemId] ?? null;
    if (!record?.value) {
      return null;
    }

    const definition = strategicMarkingDefinition(record.value);
    if (!definition) {
      return null;
    }

    return {
      systemId,
      value: definition.value,
      label: definition.label,
      severity: definition.severity,
      summary: definition.summary,
      updatedAt: record.updatedAt ?? "",
    };
  }

  const selectedSystemMarking = computed(() =>
    strategicMarkingRecord(ui.selectedSystemId ?? null),
  );

  const strategicMarkingRows = computed(() => {
    if (!world.scenario || !currentSeat.value) {
      return [];
    }

    const homeSystemId = currentSeat.value.faction.homeSystemId;
    return Object.entries(ui.planner.strategicMarkingsBySystemId ?? {})
      .map(([systemId, record]) => {
        const definition = strategicMarkingDefinition(record?.value);
        const system = systemsMap.value.get(systemId);
        const snapshot = snapshotSystem(systemId);
        if (!definition || !system || !snapshot) {
          return null;
        }

        const plan = routePlan(homeSystemId, systemId);
        const yieldText = `${saltOutputForSystem(system)} salt + ${METAL_OUTPUT[system.metalRichness]} metal / year`;
        const ownerText =
          snapshot.ownerId === currentSeat.value.faction.id
            ? "Friendly Control"
            : snapshot.ownerId
              ? `Held by ${translateFactionId(snapshot.ownerId)}`
              : "Open System";

        let detail = definition.summary;
        switch (definition.value) {
          case "expand":
            detail = `${ownerText}. ${yieldText}. ${
              plan ? `About ${formatTravelSpan(plan.travelDays)} from ${translateSystemId(homeSystemId)}.` : "Route unresolved from home seat."
            }`;
            break;
          case "threat":
            detail = `${ownerText}. ${
              plan ? `Can reach our seat in about ${formatTravelSpan(plan.travelDays)}.` : "Watch this approach for future pressure."
            }`;
            break;
          case "screen":
            detail = `${(system.starlaneLinks ?? []).length} ${(system.starlaneLinks ?? []).length === 1 ? "starlane" : "starlanes"} connected. Probe and blockade warning value is high here.`;
            break;
          case "economic_priority":
            detail = `${ownerText}. ${yieldText}. Protect throughput and courier access here.`;
            break;
          case "future_link":
            detail = `${ownerText}. ${
              plan ? `Within ${formatTravelSpan(plan.travelDays)} of the seat.` : "Track this for later outward connection."
            }`;
            break;
          default:
            detail = `${ownerText}. ${definition.summary}`;
            break;
        }

        return {
          systemId,
          systemName: system.name,
          value: definition.value,
          label: definition.label,
          severity: definition.severity,
          updatedAt: record.updatedAt ?? "",
          ownerText,
          yieldText,
          detail,
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""))
        || left.systemName.localeCompare(right.systemName),
      );
  });

  const strategyBoardSummary = computed(() => ({
    total: strategicMarkingRows.value.length,
    expand: strategicMarkingRows.value.filter((row) => row.value === "expand").length,
    threat: strategicMarkingRows.value.filter((row) => row.value === "threat").length,
    screen: strategicMarkingRows.value.filter((row) => row.value === "screen").length,
    economic: strategicMarkingRows.value.filter((row) => row.value === "economic_priority").length,
    futureLink: strategicMarkingRows.value.filter((row) => row.value === "future_link").length,
  }));

  const originOptions = computed(() =>
    ownedSystems.value.map((system) => {
      const snapshot = snapshotSystem(system.id);
      return {
        label: snapshot
          ? `${system.name} · ${formatNumber(snapshot.saltStockpile)} salt · ${formatNumber(snapshot.probeStockpile ?? 0)} probes`
          : system.name,
        value: system.id,
      };
    }),
  );

  const activeFleetOriginSystemId = computed(() => {
    return ui.orderDraft.originSystemId ?? null;
  });

  const activeFleetOrigin = computed(() => {
    const systemId = activeFleetOriginSystemId.value;
    if (!systemId) {
      return null;
    }

    const system = systemsMap.value.get(systemId);
    const snapshot = snapshotSystem(systemId);
    if (!system || !snapshot) {
      return null;
    }

    return { system, snapshot };
  });

  const productionPlannerRows = computed(() =>
    ownedSystems.value.map((system) => {
      const snapshot = snapshotSystem(system.id);
      const storedPlan = ui.planner.productionBySystemId[system.id] ?? defaultProductionPlan();
      const shipyardCount = inferShipyardCount(system);
      const lines = normalizeProductionLines(
        storedPlan.lines,
        shipyardCount,
        storedPlan.focus ?? "ships",
        storedPlan.quantity ?? 1,
      );
      return {
        systemId: system.id,
        systemName: system.name,
        focus: lines[0]?.focus ?? "ships",
        quantity: lines[0]?.quantity ?? 1,
        posture: storedPlan.posture ?? "balanced",
        shipyardCount,
        infrastructure: system.infrastructure,
        lines: lines.map((line, index) => ({
          ...line,
          yardLabel: `Shipyard ${index + 1}`,
          summary: productionLineSummary(line.focus, line.quantity),
        })),
        outputText: `${saltOutputForSystem(system)} salt + ${METAL_OUTPUT[system.metalRichness]} metal / year`,
        storesText: snapshot
          ? `${formatNumber(snapshot.saltStockpile)} salt · ${formatNumber(snapshot.metalStockpile)} metal · ${formatNumber(snapshot.probeStockpile ?? 0)} probes`
          : "No current stores",
      };
    }),
  );

  const destinationOptions = computed(() => {
    if (!world.scenario) {
      return [];
    }

    const originSystemId = activeFleetOriginSystemId.value;
    return world.scenario.systems
      .filter(
        (system) =>
          system.id !== originSystemId,
      )
      .map((system) => ({ label: system.name, value: system.id }));
  });

  const anchorOptions = computed(() => {
    if (!world.scenario) {
      return [];
    }

    return world.scenario.systems
      .filter((system) => {
        if (ui.activeAction === "deploy_probe") {
          return true;
        }

        return system.id !== selectedSystem.value?.system.id;
      })
      .map((system) => ({
        label: system.name,
        value: system.id,
      }));
  });

  function probeOriginCandidates(targetSystemId) {
    if (!targetSystemId) {
      return [];
    }

    return ownedSystems.value
      .map((system) => {
        const plan = routePlan(system.id, targetSystemId);
        const snapshot = snapshotSystem(system.id);
        if (!plan || !snapshot) {
          return null;
        }

        const canAfford =
          snapshot.saltStockpile >= PROBE_COST_SALT
          && (snapshot.probeStockpile ?? 0) >= 1;

        return {
          systemId: system.id,
          plan,
          snapshot,
          canAfford,
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        left.plan.travelDays - right.plan.travelDays
        || left.plan.distance - right.plan.distance
        || left.systemId.localeCompare(right.systemId),
      );
  }

  const probeOriginOptions = computed(() => {
    const anchorId = ui.orderDraft.anchorId ?? selectedSystem.value?.system.id ?? null;
    if (!anchorId) {
      return [];
    }

    return probeOriginCandidates(anchorId).map((candidate) => ({
      label: `${translateSystemId(candidate.systemId)} · ${formatTravelSpan(candidate.plan.travelDays)} · ${formatNumber(candidate.snapshot.saltStockpile)} salt / ${formatNumber(candidate.snapshot.probeStockpile ?? 0)} probes`,
      value: candidate.systemId,
      canAfford: candidate.canAfford,
      travelDays: candidate.plan.travelDays,
    }));
  });

  const summaryCards = computed(() => {
    if (!currentSeat.value || !world.scenario) {
      return [];
    }

    const transitCount = fleetEntries.value.filter(
      (fleet) => fleet.factionId === currentSeat.value.faction.id && fleet.status === "transit",
    ).length;
    const contested = world.scenario.systems.filter((system) => {
      const view = latestSnapshot.value?.systems?.[system.id];
      return (
        view?.ownerId === currentSeat.value.faction.id
        && (view.captureProgress > 0 || view.claimProgress > 0)
      );
    }).length;

    return [
      { label: "Salt", value: formatNumber(currentSeat.value.snapshot.totalSaltStockpile) },
      { label: "Metals", value: formatNumber(currentSeat.value.snapshot.totalMetalStockpile) },
      { label: "Ships", value: formatNumber(currentSeat.value.snapshot.totalShips) },
      { label: "Transit", value: formatNumber(transitCount) },
      { label: "Contested", value: formatNumber(contested) },
    ];
  });

  const blockadeSystems = computed(() => {
    const bySystemId = new Map();

    for (const fleet of fleetEntries.value) {
      if (fleet.status !== "stationed" || fleet.mission !== "blockade" || !fleet.currentSystemId || fleet.ships <= 0) {
        continue;
      }
      const entry = bySystemId.get(fleet.currentSystemId) ?? {
        systemId: fleet.currentSystemId,
        owners: new Set(),
        totalShips: 0,
      };
      entry.owners.add(fleet.factionId);
      entry.totalShips += fleet.ships;
      bySystemId.set(fleet.currentSystemId, entry);
    }

    return bySystemId;
  });

  const mapLayout = computed(() => {
    if (!currentSeat.value || !world.scenario) {
      return new Map();
    }

    const homeSystemId = currentSeat.value.faction.homeSystemId;
    const layout = new Map();
    const homeSystem = systemsMap.value.get(homeSystemId);
    if (!homeSystem) {
      return layout;
    }

    const allSystems = world.scenario.systems;
    const minX = Math.min(...allSystems.map((system) => system.position.x));
    const maxX = Math.max(...allSystems.map((system) => system.position.x));
    const minY = Math.min(...allSystems.map((system) => system.position.y));
    const maxY = Math.max(...allSystems.map((system) => system.position.y));
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    for (const system of allSystems) {
      const x = 170 + ((system.position.x - minX) / spanX) * 980;
      const y = 130 + ((maxY - system.position.y) / spanY) * 520;
      layout.set(system.id, { x, y });
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

  const starlaneSegments = computed(() => {
    if (!world.scenario) {
      return [];
    }

    const lanes = [];
    const seen = new Set();

    for (const system of world.scenario.systems) {
      for (const neighborId of system.starlaneLinks ?? []) {
        const laneId = formatStarlaneId(system.id, neighborId);
        if (seen.has(laneId)) {
          continue;
        }
        seen.add(laneId);

        const neighbor = systemsMap.value.get(neighborId);
        const fromPoint = mapLayout.value.get(system.id);
        const toPoint = mapLayout.value.get(neighborId);
        if (!neighbor || !fromPoint || !toPoint) {
          continue;
        }

        const blockadeOwners = new Set();
        if (blockadeSystems.value.has(system.id)) {
          for (const ownerId of blockadeSystems.value.get(system.id).owners) {
            blockadeOwners.add(ownerId);
          }
        }
        if (blockadeSystems.value.has(neighborId)) {
          for (const ownerId of blockadeSystems.value.get(neighborId).owners) {
            blockadeOwners.add(ownerId);
          }
        }

        let blockadeTone = "none";
        if (blockadeOwners.size > 0) {
          const ownerIds = [...blockadeOwners];
          if (currentSeat.value && ownerIds.every((ownerId) => ownerId === currentSeat.value.faction.id)) {
            blockadeTone = "friendly";
          } else if (currentSeat.value && ownerIds.some((ownerId) => ownerId === currentSeat.value.faction.id)) {
            blockadeTone = "contested";
          } else {
            blockadeTone = "hostile";
          }
        }

        lanes.push({
          laneId,
          fromSystemId: system.id,
          toSystemId: neighborId,
          x1: fromPoint.x,
          y1: fromPoint.y,
          x2: toPoint.x,
          y2: toPoint.y,
          midpointX: (fromPoint.x + toPoint.x) / 2,
          midpointY: (fromPoint.y + toPoint.y) / 2,
          blockadeTone,
          blockadeOwners: [...blockadeOwners],
        });
      }
    }

    return lanes;
  });

  function resolveTransitMarker(originSystemId, destinationSystemId, departureDate, arrivalDate, pathSystemIds) {
    if (!currentWorldDate.value || !originSystemId || !destinationSystemId || !departureDate || !arrivalDate) {
      return null;
    }

    const resolvedPathSystemIds = pathSystemIds?.length
      ? pathSystemIds
      : [originSystemId, destinationSystemId];
    const points = resolvedPathSystemIds
      .map((systemId) => mapLayout.value.get(systemId))
      .filter(Boolean);
    if (points.length < 2) {
      return null;
    }

    const totalDays = Math.max(1, diffDays(departureDate, arrivalDate) ?? 1);
    const elapsedDays = clamp(diffDays(departureDate, currentWorldDate.value) ?? 0, 0, totalDays);
    const progress = clamp(elapsedDays / totalDays, 0.04, 0.96);

    const segments = [];
    let totalDistance = 0;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      segments.push({ from, to, distance });
      totalDistance += distance;
    }
    if (totalDistance <= 0) {
      return null;
    }

    let targetDistance = totalDistance * progress;
    let activeSegment = segments[segments.length - 1];
    for (const segment of segments) {
      if (targetDistance <= segment.distance) {
        activeSegment = segment;
        break;
      }
      targetDistance -= segment.distance;
    }

    const segmentProgress = activeSegment.distance > 0 ? targetDistance / activeSegment.distance : 0;
    return {
      x: activeSegment.from.x + (activeSegment.to.x - activeSegment.from.x) * segmentProgress,
      y: activeSegment.from.y + (activeSegment.to.y - activeSegment.from.y) * segmentProgress,
      angle:
        Math.atan2(
          activeSegment.to.y - activeSegment.from.y,
          activeSegment.to.x - activeSegment.from.x,
        ) * (180 / Math.PI),
      etaDays: diffDays(currentWorldDate.value, arrivalDate) ?? 0,
    };
  }

  const fleetMarkers = computed(() => {
    if (!currentWorldDate.value) {
      return [];
    }

    const markers = [];
    for (const fleet of fleetEntries.value) {
      if (
        fleet.status !== "transit"
        || !fleet.originSystemId
        || !fleet.destinationSystemId
        || !fleet.departureDate
        || !fleet.arrivalDate
        || !canSeeTransitFleet(fleet)
      ) {
        continue;
      }

      const marker = resolveTransitMarker(
        fleet.originSystemId,
        fleet.destinationSystemId,
        fleet.departureDate,
        fleet.arrivalDate,
        fleet.travelPathSystemIds,
      );
      if (!marker) {
        continue;
      }
      const factionName = translateFactionId(fleet.factionId);
      const destinationName = translateSystemId(fleet.destinationSystemId);
      const isEstimate = currentSeat.value && fleet.factionId !== currentSeat.value.faction.id;

      let tone = "neutral";
      if (currentSeat.value) {
        tone = fleet.factionId === currentSeat.value.faction.id ? "friendly" : "hostile";
      }

      markers.push({
        fleetId: fleet.fleetId,
        x: marker.x,
        y: marker.y,
        angle: marker.angle,
        ships: fleet.ships,
        tone,
        mission: fleet.mission,
        label: isEstimate ? `~${estimateTransitValue(fleet.ships)}` : `${fleet.ships}`,
        detail: isEstimate
          ? `Estimated foreign transit from ${factionName} ${formatMissionNarrative(fleet.mission)} toward ${destinationName}. ${formatTransitCargo(fleet.cargoSalt, fleet.metals, true)} ETA ${formatTravelSpan(marker.etaDays)}.`
          : `${factionName} ${formatMissionNarrative(fleet.mission)} toward ${destinationName}. ${formatTransitCargo(fleet.cargoSalt, fleet.metals, false)} ETA ${formatTravelSpan(marker.etaDays)}.`,
      });
    }

    return markers;
  });

  const probeMarkers = computed(() => {
    if (!currentWorldDate.value || !currentSeat.value) {
      return [];
    }

    const markers = [];
    for (const probe of probeEntries.value) {
      if (probe.factionId !== currentSeat.value.faction.id) {
        continue;
      }

      if (probe.status === "deployed") {
        const anchorPoint = mapLayout.value.get(probe.anchorSystemId);
        if (!anchorPoint) {
          continue;
        }

        markers.push({
          probeId: probe.probeId,
          status: "on_station",
          x: anchorPoint.x + 18,
          y: anchorPoint.y - 18,
          angle: 0,
          label: "P",
          detail: `Probe on station at ${translateSystemId(probe.anchorSystemId)}. Exact local conditions available.`,
        });
        continue;
      }

      if (
        probe.status !== "transit"
        || !probe.originSystemId
        || !probe.arrivalDate
      ) {
        continue;
      }

      const marker = resolveTransitMarker(
        probe.originSystemId,
        probe.anchorSystemId,
        probe.departureDate,
        probe.arrivalDate,
        [probe.originSystemId, probe.anchorSystemId],
      );
      if (!marker) {
        continue;
      }

      markers.push({
        probeId: probe.probeId,
        status: "in_transit",
        x: marker.x,
        y: marker.y,
        angle: marker.angle,
        label: "P",
        detail: `Probe from ${translateSystemId(probe.originSystemId)} toward ${translateSystemId(probe.anchorSystemId)}, ETA ${formatTravelSpan(marker.etaDays)}.`,
      });
    }

    return markers;
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

  function homeBadgeForSystem(systemId) {
    const homeFaction = homeFactionForSystem(systemId);
    if (!homeFaction) {
      return null;
    }

    if (currentSeat.value && homeFaction.id === currentSeat.value.faction.id) {
      return {
        label: "HOME",
        tone: "friendly",
      };
    }

    return {
      label: "HQ",
      tone: "hostile",
    };
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

  function blockadeStatus(systemId) {
    const blockading = blockadeSystems.value.get(systemId);
    if (!blockading || blockading.owners.size === 0) {
      return {
        status: "none",
        label: "No blockade",
        detail: "No fleet is currently screening the nearby starlanes from this system.",
      };
    }

    const ownerIds = [...blockading.owners];
    const ownerNames = ownerIds.map((ownerId) => translateFactionId(ownerId)).join(", ");
    const isFriendly = currentSeat.value && ownerIds.every((ownerId) => ownerId === currentSeat.value.faction.id);
    const isMixed = currentSeat.value && ownerIds.some((ownerId) => ownerId === currentSeat.value.faction.id) && !isFriendly;

    return {
      status: isFriendly ? "friendly" : isMixed ? "contested" : "hostile",
      label: isFriendly ? "Friendly blockade" : isMixed ? "Contested blockade" : "Foreign blockade",
      detail: `${ownerNames} ${ownerIds.length === 1 ? "is" : "are"} screening the connected starlanes from this system.`,
      totalShips: blockading.totalShips,
    };
  }

  function probeStatusForSystem(systemId) {
    if (!currentSeat.value) {
      return {
        status: "unknown",
        label: "Probe status unavailable",
        detail: "System intelligence is not yet available.",
        actionable: false,
      };
    }

    const snapshot = snapshotSystem(systemId);
    if (snapshot?.ownerId === currentSeat.value.faction.id) {
      return {
        status: "friendly_control",
        label: "Friendly control",
        detail: "Exact local defense, ships, and stores are available while you hold the system.",
        actionable: false,
      };
    }

    const matchingProbes = probeEntries.value
      .filter(
        (probe) =>
          probe.factionId === currentSeat.value.faction.id
          && probe.anchorSystemId === systemId,
      )
      .sort((left, right) => (left.arrivalDate ?? "").localeCompare(right.arrivalDate ?? ""));

    const onStation = matchingProbes.find((probe) => probe.status === "deployed");
    if (onStation) {
      return {
        status: "on_station",
        label: "Probe on station",
        detail: "Exact local defense, ships, and stores are being reported from this system.",
        actionable: false,
      };
    }

    const inTransit = matchingProbes.find((probe) => probe.status === "transit");
    if (inTransit) {
      const etaDays = diffDays(currentWorldDate.value, inTransit.arrivalDate);
      const originName = inTransit.originSystemId
        ? translateSystemId(inTransit.originSystemId)
        : "a friendly system";
      return {
        status: "in_transit",
        label: etaDays !== null
          ? `Probe arrives in ${formatTravelSpan(etaDays)}`
          : "Probe en route",
        detail: `A probe launched from ${originName} is already in transit to this system.`,
        actionable: false,
      };
    }

    const pendingProbe = ui.pendingProbeOrders[systemId];
    if (pendingProbe && pendingProbe.factionId === currentSeat.value.faction.id) {
      const etaDays = diffDays(currentWorldDate.value, pendingProbe.arrivalDate);
      return {
        status: "in_transit",
        label: etaDays !== null
          ? `Probe arrives in ${formatTravelSpan(etaDays)}`
          : "Probe en route",
        detail: `A probe launched from ${translateSystemId(pendingProbe.originSystemId)} is already in transit to this system.`,
        actionable: false,
      };
    }

    return {
      status: "none",
      label: "Launch Probe",
      detail: "Exact defense, ships, and stores are unknown here until a probe arrives on station.",
      actionable: true,
    };
  }

  function probeBadgeForSystem(systemId) {
    const status = probeStatusForSystem(systemId);
    if (status.status === "on_station") {
      return {
        label: "P",
        tone: "on_station",
        detail: status.label,
      };
    }
    if (status.status === "in_transit") {
      return {
        label: "→",
        tone: "in_transit",
        detail: status.label,
      };
    }
    return null;
  }

  const selectedSystemProbeStatus = computed(() => {
    if (!selectedSystem.value) {
      return null;
    }

    return probeStatusForSystem(selectedSystem.value.system.id);
  });

  const reconSummary = computed(() => {
    if (!currentSeat.value) {
      return {
        total: 0,
        onStation: 0,
        inTransit: 0,
        items: [],
      };
    }

    const items = [];

    for (const probe of probeEntries.value) {
      if (probe.factionId !== currentSeat.value.faction.id) {
        continue;
      }

      const onStation = probe.status === "deployed";
      const etaDays = probe.arrivalDate ? diffDays(currentWorldDate.value, probe.arrivalDate) : null;
      items.push({
        probeId: probe.probeId,
        systemId: probe.anchorSystemId,
        originSystemId: probe.originSystemId,
        label: translateSystemId(probe.anchorSystemId),
        status: onStation ? "on_station" : "in_transit",
        statusLabel: onStation
          ? "On station"
          : etaDays !== null
            ? `Arrives in ${formatTravelSpan(etaDays)}`
            : "En route",
        detail: onStation
          ? "Exact local conditions available."
          : `Probe launched from ${translateSystemId(probe.originSystemId)} toward ${translateSystemId(probe.anchorSystemId)}.`,
      });
    }

    for (const pendingProbe of Object.values(ui.pendingProbeOrders)) {
      if (pendingProbe.factionId !== currentSeat.value.faction.id) {
        continue;
      }
      if (items.some((item) => item.systemId === pendingProbe.anchorSystemId)) {
        continue;
      }
      const etaDays = diffDays(currentWorldDate.value, pendingProbe.arrivalDate);
      items.push({
        probeId: `pending:${pendingProbe.anchorSystemId}`,
        systemId: pendingProbe.anchorSystemId,
        originSystemId: pendingProbe.originSystemId,
        label: translateSystemId(pendingProbe.anchorSystemId),
        status: "in_transit",
        statusLabel: etaDays !== null
          ? `Arrives in ${formatTravelSpan(etaDays)}`
          : "En route",
        detail: `Probe launched from ${translateSystemId(pendingProbe.originSystemId)} toward ${translateSystemId(pendingProbe.anchorSystemId)}.`,
      });
    }

    items.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "in_transit" ? -1 : 1;
      }
      return left.label.localeCompare(right.label);
    });

    return {
      total: items.length,
      onStation: items.filter((item) => item.status === "on_station").length,
      inTransit: items.filter((item) => item.status === "in_transit").length,
      items,
    };
  });

  const probeCommandRows = computed(() => {
    if (!currentSeat.value) {
      return [];
    }

    return ownedSystems.value
      .map((system) => {
        const snapshot = snapshotSystem(system.id);
        const outgoingTransit = reconSummary.value.items.filter(
          (item) =>
            item.originSystemId === system.id
            && item.status === "in_transit",
        ).length;
        const localCoverage = reconSummary.value.items.filter(
          (item) =>
            item.systemId === system.id
            && item.status === "on_station",
        ).length;

        return {
          systemId: system.id,
          systemName: system.name,
          readyProbes: snapshot?.probeStockpile ?? 0,
          saltStockpile: snapshot?.saltStockpile ?? 0,
          outgoingTransit,
          localCoverage,
          launchCapable:
            (snapshot?.probeStockpile ?? 0) >= 1
            && (snapshot?.saltStockpile ?? 0) >= PROBE_COST_SALT,
        };
      })
      .sort((left, right) =>
        right.readyProbes - left.readyProbes
        || right.saltStockpile - left.saltStockpile
        || left.systemName.localeCompare(right.systemName),
      );
  });

  const selectedSystemOverview = computed(() => {
    if (!selectedSystem.value || !currentSeat.value) {
      return null;
    }

    const { system, snapshot } = selectedSystem.value;
    const homeFaction = homeFactionForSystem(system.id);
    const probeStatus = probeStatusForSystem(system.id);
    const blockade = blockadeStatus(system.id);
    const starlaneCount = (system.starlaneLinks ?? []).length;
    const canSeeLocalIntel =
      probeStatus.status === "friendly_control" || probeStatus.status === "on_station";
    const friendlyShips = totalShipsAtSystem(system.id, currentSeat.value.faction.id);
    const enemyShips = fleetsAtSystem(system.id)
      .filter((fleet) => fleet.factionId !== currentSeat.value.faction.id)
      .reduce((total, fleet) => total + fleet.ships, 0);

    const isSeatHome = system.id === currentSeat.value.faction.homeSystemId;
    const homeLabel = isSeatHome
      ? "Your home system"
      : homeFaction
        ? `${homeFaction.name} home system`
        : null;

    return {
      title: system.name,
      canSeeLocalIntel,
      homeLabel,
      strategicMarking: strategicMarkingRecord(system.id),
      owner:
        isSeatHome
          ? "Friendly Control"
          : snapshot.ownerId === currentSeat.value.faction.id
          ? "Friendly Control"
          : snapshot.ownerId
            ? `Held by ${world.scenario.factions.find((faction) => faction.id === snapshot.ownerId)?.name ?? snapshot.ownerId}`
            : "Open System",
      starText: `${titleCase(system.starType)} star`,
      metalText: `${titleCase(system.metalRichness)} metals`,
      laneText:
        starlaneCount > 0
          ? `${starlaneCount} ${starlaneCount === 1 ? "starlane" : "starlanes"} connected`
          : "No starlane junction",
      blockadeText: blockade.status === "none" ? null : blockade.label,
      probeStatus,
      facts: [
        {
          label: "Yield",
          value: `${saltOutputForSystem(system)} salt + ${METAL_OUTPUT[system.metalRichness]} metal / year`,
        },
        {
          label: "Seat",
          value: homeLabel ?? "Field system",
        },
        {
          label: "Defense",
          value: canSeeLocalIntel ? formatNumber(snapshot.defense) : "Probe required",
        },
        {
          label: "Ships",
          value: canSeeLocalIntel
            ? `${formatNumber(friendlyShips)} friendly / ${formatNumber(enemyShips)} enemy`
            : "Probe required",
        },
        {
          label: "Stores",
          value: canSeeLocalIntel
            ? `${formatNumber(snapshot.saltStockpile)} salt + ${formatNumber(snapshot.metalStockpile)} metal + ${formatNumber(snapshot.probeStockpile ?? 0)} probes`
            : "Probe required",
        },
      ],
    };
  });

  const commandRelay = computed(() => {
    if (!activeFleetOrigin.value || !currentSeat.value) {
      return null;
    }

    const homeSystemId = currentSeat.value.faction.homeSystemId;
    if (activeFleetOrigin.value.system.id === homeSystemId) {
      return {
        title: "Local order",
        detail: "Command seat is already present at this system.",
      };
    }

    const relayPlan = routePlan(homeSystemId, activeFleetOrigin.value.system.id);
    return {
      title: "Courier order",
      detail: relayPlan
        ? `1 pigeon from ${translateSystemId(homeSystemId)} to ${activeFleetOrigin.value.system.name} (${formatTravelSpan(relayPlan.travelDays)}, 1 salt).`
        : `1 pigeon from ${translateSystemId(homeSystemId)} to ${activeFleetOrigin.value.system.name} (route unresolved).`,
    };
  });

  const processedReportIds = computed(
    () => new Set([
      ...Object.keys(ui.planner.archivedReportsById ?? {}),
      ...Object.keys(ui.planner.followUpReportsById ?? {}),
    ]),
  );

  const rawFeedItems = computed(() => {
    if (!currentSeat.value || !world.result) {
      return [];
    }

    const relevantSystemIds = new Set(ownedSystems.value.map((system) => system.id));
    relevantSystemIds.add(currentSeat.value.faction.homeSystemId);
    for (const systemId of [...relevantSystemIds]) {
      for (const nearby of nearbySystems(systemId)) {
        relevantSystemIds.add(nearby.systemId);
      }
    }

    const snapshots = world.result.snapshots ?? [];
    const snapshotIndex = new Map(snapshots.map((snapshot) => [snapshot.date, snapshot]));
    const firstFleetSnapshot = (fleetId, date) => {
      const startIndex = Math.max(
        0,
        snapshots.findIndex((snapshot) => snapshot.date >= date),
      );
      for (let index = startIndex; index < snapshots.length; index += 1) {
        const fleet = snapshots[index]?.fleets?.[fleetId];
        if (fleet) {
          return fleet;
        }
      }
      return null;
    };
    const firstProbeSnapshot = (probeId, date) => {
      const startIndex = Math.max(
        0,
        snapshots.findIndex((snapshot) => snapshot.date >= date),
      );
      for (let index = startIndex; index < snapshots.length; index += 1) {
        const probe = snapshots[index]?.probes?.[probeId];
        if (probe) {
          return probe;
        }
      }
      return null;
    };
    const systemViewAt = (systemId, date) => snapshotIndex.get(date)?.systems?.[systemId] ?? null;
    const classifyLaunch = (factionId, destinationId, mission, date) => {
      const destinationView = systemViewAt(destinationId, date);
      const destinationOwnerId = destinationView?.ownerId ?? null;
      const destinationOwnerName = destinationOwnerId ? translateFactionId(destinationOwnerId) : null;

      if (mission === "trade") {
        return {
          kicker: "Trade signal",
          analysis: `${translateFactionId(factionId)} is moving cargo toward ${translateSystemId(destinationId)} for exchange or stockpile transfer.`,
        };
      }

      if (mission === "resupply") {
        return {
          kicker: "Supply convoy",
          analysis: `${translateFactionId(factionId)} is strengthening endurance at ${translateSystemId(destinationId)} rather than looking for a decisive fight.`,
        };
      }

      if (mission === "blockade") {
        return {
          kicker: "Blockade burn",
          analysis: `${translateFactionId(factionId)} is moving to hold ${translateSystemId(destinationId)} as a waypoint and threaten fast starlane traffic through it.`,
        };
      }

      if (destinationOwnerId === factionId) {
        return {
          kicker: "Reinforcement burn",
          analysis: `${translateFactionId(factionId)} is reinforcing a friendly system and preparing for future contact.`,
        };
      }

      if (!destinationOwnerId) {
        return {
          kicker: "Expansion burn",
          analysis: `${translateFactionId(factionId)} is likely trying to claim an open system before a rival can establish control.`,
        };
      }

      if (destinationOwnerId === currentSeat.value.faction.id) {
        return {
          kicker: "Incoming threat",
          analysis: `${translateFactionId(factionId)} is attacking our position at ${translateSystemId(destinationId)} and likely intends to seize the system.`,
        };
      }

      return {
        kicker: "Attack burn",
        analysis: `${translateFactionId(factionId)} is attacking ${destinationOwnerName} at ${translateSystemId(destinationId)} and likely intends to take the system.`,
      };
    };
    const pendingProbeItems = Object.values(ui.pendingProbeOrders)
      .filter((probe) => probe.factionId === currentSeat.value.faction.id)
      .map((probe) => {
        const etaDays = diffDays(currentWorldDate.value, probe.arrivalDate);
        return {
          id: `pending_probe:${probe.anchorSystemId}:${probe.submittedAt}`,
          date: probe.submittedAt,
          kicker: "Recon launched",
          title: `${translateFactionId(probe.factionId)} dispatched a probe toward ${translateSystemId(probe.anchorSystemId)}`,
          summary: `${translateSystemId(probe.originSystemId)} launched a probe toward ${translateSystemId(probe.anchorSystemId)}. Expected arrival in ${formatTravelSpan(etaDays ?? 0)}.`,
          analysis: "When it arrives, exact local defense, ships, and stores will become visible for that system.",
          tone: "info",
        };
      });
    const items = [];

    for (const line of [...world.result.log].reverse()) {
      const parsed = parseLogEntry(line);
      if (
        !parsed ||
        parsed.detail.includes(" produced ") ||
        parsed.detail.includes(" queued ") ||
        parsed.detail.includes(" sent pigeon ") ||
        parsed.detail.includes(" delivered to ") ||
        parsed.detail.includes("report ") ||
        parsed.detail.includes(" failed to turn ") ||
        parsed.detail.includes(" turned toward ") ||
        parsed.detail.includes(" unloaded friendly cargo ") ||
        parsed.detail.includes(" traded at ")
      ) {
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
        const fleet = firstFleetSnapshot(launchMatch[2], parsed.date);
        if (!canSeeTransitFleet(fleet)) {
          continue;
        }
        const plan = routePlan(launchMatch[3], launchMatch[4]);
        const launchClassification = classifyLaunch(
          launchMatch[1],
          launchMatch[4],
          fleet?.mission ?? null,
          parsed.date,
        );
        const estimatedShips = fleet ? estimateTransitValue(fleet.ships) : "?";
        const exactShips = fleet?.ships ?? "?";
        const seatLaunch = fleet?.factionId === currentSeat.value.faction.id;
        item = {
          id: `log:${parsed.date}:${detail}`,
          date: parsed.date,
          kicker: launchClassification.kicker,
          title: `${translateFactionId(launchMatch[1])} launched ${seatLaunch ? exactShips : `an estimated ${estimatedShips}`} ships toward ${translateSystemId(launchMatch[4])}`,
          summary: `${translateFactionId(launchMatch[1])} departed ${translateSystemId(launchMatch[3])} for ${translateSystemId(launchMatch[4])}. ${seatLaunch ? "Expected arrival" : "Estimated arrival"} in ${formatTravelSpan(plan?.travelDays ?? 0)}.`,
          analysis: launchClassification.analysis,
          tone:
            launchMatch[4] === currentSeat.value.faction.homeSystemId || relevantSystemIds.has(launchMatch[4])
              ? "danger"
              : launchMatch[1] === currentSeat.value.faction.id
                ? "info"
                : "warn",
        };
      }

      const probeLaunchMatch = detail.match(/^(\w+) deployed probe (\S+) from (\S+) to (\S+)$/u);
      if (!item && probeLaunchMatch) {
        const probe = firstProbeSnapshot(probeLaunchMatch[2], parsed.date);
        const plan = routePlan(probeLaunchMatch[3], probeLaunchMatch[4]);
        const seatLaunch = probeLaunchMatch[1] === currentSeat.value.faction.id;
        if (!seatLaunch) {
          continue;
        }
        item = {
          id: `log:${parsed.date}:${detail}`,
          date: parsed.date,
          kicker: "Recon launched",
          title: `${translateFactionId(probeLaunchMatch[1])} dispatched a probe toward ${translateSystemId(probeLaunchMatch[4])}`,
          summary: `${translateSystemId(probeLaunchMatch[3])} launched a probe toward ${translateSystemId(probeLaunchMatch[4])}. Expected arrival in ${formatTravelSpan(plan?.travelDays ?? 0)}.`,
          analysis: "When it arrives, exact local defense, ships, and stores will become visible for that system.",
          tone: "info",
        };
        if (probe?.status === "deployed") {
          item.analysis = `${translateFactionId(probeLaunchMatch[1])} already has exact local visibility there.`;
        }
      }

      const probeArrivalMatch = detail.match(/^probe (\S+) deployed at (\S+)$/u);
      if (!item && probeArrivalMatch) {
        const probe = firstProbeSnapshot(probeArrivalMatch[1], parsed.date);
        const seatProbe = probe?.factionId === currentSeat.value.faction.id;
        if (!seatProbe) {
          continue;
        }
        item = {
          id: `log:${parsed.date}:${detail}`,
          date: parsed.date,
          kicker: "Recon on station",
          title: `Probe established at ${translateSystemId(probeArrivalMatch[2])}`,
          summary: `A friendly probe is now reporting exact local conditions from ${translateSystemId(probeArrivalMatch[2])}.`,
          analysis: "The system card now reflects live local defense, ships, and stores from the probe.",
          tone: "success",
        };
      }

      const combatMatch = detail.match(/^combat at (\S+); attacker (\w+) lost (\d+), defender (\w+) lost (\d+)$/u);
      if (!item && combatMatch) {
        const systemView = systemViewAt(combatMatch[1], parsed.date);
        const attackerLosses = Number(combatMatch[3]);
        const defenderLosses = Number(combatMatch[5]);
        let analysis = `${translateSystemId(combatMatch[1])} is still contested.`;
        if (systemView?.ownerId === combatMatch[4]) {
          analysis = `${translateFactionId(combatMatch[4])} likely held the field, but more pressure could still flip control.`;
        } else if (systemView?.ownerId === combatMatch[2]) {
          analysis = `${translateFactionId(combatMatch[2])} appears to have broken local resistance and may be close to capture.`;
        } else if (attackerLosses > defenderLosses) {
          analysis = `${translateFactionId(combatMatch[2])} paid more for the attack and may need reinforcements before trying again.`;
        } else if (defenderLosses > attackerLosses) {
          analysis = `${translateFactionId(combatMatch[2])} damaged the defense and may follow with a capture attempt.`;
        }
        item = {
          id: `log:${parsed.date}:${detail}`,
          date: parsed.date,
          kicker: "Battle report",
          title: `Fighting at ${translateSystemId(combatMatch[1])}`,
          summary: `${translateFactionId(combatMatch[2])} lost ${combatMatch[3]} ships. ${translateFactionId(combatMatch[4])} lost ${combatMatch[5]} ships.`,
          analysis,
          tone: relevantSystemIds.has(combatMatch[1]) ? "danger" : "warn",
        };
      }

      const captureMatch = detail.match(/^(\w+) captured (\S+)$/u);
      if (!item && captureMatch) {
        item = {
          id: `log:${parsed.date}:${detail}`,
          date: parsed.date,
          kicker: "Control shift",
          title: `${translateSystemId(captureMatch[2])} changed hands`,
          summary: `${translateFactionId(captureMatch[1])} completed the takeover of ${translateSystemId(captureMatch[2])}.`,
          analysis:
            captureMatch[1] === currentSeat.value.faction.id
              ? `${translateSystemId(captureMatch[2])} now feeds our economy, but the new control window is still vulnerable to immediate counterattack.`
              : `${translateSystemId(captureMatch[2])} now pays salt and metals to ${translateFactionId(captureMatch[1])}. A fast counterattack can still matter if the grip is new.`,
          tone: captureMatch[1] === currentSeat.value.faction.id ? "success" : "danger",
        };
      }

      const claimMatch = detail.match(/^(\w+) claimed open system (\S+)$/u);
      if (!item && claimMatch) {
        item = {
          id: `log:${parsed.date}:${detail}`,
          date: parsed.date,
          kicker: "Frontier claim",
          title: `${translateFactionId(claimMatch[1])} secured ${translateSystemId(claimMatch[2])}`,
          summary: `${translateSystemId(claimMatch[2])} was open and has now entered ${translateFactionId(claimMatch[1])}'s network.`,
          analysis: "Unchecked frontier growth compounds quickly because the new system starts generating salt immediately.",
          tone: claimMatch[1] === currentSeat.value.faction.id ? "success" : "warn",
        };
      }

      const arrivalMatch = detail.match(/^fleet (\S+) arrived at (\S+)$/u);
      if (!item && arrivalMatch) {
        const fleet = firstFleetSnapshot(arrivalMatch[1], parsed.date);
        const destinationView = systemViewAt(arrivalMatch[2], parsed.date);
        if (
          !fleet
          || (
            !canSeeTransitFleet(fleet)
            && destinationView?.ownerId !== currentSeat.value.faction.id
          )
        ) {
          continue;
        }
        const isHostileArrival =
          fleet?.factionId &&
          destinationView?.ownerId &&
          fleet.factionId !== destinationView.ownerId;
        item = {
          id: `log:${parsed.date}:${detail}`,
          date: parsed.date,
          kicker: "Arrival burn",
          title: `${translateSystemId(arrivalMatch[2])} received ${fleet?.ships ?? "?"} ships`,
          summary: `${translateFactionId(fleet?.factionId ?? "unknown")} reached ${translateSystemId(arrivalMatch[2])}${fleet?.mission ? ` ${formatMissionNarrative(fleet.mission)}` : ""}.`,
          analysis: isHostileArrival
            ? "This arrival threatens local control immediately if the defender cannot match the landing force."
            : "This movement changes local force balance even if it does not produce combat right away.",
          tone: relevantSystemIds.has(arrivalMatch[2]) || isHostileArrival ? "warn" : "info",
        };
      }

      if (!item) {
        continue;
      }

      items.push(item);
      if (items.length >= 60) {
        break;
      }
    }

    const combined = [...pendingProbeItems, ...items];
    return combined.slice(0, 60);
  });

  const feedItems = computed(() =>
    rawFeedItems.value
      .map((item) => withAdvisorContext(item))
      .filter((item) => !processedReportIds.value.has(item.id))
      .slice(0, 12),
  );

  const archivedReportItems = computed(() =>
    sortReportsByDate(Object.values(ui.planner.archivedReportsById ?? {}))
      .map((item) => withAdvisorContext(item)),
  );

  const notebookTodoItems = computed(() =>
    sortReportsByDate(Object.values(ui.planner.followUpReportsById ?? {}))
      .map((item) => withAdvisorContext(item)),
  );

  const orderBrief = computed(() => {
    if (!currentSeat.value) {
      return {
        title: "Orders Await Context",
        lines: ["Choose a faction seat before issuing orders."],
      };
    }

    const destinationId = ui.orderDraft.destinationId ?? destinationOptions.value[0]?.value ?? null;
    const destinationName = destinationId ? translateSystemId(destinationId) : "No destination";
    const relayLine = commandRelay.value ? `${commandRelay.value.title}: ${commandRelay.value.detail}` : null;

    if (ui.activeAction === "attack" || ui.activeAction === "reinforce" || ui.activeAction === "blockade") {
      const origin = activeFleetOrigin.value;
      if (!origin) {
        return {
          title: "Choose An Origin",
          lines: ["Use the Origin field to choose a friendly system before launching ships."],
        };
      }

      const plan = destinationId ? routePlan(origin.system.id, destinationId) : null;
      const ships = Number(ui.orderDraft.ships || 1);
      const burn = plan ? requiredBurnSalt(ships, 0, 0, plan.distance) : null;
      const title =
        ui.activeAction === "attack"
          ? "Attack Order"
          : ui.activeAction === "reinforce"
            ? "Reinforcement Order"
            : "Blockade Order";
      const intentLine =
        ui.activeAction === "attack"
          ? "Intent: force a fight and pressure local control."
          : ui.activeAction === "reinforce"
            ? "Intent: strengthen a friendly position before contact."
            : "Intent: hold a strategic waypoint and threaten passing starlane traffic.";
      return {
        title,
        lines: [
          `${ships} ships toward ${destinationName}`,
          intentLine,
          `Transit estimate: ${plan ? formatTravelSpan(plan.travelDays) : "No route"}`,
          `Projected burn cost: ${burn !== null ? `${burn} salt` : "Route required"}`,
          burn !== null
            ? `Post-launch local salt: ${Math.max(0, origin.snapshot.saltStockpile - burn)}`
            : "Post-launch local salt: unresolved until a route exists.",
          ui.activeAction === "blockade"
            ? "Blockading fleets can trigger interception penalties against enemies using adjacent starlanes."
            : null,
          relayLine,
        ].filter(Boolean),
      };
    }

    if (ui.activeAction === "resupply") {
      const origin = activeFleetOrigin.value;
      if (!origin) {
        return {
          title: "Choose An Origin",
          lines: ["Use the Origin field to choose a friendly system before sending supplies."],
        };
      }

      const plan = destinationId ? routePlan(origin.system.id, destinationId) : null;
      const ships = Number(ui.orderDraft.ships || 1);
      const burn = plan ? requiredBurnSalt(ships, 0, 0, plan.distance) : null;
      return {
        title: "Resupply Order",
        lines: [
          `${ships} ships escort supplies toward ${destinationName}`,
          `Cargo priority: ${titleCase(ui.orderDraft.resupplyFocus)}`,
          `Transit estimate: ${plan ? formatTravelSpan(plan.travelDays) : "No route"}`,
          `Escort burn cost: ${burn !== null ? `${burn} salt` : "Route required"}`,
          "Supply mass will expand in a later draft; this preview prices the escort first.",
          relayLine,
        ].filter(Boolean),
      };
    }

    if (ui.activeAction === "deploy_probe") {
      const anchorId = ui.orderDraft.anchorId ?? selectedSystem.value?.system.id ?? anchorOptions.value[0]?.value ?? null;
      if (!anchorId) {
        return {
          title: "Choose A Probe Target",
          lines: ["Select an anchor system before dispatching reconnaissance."],
        };
      }

      const originSystemId = ui.orderDraft.probeOriginId ?? null;
      if (!originSystemId) {
        return {
          title: "Choose An Origin",
          lines: ["Select a friendly origin with salt and a ready probe to launch reconnaissance."],
        };
      }

      const anchorPlan = routePlan(originSystemId, anchorId);
      const probeStatus = probeStatusForSystem(anchorId);
      return {
        title: "Probe Mission",
        lines: [
          `Target: ${translateSystemId(anchorId)}`,
          `Origin: ${translateSystemId(originSystemId)}`,
          `Estimated arrival: ${formatTravelSpan(anchorPlan?.travelDays ?? 0)}`,
          `Cost: ${PROBE_COST_SALT} salt`,
          "Requires: 1 ready probe in origin stores",
          "Dispatch from this dock to launch the probe immediately.",
          probeStatus.status === "in_transit"
            ? probeStatus.label
            : "Probes narrow uncertainty around approach lanes and turns.",
          relayLine,
        ].filter(Boolean),
      };
    }

    const origin = activeFleetOrigin.value;
    if (!origin) {
      return {
        title: "Choose An Origin",
        lines: ["Use the Origin field to choose a friendly system before assigning trade."],
      };
    }

    const plan = destinationId ? routePlan(origin.system.id, destinationId) : null;
    return {
      title: "Trade Run",
      lines: [
        `${origin.system.name} to ${destinationName}`,
        `Cargo priority: ${titleCase(ui.orderDraft.tradeFocus)}`,
        `Transit estimate: ${plan ? formatTravelSpan(plan.travelDays) : "No route"}`,
        `Local production: ${saltOutputForSystem(origin.system)} salt / ${METAL_OUTPUT[origin.system.metalRichness]} metals per year`,
        relayLine,
      ].filter(Boolean),
    };
  });

  const orderSubmission = computed(() => {
    if (api.submitting) {
      return {
        label: "Transmitting...",
        disabled: true,
        reason: "Order is in flight to the worker now.",
      };
    }

    if (ui.activeAction === "deploy_probe") {
      const anchorId = ui.orderDraft.anchorId ?? anchorOptions.value[0]?.value ?? null;
      if (!anchorId) {
        return {
          label: "No probe target",
          disabled: true,
          reason: "Choose a system to anchor the probe.",
        };
      }

      const originSystemId = ui.orderDraft.probeOriginId ?? null;
      const originSnapshot = snapshotSystem(originSystemId);
      if (!originSnapshot) {
        return {
          label: "No origin",
          disabled: true,
          reason: "Choose a friendly system to launch the probe from.",
        };
      }

      if (
        originSnapshot.saltStockpile < PROBE_COST_SALT
        || (originSnapshot.probeStockpile ?? 0) < 1
      ) {
        return {
          label: "Insufficient stores",
          disabled: true,
          reason: `${translateSystemId(originSystemId)} needs ${PROBE_COST_SALT} salt and 1 ready probe to launch reconnaissance.`,
        };
      }

      const originPlan = routePlan(originSystemId, anchorId);
      if (!originPlan) {
        return {
          label: "No travel plan",
          disabled: true,
          reason: `No travel plan from ${translateSystemId(originSystemId)} to ${translateSystemId(anchorId)}.`,
        };
      }

      const probeStatus = probeStatusForSystem(anchorId);
      if (probeStatus.status === "in_transit" || probeStatus.status === "on_station") {
        return {
          label: probeStatus.status === "on_station" ? "Probe on station" : "Probe already en route",
          disabled: true,
          reason: probeStatus.detail,
        };
      }

      return {
        label: "Dispatch Probe",
        disabled: false,
        reason: `Execute the launch from this dock: spend ${PROBE_COST_SALT} salt from ${translateSystemId(originSystemId)} and commit 1 ready probe to establish exact local intelligence.`,
      };
    }

    const origin = activeFleetOrigin.value;
    if (!origin) {
      return {
        label: "Choose origin",
        disabled: true,
        reason: "Choose a friendly origin system in the dock to execute this order.",
      };
    }

    const destinationId = ui.orderDraft.destinationId ?? destinationOptions.value[0]?.value ?? null;
    if (!destinationId) {
      return {
        label: "No destination",
        disabled: true,
        reason: "Choose a destination system first.",
      };
    }

    const plan = routePlan(origin.system.id, destinationId);
    if (!plan) {
      return {
        label: "No route",
        disabled: true,
        reason: "There is no known route to that system.",
      };
    }

    return {
      label:
        ui.activeAction === "attack"
          ? "Launch Attack"
          : ui.activeAction === "reinforce"
            ? "Send Reinforcement"
            : ui.activeAction === "blockade"
              ? "Establish Blockade"
            : ui.activeAction === "resupply"
              ? "Send Resupply"
              : "Dispatch Trade Run",
      disabled: false,
      reason: "Execute this order from the dock and update the working world state immediately.",
    };
  });

  watch(destinationOptions, (options) => {
    if (options.length > 0 && !options.some((option) => option.value === ui.orderDraft.destinationId)) {
      ui.orderDraft.destinationId = options[0].value;
    }
  });

  watch(
    plannerStorageKey,
    (key) => {
      if (!key) {
        ui.plannerLoadedKey = null;
        ui.planner.speculation = "";
        ui.planner.productionBySystemId = {};
        ui.planner.strategicMarkingsBySystemId = {};
        ui.planner.archivedReportsById = {};
        ui.planner.followUpReportsById = {};
        return;
      }

      let nextState = null;
      if (storage) {
        try {
          const raw = storage.getItem(key);
          nextState = raw ? JSON.parse(raw) : null;
        } catch {
          nextState = null;
        }
      }

      ui.plannerLoadedKey = key;
      ui.planner.speculation = typeof nextState?.speculation === "string" ? nextState.speculation : "";
      ui.planner.productionBySystemId =
        nextState?.productionBySystemId && typeof nextState.productionBySystemId === "object"
          ? nextState.productionBySystemId
          : {};
      ui.planner.strategicMarkingsBySystemId =
        nextState?.strategicMarkingsBySystemId && typeof nextState.strategicMarkingsBySystemId === "object"
          ? nextState.strategicMarkingsBySystemId
          : {};
      ui.planner.archivedReportsById =
        nextState?.archivedReportsById && typeof nextState.archivedReportsById === "object"
          ? nextState.archivedReportsById
          : {};
      ui.planner.followUpReportsById =
        nextState?.followUpReportsById && typeof nextState.followUpReportsById === "object"
          ? nextState.followUpReportsById
          : {};
    },
    { immediate: true },
  );

  watch(
    () => plannerStorageKey.value ? JSON.stringify({
      speculation: ui.planner.speculation,
      productionBySystemId: ui.planner.productionBySystemId,
      strategicMarkingsBySystemId: ui.planner.strategicMarkingsBySystemId,
      archivedReportsById: ui.planner.archivedReportsById,
      followUpReportsById: ui.planner.followUpReportsById,
    }) : null,
    (serialized) => {
      const key = plannerStorageKey.value;
      if (!key || !storage || ui.plannerLoadedKey !== key || serialized === null) {
        return;
      }

      try {
        storage.setItem(key, serialized);
      } catch {
        // Ignore storage quota or availability errors; the planner still works in-memory.
      }
    },
  );

  watch(anchorOptions, (options) => {
    if (options.length > 0 && !options.some((option) => option.value === ui.orderDraft.anchorId)) {
      ui.orderDraft.anchorId = options[0].value;
    }
  });

  watch(originOptions, (options) => {
    if (options.length === 0) {
      ui.orderDraft.originSystemId = null;
      return;
    }

    if (!options.some((option) => option.value === ui.orderDraft.originSystemId)) {
      ui.orderDraft.originSystemId = null;
    }
  });

  watch(probeOriginOptions, (options) => {
    if (options.length === 0) {
      ui.orderDraft.probeOriginId = null;
      return;
    }

    if (options.some((option) => option.value === ui.orderDraft.probeOriginId)) {
      return;
    }

    const preferred = options.find((option) => option.canAfford) ?? options[0];
    ui.orderDraft.probeOriginId = preferred.value;
  });

  watch(
    () => ui.selectedSystemId,
    (systemId) => {
      if (!currentSeat.value) {
        return;
      }

      if (ui.activeAction === "deploy_probe") {
        if (!systemId) {
          return;
        }

        const snapshot = snapshotSystem(systemId);
        if (snapshot?.ownerId === currentSeat.value.faction.id) {
          ui.orderDraft.probeOriginId = systemId;
        }
        return;
      }

      if (!systemId) {
        ui.orderDraft.originSystemId = null;
        return;
      }

      const snapshot = snapshotSystem(systemId);
      if (snapshot?.ownerId === currentSeat.value.faction.id) {
        ui.orderDraft.originSystemId = systemId;
      }
    },
  );

  watch(
    () => ui.activeAction,
    () => {
      if (!currentSeat.value || ui.activeAction === "deploy_probe") {
        return;
      }

      const systemId = ui.selectedSystemId;
      if (!systemId) {
        return;
      }

      const snapshot = snapshotSystem(systemId);
      if (snapshot?.ownerId === currentSeat.value.faction.id) {
        ui.orderDraft.originSystemId = systemId;
      }
    },
  );

  function chooseDefaultScenarioId() {
    const fromQuery = new URLSearchParams(locationSearch).get("scenario");
    if (fromQuery && testHarness.scenarioList.some((entry) => entry.id === fromQuery)) {
      return fromQuery;
    }
    if (testHarness.scenarioList.some((entry) => entry.id === "starter_constellation")) {
      return "starter_constellation";
    }
    if (testHarness.scenarioList.some((entry) => entry.id === "profile_frontier_vs_turtle")) {
      return "profile_frontier_vs_turtle";
    }
    return testHarness.scenarioList[0]?.id ?? null;
  }

  function chooseDefaultSeatId() {
    if (!world.scenario) {
      return null;
    }

    const fromQuery = new URLSearchParams(locationSearch).get("seat");
    if (fromQuery && world.scenario.factions.some((faction) => faction.id === fromQuery)) {
      return fromQuery;
    }

    return world.scenario.factions[0]?.id ?? null;
  }

  async function loadScenario(id) {
    const response = await fetchImpl(`/api/scenarios/${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(`Unable to load scenario ${id}`);
    }
    const loadedScenario = await response.json();

    const simulationResponse = await fetchImpl("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(loadedScenario),
    });
    if (!simulationResponse.ok) {
      throw new Error(`Unable to simulate scenario ${id}`);
    }

    testHarness.activeScenarioId = id;
    world.scenario = normalizeScenario(loadedScenario);
    world.result = await simulationResponse.json();
    ui.pendingProbeOrders = {};
    ui.seatFactionId = chooseDefaultSeatId();
    ui.selectedSystemId =
      world.scenario.factions.find((faction) => faction.id === ui.seatFactionId)?.homeSystemId
      ?? world.scenario.systems[0]?.id
      ?? null;
  }

  async function loadInitialData() {
    try {
      const health = await fetchImpl("/api/health");
      if (!health.ok) {
        throw new Error("health check failed");
      }

      const response = await fetchImpl("/api/scenarios");
      if (!response.ok) {
        throw new Error("scenario list failed");
      }

      const payload = await response.json();
      testHarness.scenarioList = payload.scenarios;
      const scenarioId = chooseDefaultScenarioId();
      if (scenarioId) {
        await loadScenario(scenarioId);
      }
    } catch (error) {
      api.tone = "error";
      api.status = "Link lost";
      api.error = error instanceof Error ? error.message : "Unable to initialize command table.";
    }
  }

  async function simulateWorkingScenario(nextScenario) {
    const simulationResponse = await fetchImpl("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextScenario),
    });

    if (!simulationResponse.ok) {
      const failureBody = await simulationResponse.text();
      throw new Error(failureBody || `Unable to simulate scenario ${nextScenario.name}`);
    }

    world.scenario = nextScenario;
    world.result = await simulationResponse.json();
  }

  function currentCommandDate() {
    return currentWorldDate.value ?? world.scenario?.startDate ?? null;
  }

  function appendScenarioCommand(command) {
    if (!world.scenario) {
      throw new Error("No working scenario is loaded.");
    }

    const nextScenario = cloneScenario(world.scenario);
    nextScenario.commands = [...(nextScenario.commands ?? []), command];
    return nextScenario;
  }

  function buildFleetCommand(mission) {
    if (!currentSeat.value) {
      throw new Error("Select a friendly origin system first.");
    }

    const at = currentCommandDate();
    const originSystemId = activeFleetOriginSystemId.value;
    const destinationSystemId = ui.orderDraft.destinationId ?? destinationOptions.value[0]?.value ?? null;
    if (!at || !originSystemId || !destinationSystemId) {
      throw new Error("Choose a destination before sending a fleet.");
    }

    const ships = mission === "trade" ? 1 : Number(ui.orderDraft.ships || 1);
    return {
      type: "launch_fleet",
      at,
      factionId: currentSeat.value.faction.id,
      originSystemId,
      destinationSystemId,
      ships,
      mission,
    };
  }

  function buildProbeCommand({ originSystemId, anchorSystemId }) {
    if (!currentSeat.value) {
      throw new Error("No player seat is active.");
    }

    const at = currentCommandDate();
    if (!at || !originSystemId || !anchorSystemId) {
      throw new Error("Probe orders require both an origin and an anchor.");
    }

    const originSnapshot = snapshotSystem(originSystemId);
    if (!originSnapshot) {
      throw new Error(`Unknown origin system ${originSystemId}.`);
    }
    if (originSnapshot.ownerId !== currentSeat.value.faction.id) {
      throw new Error(`${translateSystemId(originSystemId)} is not under friendly control.`);
    }
    if (
      originSnapshot.saltStockpile < PROBE_COST_SALT
      || (originSnapshot.probeStockpile ?? 0) < 1
    ) {
      throw new Error(
        `${translateSystemId(originSystemId)} needs ${PROBE_COST_SALT} salt and 1 ready probe to launch a probe.`,
      );
    }
    if (!routePlan(originSystemId, anchorSystemId)) {
      throw new Error(
        `No travel plan from ${translateSystemId(originSystemId)} to ${translateSystemId(anchorSystemId)}.`,
      );
    }

    return {
      type: "deploy_probe",
      at,
      factionId: currentSeat.value.faction.id,
      originSystemId,
      anchorSystemId,
      reportDestinationSystemId: currentSeat.value.faction.homeSystemId,
    };
  }

  function nearestFriendlyOrigin(targetSystemId) {
    const candidates = probeOriginCandidates(targetSystemId);
    return candidates.find((candidate) => candidate.canAfford) ?? candidates[0] ?? null;
  }

  function recordPendingProbeOrder(originSystemId, anchorSystemId) {
    if (!currentSeat.value) {
      return;
    }

    const at = currentCommandDate();
    const plan = routePlan(originSystemId, anchorSystemId);
    if (!at || !plan) {
      return;
    }

    ui.pendingProbeOrders[anchorSystemId] = {
      factionId: currentSeat.value.faction.id,
      originSystemId,
      anchorSystemId,
      submittedAt: at,
      arrivalDate: addDays(at, plan.travelDays),
    };
  }

  async function submitScenarioCommand(command, successMessage, selectedSystemId, onSuccess) {
    api.error = "";
    api.tone = "info";
    api.status = "Transmitting order";
    api.submitting = true;

    try {
      const nextScenario = appendScenarioCommand(command);
      await simulateWorkingScenario(nextScenario);
      if (selectedSystemId) {
        ui.selectedSystemId = selectedSystemId;
      }
      onSuccess?.();
      api.tone = "success";
      api.status = successMessage;
    } catch (error) {
      api.tone = "error";
      api.status = "Order failed";
      api.error = error instanceof Error ? error.message : "Unable to transmit order.";
    } finally {
      api.submitting = false;
    }
  }

  async function submitImmediateProbe(targetSystemId) {
    if (!targetSystemId || !currentSeat.value) {
      return;
    }

    const probeStatus = probeStatusForSystem(targetSystemId);
    if (probeStatus.status === "in_transit" || probeStatus.status === "on_station") {
      api.tone = "info";
      api.status = probeStatus.label;
      return;
    }

    const origin = nearestFriendlyOrigin(targetSystemId);
    if (!origin) {
      api.tone = "error";
      api.status = "Probe unavailable";
      api.error = `No friendly system can reach ${translateSystemId(targetSystemId)}.`;
      return;
    }

    if (!origin.canAfford) {
      api.tone = "error";
      api.status = "Probe unavailable";
      api.error = `No friendly system with ${PROBE_COST_SALT} salt and a ready probe can currently launch reconnaissance to ${translateSystemId(targetSystemId)}.`;
      return;
    }

    const command = buildProbeCommand({
      originSystemId: origin.systemId,
      anchorSystemId: targetSystemId,
    });

    await submitScenarioCommand(
      command,
      `Probe en route to ${translateSystemId(targetSystemId)}`,
      targetSystemId,
      () => {
        recordPendingProbeOrder(origin.systemId, targetSystemId);
        ui.activeWorkspace = "probes";
      },
    );
  }

  async function submitActiveOrder() {
    if (!currentSeat.value) {
      return;
    }

    if (ui.activeAction === "deploy_probe") {
      const anchorSystemId = ui.orderDraft.anchorId ?? anchorOptions.value[0]?.value ?? null;
      if (!anchorSystemId) {
        api.tone = "error";
        api.status = "Probe unavailable";
        api.error = "Choose a probe target before submitting.";
        return;
      }

      const originSystemId = ui.orderDraft.probeOriginId ?? null;
      const command = buildProbeCommand({
        originSystemId,
        anchorSystemId,
      });
      await submitScenarioCommand(
        command,
        `Probe en route to ${translateSystemId(anchorSystemId)}`,
        anchorSystemId,
        () => {
          recordPendingProbeOrder(originSystemId, anchorSystemId);
          ui.activeWorkspace = "probes";
        },
      );
      return;
    }

    const mission =
      ui.activeAction === "attack"
        ? "attack"
        : ui.activeAction === "reinforce"
          ? "reinforce"
          : ui.activeAction === "blockade"
            ? "blockade"
          : ui.activeAction === "resupply"
            ? "resupply"
            : "trade";
    const command = buildFleetCommand(mission);
    await submitScenarioCommand(
      command,
      `${titleCase(ui.activeAction)} order transmitted`,
      activeFleetOriginSystemId.value ?? selectedSystem.value?.system.id ?? null,
    );
  }

  function selectSystem(systemId) {
    ui.selectedSystemId = systemId;
  }

  function setSelectedSystemId(systemId) {
    ui.selectedSystemId = systemId;
  }

  function setActiveAction(actionKey) {
    ui.activeAction = actionKey;
    ui.activeWorkspace = "map";
  }

  function setActiveWorkspace(workspaceKey) {
    ui.activeWorkspace = workspaceKey;
  }

  function prepareProbeForSystem(targetSystemId = selectedSystem.value?.system.id) {
    if (!targetSystemId || !currentSeat.value) {
      return;
    }

    const origin = nearestFriendlyOrigin(targetSystemId)?.systemId ?? currentSeat.value.faction.homeSystemId;
    api.error = "";
    api.tone = "info";
    api.status = `Probe draft ready for ${translateSystemId(targetSystemId)}`;
    ui.activeWorkspace = "map";
    ui.activeAction = "deploy_probe";
    ui.orderDraft.anchorId = targetSystemId;
    ui.orderDraft.probeOriginId = origin;
    selectSystem(targetSystemId);
  }

  function setProbeOriginSystemId(systemId) {
    ui.orderDraft.probeOriginId = systemId;
  }

  function actionLabel(actionKey = ui.activeAction) {
    return findActionDefinition(actionKey)?.label ?? titleCase(actionKey);
  }

  function missionForAction(actionKey = ui.activeAction) {
    switch (actionKey) {
      case "attack":
      case "reinforce":
      case "blockade":
      case "resupply":
      case "trade":
        return actionKey;
      default:
        return null;
    }
  }

  const actionUnderway = computed(() => {
    if (!currentSeat.value) {
      return {
        title: "No command seat selected",
        summary: "Choose a faction seat before drafting or reviewing operations.",
        items: [],
      };
    }

    if (ui.activeAction === "deploy_probe") {
      const anchorSystemId = ui.orderDraft.anchorId ?? selectedSystem.value?.system.id ?? null;
      if (!anchorSystemId) {
        return {
          title: "No probe target selected",
          summary: "Select a system to see whether reconnaissance is already assigned there.",
          items: [],
        };
      }

      const matchingItems = reconSummary.value.items
        .filter((item) => item.systemId === anchorSystemId)
        .map((item) => ({
          key: item.probeId,
          title: item.status === "on_station" ? "Probe on station" : "Probe already en route",
          detail:
            item.status === "on_station"
              ? `${translateSystemId(anchorSystemId)} already has live local intelligence.`
              : `${item.originSystemId ? translateSystemId(item.originSystemId) : "A friendly system"} already launched a probe here. ${item.statusLabel}.`,
        }));

      if (matchingItems.length === 0) {
        return {
          title: "No probe mission underway",
          summary: `No friendly probe is currently assigned to ${translateSystemId(anchorSystemId)}.`,
          items: [],
        };
      }

      return {
        title: matchingItems.length === 1 ? "1 probe mission already assigned" : `${matchingItems.length} probe missions already assigned`,
        summary: `Reconnaissance is already covering ${translateSystemId(anchorSystemId)} or on the way there.`,
        items: matchingItems,
      };
    }

    const originSystemId = activeFleetOriginSystemId.value;
    const mission = missionForAction();
    if (!originSystemId || !mission) {
      return {
        title: "No action context yet",
        summary: "Choose an origin system and action to review matching operations already underway.",
        items: [],
      };
    }

    const matchingFleets = fleetEntries.value
      .filter((fleet) => {
        if (fleet.factionId !== currentSeat.value.faction.id || fleet.mission !== mission) {
          return false;
        }

        if (ui.activeAction === "blockade") {
          return fleet.originSystemId === originSystemId;
        }

        return fleet.originSystemId === originSystemId && fleet.status === "transit";
      })
      .sort((left, right) =>
        String(left.arrivalDate ?? "").localeCompare(String(right.arrivalDate ?? ""))
        || String(left.destinationSystemId ?? "").localeCompare(String(right.destinationSystemId ?? ""))
        || left.fleetId.localeCompare(right.fleetId),
      );

    const items = matchingFleets.slice(0, 5).map((fleet) => {
      if (fleet.status === "stationed" && ui.activeAction === "blockade") {
        return {
          key: fleet.fleetId,
          title: `${fleet.ships} ships holding ${translateSystemId(fleet.currentSystemId ?? fleet.destinationSystemId ?? originSystemId)}`,
          detail: `This blockade force has already arrived and is screening connected starlanes.`,
        };
      }

      const etaDays = diffDays(currentWorldDate.value, fleet.arrivalDate);
      return {
        key: fleet.fleetId,
        title: `${fleet.ships} ships toward ${translateSystemId(fleet.destinationSystemId ?? "unknown")}`,
        detail: `Mission already underway${etaDays !== null ? `, ETA ${formatTravelSpan(etaDays)}` : ""}.`,
      };
    });

    if (matchingFleets.length === 0) {
      return {
        title: `No ${actionLabel().toLowerCase()} missions underway`,
        summary: `${translateSystemId(originSystemId)} is not currently executing this action.`,
        items: [],
      };
    }

    return {
      title: matchingFleets.length === 1 ? "1 mission already underway" : `${matchingFleets.length} missions already underway`,
      summary: `${translateSystemId(originSystemId)} already has matching ${actionLabel().toLowerCase()} orders in motion.`,
      items,
    };
  });

  const shipOperationRows = computed(() => {
    if (!currentSeat.value) {
      return [];
    }

    const focusMission = missionForAction();

    return fleetEntries.value
      .filter((fleet) =>
        fleet.factionId === currentSeat.value.faction.id
        && (
          fleet.status === "transit"
          || (fleet.mission === "blockade" && fleet.status === "stationed")
        ),
      )
      .map((fleet) => {
        const inTransit = fleet.status === "transit";
        const originSystemId = fleet.originSystemId ?? fleet.currentSystemId ?? null;
        const mapSystemId = inTransit
          ? fleet.destinationSystemId ?? originSystemId
          : fleet.currentSystemId ?? fleet.destinationSystemId ?? originSystemId;
        const etaDays = inTransit ? diffDays(currentWorldDate.value, fleet.arrivalDate) : null;
        const focus = focusMission !== null && fleet.mission === focusMission;
        const missionLabel = titleCase(fleet.mission);
        const locationName = translateSystemId(mapSystemId ?? "unknown");
        const originName = translateSystemId(originSystemId ?? "unknown");

        return {
          fleetId: fleet.fleetId,
          mission: fleet.mission,
          missionLabel,
          status: inTransit ? "transit" : "on_station",
          statusLabel: inTransit
            ? etaDays !== null
              ? `Arrives in ${formatTravelSpan(etaDays)}`
              : "En route"
            : "On station",
          ships: fleet.ships,
          originSystemId,
          originName,
          destinationSystemId: fleet.destinationSystemId ?? null,
          destinationName: fleet.destinationSystemId ? translateSystemId(fleet.destinationSystemId) : null,
          mapSystemId,
          title: inTransit
            ? `${fleet.ships} ships toward ${locationName}`
            : `${fleet.ships} ships holding ${locationName}`,
          detail: inTransit
            ? `${originName} launched this ${fleet.mission} mission toward ${locationName}. ${formatTransitCargo(fleet.cargoSalt, fleet.metals, false)}`
            : `${locationName} is under active blockade coverage from this force. ${formatTransitCargo(fleet.cargoSalt, fleet.metals, false)}`,
          focus,
        };
      })
      .sort((left, right) =>
        Number(right.focus) - Number(left.focus)
        || Number(left.status !== "transit") - Number(right.status !== "transit")
        || right.ships - left.ships
        || left.title.localeCompare(right.title),
      );
  });

  const shipOperationSummary = computed(() => {
    const rows = shipOperationRows.value;
    const byMission = ORDER_ACTIONS
      .filter((action) => action.key !== "deploy_probe")
      .map((action) => ({
        mission: action.key,
        label: action.label,
        count: rows.filter((row) => row.mission === action.key).length,
      }));

    return {
      total: rows.length,
      inTransit: rows.filter((row) => row.status === "transit").length,
      blockades: rows.filter((row) => row.mission === "blockade").length,
      focusMission: missionForAction(),
      focusLabel: actionLabel(),
      focusCount:
        missionForAction() === null
          ? 0
          : rows.filter((row) => row.mission === missionForAction()).length,
      byMission,
    };
  });

  const shipOperationOriginRows = computed(() => {
    const grouped = new Map();

    for (const row of shipOperationRows.value) {
      const systemId = row.originSystemId ?? row.mapSystemId;
      if (!systemId) {
        continue;
      }

      const current = grouped.get(systemId) ?? {
        systemId,
        systemName: translateSystemId(systemId),
        total: 0,
        focusCount: 0,
        transitCount: 0,
      };
      current.total += 1;
      current.focusCount += row.focus ? 1 : 0;
      current.transitCount += row.status === "transit" ? 1 : 0;
      grouped.set(systemId, current);
    }

    return [...grouped.values()].sort((left, right) =>
      right.focusCount - left.focusCount
      || right.total - left.total
      || left.systemName.localeCompare(right.systemName),
    );
  });

  const diplomacyRows = computed(() => {
    if (!currentSeat.value || !world.scenario || !latestSnapshot.value) {
      return [];
    }

    const seatFactionId = currentSeat.value.faction.id;
    const seatOwnedSystemIds = new Set(ownedSystems.value.map((system) => system.id));
    const recentSignalsByFaction = new Map();

    const noteSignal = (factionId, kind, date, summary) => {
      if (!factionId || factionId === seatFactionId) {
        return;
      }

      const current = recentSignalsByFaction.get(factionId) ?? {
        hostileSignals: 0,
        battleSignals: 0,
        expansionSignals: 0,
        latestDate: "",
        latestSummary: "",
      };

      if (kind === "hostile") {
        current.hostileSignals += 1;
      } else if (kind === "battle") {
        current.battleSignals += 1;
      } else if (kind === "expansion") {
        current.expansionSignals += 1;
      }

      if (date >= current.latestDate) {
        current.latestDate = date;
        current.latestSummary = summary;
      }

      recentSignalsByFaction.set(factionId, current);
    };

    for (const line of world.result?.log ?? []) {
      const parsed = parseLogEntry(line);
      if (!parsed) {
        continue;
      }

      const launchMatch = parsed.detail.match(/^(\w+) launched (\S+) from (\S+) to (\S+)$/u);
      if (launchMatch) {
        const [, factionId, , , destinationSystemId] = launchMatch;
        if (seatOwnedSystemIds.has(destinationSystemId)) {
          noteSignal(
            factionId,
            "hostile",
            parsed.date,
            `${translateFactionId(factionId)} launched ships toward ${translateSystemId(destinationSystemId)}.`,
          );
        }
        continue;
      }

      const combatMatch = parsed.detail.match(/^combat at (\S+); attacker (\w+) lost (\d+), defender (\w+) lost (\d+)$/u);
      if (combatMatch) {
        const [, systemId, attackerFactionId, , defenderFactionId] = combatMatch;
        if (attackerFactionId === seatFactionId && defenderFactionId !== seatFactionId) {
          noteSignal(
            defenderFactionId,
            "battle",
            parsed.date,
            `Recent fighting with ${translateFactionId(defenderFactionId)} at ${translateSystemId(systemId)}.`,
          );
        } else if (defenderFactionId === seatFactionId && attackerFactionId !== seatFactionId) {
          noteSignal(
            attackerFactionId,
            "battle",
            parsed.date,
            `Recent fighting with ${translateFactionId(attackerFactionId)} at ${translateSystemId(systemId)}.`,
          );
        }
        continue;
      }

      const captureMatch = parsed.detail.match(/^(\w+) captured (\S+)$/u);
      if (captureMatch) {
        const [, factionId, systemId] = captureMatch;
        if (seatOwnedSystemIds.has(systemId) || systemId === currentSeat.value.faction.homeSystemId) {
          noteSignal(
            factionId,
            "hostile",
            parsed.date,
            `${translateFactionId(factionId)} captured ${translateSystemId(systemId)}.`,
          );
        }
        continue;
      }

      const claimMatch = parsed.detail.match(/^(\w+) claimed open system (\S+)$/u);
      if (claimMatch) {
        const [, factionId, systemId] = claimMatch;
        noteSignal(
          factionId,
          "expansion",
          parsed.date,
          `${translateFactionId(factionId)} expanded into ${translateSystemId(systemId)}.`,
        );
      }
    }

    const ownedSystemsByFactionId = new Map();
    for (const system of world.scenario.systems) {
      const ownerId = snapshotSystem(system.id)?.ownerId;
      if (!ownerId) {
        continue;
      }
      const current = ownedSystemsByFactionId.get(ownerId) ?? [];
      current.push(system);
      ownedSystemsByFactionId.set(ownerId, current);
    }

    const stanceRank = {
      hostile: 0,
      tense: 1,
      watchful: 2,
      distant: 3,
    };

    return world.scenario.factions
      .filter((faction) => faction.id !== seatFactionId)
      .map((faction) => {
        const factionSnapshot = latestSnapshot.value?.factions?.[faction.id];
        const factionOwnedSystems = ownedSystemsByFactionId.get(faction.id) ?? [];
        const factionOwnedIds = new Set(factionOwnedSystems.map((system) => system.id));
        const hostileInbound = fleetEntries.value.filter((fleet) =>
          fleet.factionId === faction.id
          && fleet.status === "transit"
          && seatOwnedSystemIds.has(fleet.destinationSystemId),
        ).length;
        const activeTransit = fleetEntries.value.filter((fleet) =>
          fleet.factionId === faction.id
          && fleet.status === "transit",
        ).length;
        const frontierSystems = factionOwnedSystems.filter((system) =>
          (system.starlaneLinks ?? []).some((neighborId) => seatOwnedSystemIds.has(neighborId)),
        );
        const hostileBlockades = fleetEntries.value.filter((fleet) => {
          if (fleet.factionId !== faction.id || fleet.mission !== "blockade") {
            return false;
          }

          const blockadeSystemId = fleet.currentSystemId ?? fleet.destinationSystemId ?? null;
          if (!blockadeSystemId) {
            return false;
          }

          if (seatOwnedSystemIds.has(blockadeSystemId)) {
            return true;
          }

          return (systemsMap.value.get(blockadeSystemId)?.starlaneLinks ?? []).some((neighborId) =>
            seatOwnedSystemIds.has(neighborId),
          );
        }).length;

        let nearestApproachDays = null;
        for (const enemySystem of factionOwnedSystems) {
          for (const friendlySystem of ownedSystems.value) {
            const plan = routePlan(enemySystem.id, friendlySystem.id);
            if (!plan) {
              continue;
            }

            if (nearestApproachDays === null || plan.travelDays < nearestApproachDays) {
              nearestApproachDays = plan.travelDays;
            }
          }
        }

        const signals = recentSignalsByFaction.get(faction.id) ?? {
          hostileSignals: 0,
          battleSignals: 0,
          expansionSignals: 0,
          latestDate: "",
          latestSummary: "",
        };

        let stanceKey = "distant";
        let stanceLabel = "Distant";
        let stanceSeverity = "info";
        let stanceSummary = "No nearby pressure or direct incidents are visible from the current map and reports.";

        if (hostileInbound > 0 || hostileBlockades > 0 || signals.hostileSignals > 0 || signals.battleSignals > 0) {
          stanceKey = "hostile";
          stanceLabel = "Hostile";
          stanceSeverity = "danger";
          if (hostileInbound > 0) {
            stanceSummary = `${translateFactionId(faction.id)} already has ${formatCountLabel(hostileInbound, "fleet")} moving toward our holdings.`;
          } else if (hostileBlockades > 0) {
            stanceSummary = `${translateFactionId(faction.id)} is pressuring our frontier with ${formatCountLabel(hostileBlockades, "blockade position")}.`;
          } else {
            stanceSummary = `Recent battle reports indicate active hostilities with ${translateFactionId(faction.id)}.`;
          }
        } else if (frontierSystems.length > 0 || (nearestApproachDays !== null && nearestApproachDays <= 3)) {
          stanceKey = "tense";
          stanceLabel = "Tense";
          stanceSeverity = "warn";
          if (frontierSystems.length > 0) {
            stanceSummary = `${translateFactionId(faction.id)} shares ${formatCountLabel(frontierSystems.length, "border system")} with our current holdings.`;
          } else {
            stanceSummary = `${translateFactionId(faction.id)} can reach our territory in about ${formatTravelSpan(nearestApproachDays)}.`;
          }
        } else if (nearestApproachDays !== null && nearestApproachDays <= 6) {
          stanceKey = "watchful";
          stanceLabel = "Watchful";
          stanceSeverity = "secondary";
          stanceSummary = `No direct attack is underway, but ${translateFactionId(faction.id)} sits within ${formatTravelSpan(nearestApproachDays)} of our frontier.`;
        }

        return {
          factionId: faction.id,
          factionName: faction.name,
          homeSystemId: faction.homeSystemId,
          homeSystemName: translateSystemId(faction.homeSystemId),
          stanceKey,
          stanceLabel,
          stanceSeverity,
          stanceSummary,
          latestSignalDate: signals.latestDate,
          latestSignalText: signals.latestSummary || "No direct diplomatic signal has reached the board yet.",
          ownedSystems: factionSnapshot?.ownedSystems ?? factionOwnedSystems.length,
          totalShips: factionSnapshot?.totalShips ?? 0,
          totalSalt: factionSnapshot?.totalSaltStockpile ?? 0,
          activeTransit,
          hostileInbound,
          hostileBlockades,
          frontierCount: frontierSystems.length,
          nearestApproachDays,
          strengthText: `${formatCountLabel(factionSnapshot?.ownedSystems ?? factionOwnedSystems.length, "system")} · ${formatCountLabel(factionSnapshot?.totalShips ?? 0, "ship")}`,
          pressureText:
            hostileInbound > 0
              ? `${formatCountLabel(hostileInbound, "fleet")} inbound · ${formatCountLabel(activeTransit, "fleet")} in transit total`
              : hostileBlockades > 0
                ? `${formatCountLabel(hostileBlockades, "blockade")} near our frontier · ${formatCountLabel(activeTransit, "fleet")} in transit total`
                : nearestApproachDays !== null
                  ? `Nearest approach ${formatTravelSpan(nearestApproachDays)} · ${formatCountLabel(activeTransit, "fleet")} in transit`
                  : `${formatCountLabel(activeTransit, "fleet")} in transit`,
        };
      })
      .sort((left, right) =>
        stanceRank[left.stanceKey] - stanceRank[right.stanceKey]
        || right.hostileInbound - left.hostileInbound
        || right.frontierCount - left.frontierCount
        || right.totalShips - left.totalShips
        || left.factionName.localeCompare(right.factionName),
      );
  });

  const diplomacySummary = computed(() => ({
    total: diplomacyRows.value.length,
    hostile: diplomacyRows.value.filter((row) => row.stanceKey === "hostile").length,
    tense: diplomacyRows.value.filter((row) => row.stanceKey === "tense").length,
    watchful: diplomacyRows.value.filter((row) => row.stanceKey === "watchful").length,
    distant: diplomacyRows.value.filter((row) => row.stanceKey === "distant").length,
    strongestThreat: diplomacyRows.value[0] ?? null,
  }));

  const advisorBriefs = computed(() => {
    if (!currentSeat.value || !world.scenario) {
      return [];
    }

    const expandTarget =
      strategicMarkingRows.value.find((row) => row.value === "expand")
      ?? strategicMarkingRows.value.find((row) => row.value === "explore")
      ?? null;
    const threatTarget = strategicMarkingRows.value.find((row) => row.value === "threat") ?? null;
    const screenTarget = strategicMarkingRows.value.find((row) => row.value === "screen") ?? null;
    const economicTarget = strategicMarkingRows.value.find((row) => row.value === "economic_priority") ?? null;
    const futureLinkTarget = strategicMarkingRows.value.find((row) => row.value === "future_link") ?? null;
    const strongestThreat = diplomacySummary.value.strongestThreat;

    const briefs = [];

    if (threatTarget || strongestThreat?.stanceKey === "hostile") {
      const threatName = threatTarget?.systemName ?? strongestThreat?.factionName ?? "the frontier";
      briefs.push({
        advisorId: "marshal",
        advisorName: "Marshal Ilyan",
        role: "Campaigns",
        severity: threatTarget ? "danger" : "warn",
        headline: threatTarget
          ? `${threatName} can pin us if we strip the frontier`
          : `${threatName} is already setting the tempo`,
        summary: threatTarget
          ? `You marked ${threatName} as a threat. Keep a reserve or a screen in place before sending the last good ships elsewhere.`
          : `${strongestThreat.factionName} is the sharpest immediate military concern on the board.`,
        reasoning: threatTarget
          ? "This is the sort of pressure point that turns one blocked lane or one delayed reinforcement into a losing battle."
          : "If they force us to react everywhere at once, they win before the fleet action starts.",
      });
    } else if (expandTarget) {
      briefs.push({
        advisorId: "marshal",
        advisorName: "Marshal Ilyan",
        role: "Campaigns",
        severity: "warn",
        headline: `Take ${expandTarget.systemName}, but do not go naked`,
        summary: `If ${expandTarget.systemName} is the next claim, hold enough ships at home to answer a sudden burn or blockade.`,
        reasoning: "Expansion wins openings, but overextension is how one pinned fleet becomes a story about avoidable defeat.",
      });
    }

    if (expandTarget || threatTarget || screenTarget) {
      const probeSystem = threatTarget ?? expandTarget ?? screenTarget;
      const probeStatus = probeSystem ? probeStatusForSystem(probeSystem.systemId) : null;
      briefs.push({
        advisorId: "spymaster",
        advisorName: "Spymaster Vey",
        role: "Reconnaissance",
        severity:
          probeStatus?.status === "on_station" || probeStatus?.status === "friendly_control"
            ? "success"
            : "info",
        headline:
          probeStatus?.status === "on_station" || probeStatus?.status === "friendly_control"
            ? `${probeSystem.systemName} is no longer a blind corner`
            : `Probe ${probeSystem.systemName} before you trust the picture`,
        summary:
          probeStatus?.status === "on_station" || probeStatus?.status === "friendly_control"
            ? `We already have direct local visibility at ${probeSystem.systemName}. Use that certainty before it goes stale.`
            : `${probeSystem.systemName} matters enough to mark. That is exactly when we should pay to narrow uncertainty, not after a rival commits.`,
        reasoning:
          probeStatus?.status === "on_station" || probeStatus?.status === "friendly_control"
            ? "When our probe net is in place, we stop guessing which approach the enemy actually chose."
            : "Without a probe, one enemy burn can force us to defend several plausible destinations and waste the opening.",
      });
    }

    if (economicTarget || expandTarget || futureLinkTarget) {
      const target = economicTarget ?? expandTarget ?? futureLinkTarget;
      briefs.push({
        advisorId: "steward",
        advisorName: "Steward Sen",
        role: "Logistics",
        severity: economicTarget ? "secondary" : "success",
        headline: `${target.systemName} compounds if we support it early`,
        summary:
          target.value === "future_link"
            ? `${target.systemName} is a good outward hinge, but only if we build the stockpile and courier habit to sustain it later.`
            : `${target.systemName} is marked as a priority. Salt, metals, and shipping discipline here will matter more than one dramatic fleet launch.`,
        reasoning:
          target.value === "expand"
            ? "A good second system pays us back every day. Missing that window costs more than one lost skirmish."
            : "Strong logistics turns markings into plans instead of hopeful annotations.",
      });
    }

    if (strongestThreat) {
      briefs.push({
        advisorId: "envoy",
        advisorName: "Envoy Tal",
        role: "Signals",
        severity:
          strongestThreat.stanceKey === "hostile"
            ? "warn"
            : strongestThreat.stanceKey === "tense"
              ? "secondary"
              : "info",
        headline:
          strongestThreat.stanceKey === "hostile"
            ? `Send a hard pigeon to ${strongestThreat.factionName}`
            : `Probe the intent behind ${strongestThreat.factionName}`,
        summary:
          strongestThreat.stanceKey === "hostile"
            ? `A diplomatic pigeon will not stop a fleet, but the reply may tell us whether they want tribute, delay, or fear.`
            : `${strongestThreat.factionName} is close enough that silence is also a signal. A message can expose doctrine, nerves, or opportunism.`,
        reasoning: "Diplomacy in this game is partly intelligence gathering. What they say matters, but how quickly and how sharply they answer matters too.",
      });
    }

    return briefs.slice(0, 4);
  });

  const dailyBrief = computed(() => {
    if (!currentSeat.value || !world.scenario) {
      return null;
    }

    const expandTarget =
      strategicMarkingRows.value.find((row) => row.value === "expand")
      ?? strategicMarkingRows.value.find((row) => row.value === "economic_priority")
      ?? strategicMarkingRows.value.find((row) => row.value === "future_link")
      ?? strategicMarkingRows.value.find((row) => row.value === "explore")
      ?? null;
    const threatTarget = strategicMarkingRows.value.find((row) => row.value === "threat") ?? null;
    const screenTarget = strategicMarkingRows.value.find((row) => row.value === "screen") ?? null;
    const strongestThreat = diplomacySummary.value.strongestThreat;
    const actionableProbeDepot = probeCommandRows.value.find((row) => row.launchCapable) ?? null;
    const lessonSource =
      feedItems.value.find((item) =>
        item.kicker === "Battle report"
        || item.kicker === "Incoming threat"
        || item.kicker === "Blockade burn"
        || item.kicker === "Control shift"
        || item.kicker === "Recon on station",
      )
      ?? feedItems.value[0]
      ?? null;

    let opportunity = {
      key: "opportunity",
      label: "Opportunity",
      severity: "info",
      title: "Build the next edge deliberately",
      summary: "Use reconnaissance, trade, and the frontier to create the next decision before a rival creates one for you.",
      source: "General command guidance",
      advisorId: "steward",
      advisorName: advisorProfile("steward").advisorName,
      advisorRole: advisorProfile("steward").role,
    };

    if (expandTarget) {
      const probeStatus = probeStatusForSystem(expandTarget.systemId);
      opportunity = {
        key: "opportunity",
        label: "Opportunity",
        severity: expandTarget.value === "expand" ? "success" : "secondary",
        title:
          expandTarget.value === "expand"
            ? `${expandTarget.systemName} is the clearest growth window`
            : `${expandTarget.systemName} is worth shaping early`,
        summary:
          probeStatus.status === "on_station" || probeStatus.status === "friendly_control"
            ? `${expandTarget.detail} We already have the local picture, so timing now matters more than certainty.`
            : `${expandTarget.detail} A probe there would collapse uncertainty before the claim or convoy commits.`,
        source: "Strategy board",
        advisorId: expandTarget.value === "explore" ? "spymaster" : "steward",
        advisorName: advisorProfile(expandTarget.value === "explore" ? "spymaster" : "steward").advisorName,
        advisorRole: advisorProfile(expandTarget.value === "explore" ? "spymaster" : "steward").role,
      };
    } else if (actionableProbeDepot) {
      opportunity = {
        key: "opportunity",
        label: "Opportunity",
        severity: "info",
        title: `${actionableProbeDepot.systemName} can widen the picture today`,
        summary: `${actionableProbeDepot.readyProbes} ready probes and ${formatNumber(actionableProbeDepot.saltStockpile)} salt are waiting there. Turn spare stores into warning time.`,
        source: "Probe net",
        advisorId: "spymaster",
        advisorName: advisorProfile("spymaster").advisorName,
        advisorRole: advisorProfile("spymaster").role,
      };
    }

    let threat = {
      key: "threat",
      label: "Threat",
      severity: "warn",
      title: "The board is quiet, but not safe",
      summary: "Use the diplomacy table and probe coverage to decide where silence is genuine and where it hides a commitment in transit.",
      source: "Situation estimate",
      advisorId: "envoy",
      advisorName: advisorProfile("envoy").advisorName,
      advisorRole: advisorProfile("envoy").role,
    };

    if (threatTarget) {
      threat = {
        key: "threat",
        label: "Threat",
        severity: "danger",
        title: `${threatTarget.systemName} is the pressure point`,
        summary: `${threatTarget.detail} If we strip the wrong reserve, this is where a pin, blockade, or surprise arrival will punish us.`,
        source: "Strategy board",
        advisorId: "marshal",
        advisorName: advisorProfile("marshal").advisorName,
        advisorRole: advisorProfile("marshal").role,
      };
    } else if (strongestThreat) {
      threat = {
        key: "threat",
        label: "Threat",
        severity: strongestThreat.stanceSeverity,
        title: `${strongestThreat.factionName} is setting the current risk`,
        summary: `${strongestThreat.stanceSummary} ${strongestThreat.latestSignalText}`,
        source: "Diplomacy board",
        advisorId: "envoy",
        advisorName: advisorProfile("envoy").advisorName,
        advisorRole: advisorProfile("envoy").role,
      };
    } else if (screenTarget) {
      threat = {
        key: "threat",
        label: "Threat",
        severity: "warn",
        title: `${screenTarget.systemName} could blindside the lane`,
        summary: `${screenTarget.detail} If that screen point goes unwatched, we give away reaction time for free.`,
        source: "Strategy board",
        advisorId: "marshal",
        advisorName: advisorProfile("marshal").advisorName,
        advisorRole: advisorProfile("marshal").role,
      };
    }

    let lesson = {
      key: "lesson",
      label: "Lesson",
      severity: "secondary",
      title: "Interpretation wins more than volume",
      summary: "The point of the daily queue is not to read everything. It is to notice which piece of information changes the plan.",
      source: "Command doctrine",
      advisorId: "envoy",
      advisorName: advisorProfile("envoy").advisorName,
      advisorRole: advisorProfile("envoy").role,
    };

    if (lessonSource) {
      const lessonAdvisor = advisorProfileForReport(lessonSource);
      lesson = {
        key: "lesson",
        label: "Lesson",
        severity: lessonSource.tone === "danger" ? "warn" : lessonSource.tone,
        title: `Lesson from ${lessonSource.kicker.toLowerCase()}`,
        summary: lessonSource.analysis,
        source: lessonSource.title,
        advisorId: lessonAdvisor.advisorId,
        advisorName: lessonAdvisor.advisorName,
        advisorRole: lessonAdvisor.role,
      };
    } else if (advisorBriefs.value.length > 0) {
      const advisor = advisorBriefs.value[0];
      lesson = {
        key: "lesson",
        label: "Lesson",
        severity: advisor.severity === "danger" ? "warn" : advisor.severity,
        title: `${advisor.advisorName} is teaching a bias`,
        summary: advisor.reasoning,
        source: advisor.role,
        advisorId: advisor.advisorId,
        advisorName: advisor.advisorName,
        advisorRole: advisor.role,
      };
    }

    return {
      date: currentWorldDate.value ?? world.scenario.startDate,
      items: [opportunity, threat, lesson],
    };
  });

  function archiveReportItem(item) {
    if (!item?.id) {
      return;
    }

    const archivedItem = cloneReportItem(item);
    const nextFollowUps = { ...ui.planner.followUpReportsById };
    delete nextFollowUps[item.id];

    ui.planner.archivedReportsById = {
      ...ui.planner.archivedReportsById,
      [item.id]: archivedItem,
    };
    ui.planner.followUpReportsById = nextFollowUps;
    api.error = "";
    api.tone = "success";
    api.status = "Report archived";
  }

  function markReportForFollowUp(item) {
    if (!item?.id) {
      return;
    }

    const followUpItem = cloneReportItem(item);
    const nextArchive = { ...ui.planner.archivedReportsById };
    delete nextArchive[item.id];

    ui.planner.archivedReportsById = nextArchive;
    ui.planner.followUpReportsById = {
      ...ui.planner.followUpReportsById,
      [item.id]: followUpItem,
    };
    api.error = "";
    api.tone = "success";
    api.status = "Follow-up added to notebook";
  }

  function restoreReportToInbox(reportId) {
    if (!reportId) {
      return;
    }

    const nextArchive = { ...ui.planner.archivedReportsById };
    const nextFollowUps = { ...ui.planner.followUpReportsById };
    delete nextArchive[reportId];
    delete nextFollowUps[reportId];
    ui.planner.archivedReportsById = nextArchive;
    ui.planner.followUpReportsById = nextFollowUps;
    api.error = "";
    api.tone = "info";
    api.status = "Report returned to queue";
  }

  function updateProductionPlan(systemId, patch) {
    const current = ui.planner.productionBySystemId[systemId] ?? defaultProductionPlan();
    ui.planner.productionBySystemId = {
      ...ui.planner.productionBySystemId,
      [systemId]: {
        ...current,
        ...patch,
      },
    };
  }

  function updateProductionLine(systemId, lineId, patch) {
    const current = ui.planner.productionBySystemId[systemId] ?? defaultProductionPlan();
    const system = systemsMap.value.get(systemId);
    const shipyardCount = inferShipyardCount(system);
    const lines = normalizeProductionLines(
      current.lines,
      shipyardCount,
      current.focus ?? "ships",
      current.quantity ?? 1,
    );
    const nextLines = lines.map((line) =>
      line.id === lineId
        ? {
          ...line,
          ...patch,
          quantity: normalizeProductionQuantity(
            patch.focus ?? line.focus,
            patch.quantity ?? line.quantity,
          ),
        }
        : line,
    );
    updateProductionPlan(systemId, {
      focus: nextLines[0]?.focus ?? current.focus ?? "ships",
      quantity: nextLines[0]?.quantity ?? current.quantity ?? 1,
      lines: nextLines,
    });
  }

  function setProductionFocus(systemId, focus) {
    updateProductionLine(systemId, "yard_1", { focus });
  }

  function setProductionQuantity(systemId, quantity) {
    updateProductionLine(systemId, "yard_1", {
      quantity: Math.max(1, Number(quantity || 1)),
    });
  }

  function setProductionPosture(systemId, posture) {
    updateProductionPlan(systemId, { posture });
  }

  function setProductionLineFocus(systemId, lineId, focus) {
    updateProductionLine(systemId, lineId, { focus });
  }

  function setProductionLineQuantity(systemId, lineId, quantity) {
    updateProductionLine(systemId, lineId, {
      quantity: Number(quantity ?? 0),
    });
  }

  function setStrategicMarking(systemId, value) {
    if (!systemId) {
      return;
    }

    const definition = strategicMarkingDefinition(value);
    if (!definition) {
      clearStrategicMarking(systemId);
      return;
    }

    ui.planner.strategicMarkingsBySystemId = {
      ...ui.planner.strategicMarkingsBySystemId,
      [systemId]: {
        value: definition.value,
        updatedAt: currentWorldDate.value ?? world.scenario?.startDate ?? "",
      },
    };
    api.status = `${translateSystemId(systemId)} marked ${definition.label.toLowerCase()}`;
    api.tone = definition.severity === "danger" ? "warn" : definition.severity;
    api.error = "";
  }

  function clearStrategicMarking(systemId) {
    if (!systemId || !ui.planner.strategicMarkingsBySystemId?.[systemId]) {
      return;
    }

    const next = { ...ui.planner.strategicMarkingsBySystemId };
    delete next[systemId];
    ui.planner.strategicMarkingsBySystemId = next;
    api.status = `${translateSystemId(systemId)} cleared`;
    api.tone = "success";
    api.error = "";
  }

  function setSpeculationText(value) {
    ui.planner.speculation = value ?? "";
  }

  return {
    ORDER_ACTIONS,
    WORKSPACE_VIEWS,
    PRODUCTION_FOCUS_OPTIONS,
    PRODUCTION_LINE_FOCUS_OPTIONS,
    PRODUCTION_POSTURE_OPTIONS,
    STRATEGIC_MARKING_OPTIONS,
    api,
    testHarness,
    world,
    ui,
    currentSeat,
    currentSeatHomeSystem,
    currentWorldDate,
    latestSnapshot,
    selectedSystem,
    selectedSystemFriendly,
    selectedSystemOverview,
    selectedSystemProbeStatus,
    ownedSystems,
    productionPlannerRows,
    selectedSystemMarking,
    strategicMarkingRows,
    strategyBoardSummary,
    advisorBriefs,
    dailyBrief,
    probeCommandRows,
    shipOperationRows,
    shipOperationSummary,
    shipOperationOriginRows,
    diplomacyRows,
    diplomacySummary,
    originOptions,
    destinationOptions,
    anchorOptions,
    probeOriginOptions,
    summaryCards,
    mapLayout,
    mapCanvas,
    fleetMarkers,
    probeMarkers,
    feedItems,
    archivedReportItems,
    notebookTodoItems,
    reconSummary,
    orderBrief,
    orderSubmission,
    actionUnderway,
    fleetEntries,
    probeEntries,
    snapshotSystem,
    inboundFleets,
    totalShipsAtSystem,
    routePlan,
    starlaneSegments,
    blockadeStatus,
    probeBadgeForSystem,
    homeBadgeForSystem,
    systemTone,
    starClass,
    translateSystemId,
    loadInitialData,
    loadScenario,
    selectSystem,
    setSelectedSystemId,
    setActiveAction,
    setActiveWorkspace,
    prepareProbeForSystem,
    setProbeOriginSystemId,
    archiveReportItem,
    markReportForFollowUp,
    restoreReportToInbox,
    setProductionFocus,
    setProductionQuantity,
    setProductionPosture,
    setProductionLineFocus,
    setProductionLineQuantity,
    setStrategicMarking,
    clearStrategicMarking,
    setSpeculationText,
    submitImmediateProbe,
    submitActiveOrder,
  };
}
