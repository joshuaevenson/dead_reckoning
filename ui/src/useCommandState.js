import { computed, reactive, toRaw, watch } from "vue";

const SHIP_MASS = 5;
const PROBE_COST_SALT = 2;
const DIRECT_TIME_MULTIPLIER = 1;
const DIRECT_SALT_MULTIPLIER = 1;
const STARLANE_TIME_MULTIPLIER = 0.7;
const STARLANE_SALT_MULTIPLIER = 0.8;
const STAR_OUTPUT = {
  red_dwarf: 2,
  yellow_star: 4,
  white_blue_star: 7,
  giant_or_exotic: 10,
};
const SALT_PROFILE_OUTPUT = {
  none: 0,
  trace: 1,
  productive: 3,
  major: 6,
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
  { key: "blockade", label: "Blockade", icon: "pi pi-ban" },
  { key: "resupply", label: "Resupply", icon: "pi pi-box" },
  { key: "deploy_probe", label: "Deploy Probe", icon: "pi pi-search" },
  { key: "trade", label: "Trade", icon: "pi pi-sync" },
];
const PRODUCTION_FOCUS_OPTIONS = [
  { label: "Build Ships", value: "ships" },
  { label: "Build Defenses", value: "defenses" },
  { label: "Build Probes", value: "probes" },
  { label: "Bank Salt", value: "bank_salt" },
  { label: "Bank Metals", value: "bank_metals" },
];
const PRODUCTION_POSTURE_OPTIONS = [
  { label: "Balanced", value: "balanced" },
  { label: "Frontier", value: "frontier" },
  { label: "Siege Prep", value: "siege" },
  { label: "Emergency", value: "emergency" },
];

function defaultProductionPlan() {
  return {
    focus: "ships",
    quantity: 1,
    posture: "balanced",
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

function saltOutputForSystem(system) {
  if (system?.saltProfile && system.saltProfile in SALT_PROFILE_OUTPUT) {
    return SALT_PROFILE_OUTPUT[system.saltProfile];
  }

  return STAR_OUTPUT[system?.starType] ?? 0;
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
    activeAction: "attack",
    pendingProbeOrders: {},
    plannerLoadedKey: null,
    planner: {
      speculation: "",
      productionBySystemId: {},
    },
    orderDraft: {
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

  function fleetsAtSystem(systemId) {
    return fleetEntries.value.filter((fleet) => fleet.currentSystemId === systemId);
  }

  function inboundFleets(systemId) {
    return fleetEntries.value.filter(
      (fleet) => !fleet.currentSystemId && fleet.destinationSystemId === systemId,
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
    return ships * SHIP_MASS + cargoSalt + metals;
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

  const productionPlannerRows = computed(() =>
    ownedSystems.value.map((system) => {
      const snapshot = snapshotSystem(system.id);
      const storedPlan = ui.planner.productionBySystemId[system.id] ?? defaultProductionPlan();
      return {
        systemId: system.id,
        systemName: system.name,
        focus: storedPlan.focus ?? "ships",
        quantity: storedPlan.quantity ?? 1,
        posture: storedPlan.posture ?? "balanced",
        outputText: `${saltOutputForSystem(system)} salt + ${METAL_OUTPUT[system.metalRichness]} metal / year`,
        storesText: snapshot
          ? `${formatNumber(snapshot.saltStockpile)} salt · ${formatNumber(snapshot.metalStockpile)} metal · ${formatNumber(snapshot.probeStockpile ?? 0)} probes`
          : "No current stores",
      };
    }),
  );

  const destinationOptions = computed(() => {
    if (!selectedSystem.value || !world.scenario) {
      return [];
    }

    return world.scenario.systems
      .filter(
        (system) =>
          system.id !== selectedSystem.value.system.id,
      )
      .map((system) => ({ label: system.name, value: system.id }));
  });

  const anchorOptions = computed(() => {
    if (!selectedSystem.value) {
      return [];
    }

    return (world.scenario?.systems ?? [])
      .filter(
        (system) =>
          system.id !== selectedSystem.value.system.id,
      )
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
        label: `${fleet.ships}`,
        detail: `${factionName} ${formatMissionNarrative(fleet.mission)} toward ${destinationName}, ETA ${formatTravelSpan(marker.etaDays)}.`,
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
        ? `1 pigeon from ${translateSystemId(homeSystemId)} to ${selectedSystem.value.system.name} (${formatTravelSpan(relayPlan.travelDays)}, 1 salt).`
        : `1 pigeon from ${translateSystemId(homeSystemId)} to ${selectedSystem.value.system.name} (route unresolved).`,
    };
  });

  const feedItems = computed(() => {
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
        const plan = routePlan(launchMatch[3], launchMatch[4]);
        const launchClassification = classifyLaunch(
          launchMatch[1],
          launchMatch[4],
          fleet?.mission ?? null,
          parsed.date,
        );
        item = {
          date: parsed.date,
          kicker: launchClassification.kicker,
          title: `${translateFactionId(launchMatch[1])} launched ${fleet?.ships ?? "?"} ships toward ${translateSystemId(launchMatch[4])}`,
          summary: `${translateFactionId(launchMatch[1])} departed ${translateSystemId(launchMatch[3])} for ${translateSystemId(launchMatch[4])}. Expected arrival in ${formatTravelSpan(plan?.travelDays ?? 0)}.`,
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
        const watchesSeat = relevantSystemIds.has(probeLaunchMatch[4]);
        item = {
          date: parsed.date,
          kicker: seatLaunch ? "Recon launched" : "Foreign recon",
          title: `${translateFactionId(probeLaunchMatch[1])} dispatched a probe toward ${translateSystemId(probeLaunchMatch[4])}`,
          summary: `${translateSystemId(probeLaunchMatch[3])} launched a probe toward ${translateSystemId(probeLaunchMatch[4])}. Expected arrival in ${formatTravelSpan(plan?.travelDays ?? 0)}.`,
          analysis: seatLaunch
            ? "When it arrives, exact local defense, ships, and stores will become visible for that system."
            : `${translateFactionId(probeLaunchMatch[1])} is trying to reduce uncertainty around ${translateSystemId(probeLaunchMatch[4])}.`,
          tone: watchesSeat && !seatLaunch ? "warn" : "info",
        };
        if (probe?.status === "deployed") {
          item.analysis = `${translateFactionId(probeLaunchMatch[1])} already has exact local visibility there.`;
        }
      }

      const probeArrivalMatch = detail.match(/^probe (\S+) deployed at (\S+)$/u);
      if (!item && probeArrivalMatch) {
        const probe = firstProbeSnapshot(probeArrivalMatch[1], parsed.date);
        const seatProbe = probe?.factionId === currentSeat.value.faction.id;
        item = {
          date: parsed.date,
          kicker: seatProbe ? "Recon on station" : "Probe contact",
          title: `Probe established at ${translateSystemId(probeArrivalMatch[2])}`,
          summary: seatProbe
            ? `A friendly probe is now reporting exact local conditions from ${translateSystemId(probeArrivalMatch[2])}.`
            : `A foreign probe reached ${translateSystemId(probeArrivalMatch[2])}.`,
          analysis: seatProbe
            ? "The system card now reflects live local defense, ships, and stores from the probe."
            : "Foreign reconnaissance narrows uncertainty before fleets move.",
          tone: seatProbe ? "success" : "warn",
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
        const isHostileArrival =
          fleet?.factionId &&
          destinationView?.ownerId &&
          fleet.factionId !== destinationView.ownerId;
        item = {
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
      if (items.length >= 12) {
        break;
      }
    }

    const combined = [...pendingProbeItems, ...items];
    return combined.slice(0, 12);
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
    const destinationId = ui.orderDraft.destinationId ?? destinationOptions.value[0]?.value ?? null;
    const destinationName = destinationId ? translateSystemId(destinationId) : "No destination";
    const plan = destinationId ? routePlan(system.id, destinationId) : null;
    const relayLine = commandRelay.value ? `${commandRelay.value.title}: ${commandRelay.value.detail}` : null;

    if (ui.activeAction === "attack" || ui.activeAction === "reinforce" || ui.activeAction === "blockade") {
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
            ? `Post-launch local salt: ${Math.max(0, snapshot.saltStockpile - burn)}`
            : "Post-launch local salt: unresolved until a route exists.",
          ui.activeAction === "blockade"
            ? "Blockading fleets can trigger interception penalties against enemies using adjacent starlanes."
            : null,
          relayLine,
        ].filter(Boolean),
      };
    }

    if (ui.activeAction === "resupply") {
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
      const anchorId = ui.orderDraft.anchorId ?? system.id;
      const originSystemId = ui.orderDraft.probeOriginId ?? system.id;
      const anchorPlan = routePlan(originSystemId, anchorId);
      const probeStatus = probeStatusForSystem(anchorId);
      return {
        title: "Probe Mission",
        lines: [
          `Origin: ${translateSystemId(originSystemId)}`,
          `Anchor: ${translateSystemId(anchorId)}`,
          `Estimated arrival: ${formatTravelSpan(anchorPlan?.travelDays ?? 0)}`,
          `Cost: ${PROBE_COST_SALT} salt`,
          "Requires: 1 ready probe in origin stores",
          probeStatus.status === "in_transit"
            ? probeStatus.label
            : "Probes narrow uncertainty around approach lanes and turns.",
          relayLine,
        ].filter(Boolean),
      };
    }

    return {
      title: "Trade Run",
      lines: [
        `${system.name} to ${destinationName}`,
        `Cargo priority: ${titleCase(ui.orderDraft.tradeFocus)}`,
        `Transit estimate: ${plan ? formatTravelSpan(plan.travelDays) : "No route"}`,
        `Local production: ${saltOutputForSystem(system)} salt / ${METAL_OUTPUT[system.metalRichness]} metals per year`,
        relayLine,
      ].filter(Boolean),
    };
  });

  const orderSubmission = computed(() => {
    if (!selectedSystem.value) {
      return {
        label: "Select a system",
        disabled: true,
        reason: "Pick a star on the map before issuing orders.",
      };
    }

    if (!selectedSystemFriendly.value) {
      return {
        label: "Observation only",
        disabled: true,
        reason: "Only friendly systems can originate orders from the dock.",
      };
    }

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

      const originSystemId = ui.orderDraft.probeOriginId ?? selectedSystem.value.system.id;
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
        reason: `Spend ${PROBE_COST_SALT} salt from ${translateSystemId(originSystemId)} and commit 1 ready probe to establish exact local intelligence.`,
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

    const plan = routePlan(selectedSystem.value.system.id, destinationId);
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
      reason: "Transmit the order and update the working world state immediately.",
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
    },
    { immediate: true },
  );

  watch(
    () => plannerStorageKey.value ? JSON.stringify({
      speculation: ui.planner.speculation,
      productionBySystemId: ui.planner.productionBySystemId,
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
      if (ui.activeAction !== "deploy_probe" || !systemId || !currentSeat.value) {
        return;
      }

      const snapshot = snapshotSystem(systemId);
      if (snapshot?.ownerId === currentSeat.value.faction.id) {
        ui.orderDraft.probeOriginId = systemId;
      }
    },
  );

  function chooseDefaultScenarioId() {
    const fromQuery = new URLSearchParams(locationSearch).get("scenario");
    if (fromQuery && testHarness.scenarioList.some((entry) => entry.id === fromQuery)) {
      return fromQuery;
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

    const snapshot = latestSnapshot.value;
    return [...world.scenario.factions]
      .sort((left, right) => {
        const leftOwned = snapshot?.factions[left.id]?.ownedSystems ?? 0;
        const rightOwned = snapshot?.factions[right.id]?.ownedSystems ?? 0;
        return rightOwned - leftOwned;
      })[0]
      ?.id;
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
    if (!currentSeat.value || !selectedSystem.value) {
      throw new Error("Select a friendly origin system first.");
    }

    const at = currentCommandDate();
    const originSystemId = selectedSystem.value.system.id;
    const destinationSystemId = ui.orderDraft.destinationId ?? destinationOptions.value[0]?.value ?? null;
    if (!at || !destinationSystemId) {
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
      },
    );
  }

  async function submitActiveOrder() {
    if (!currentSeat.value || !selectedSystem.value) {
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

      const originSystemId = ui.orderDraft.probeOriginId ?? selectedSystem.value.system.id;
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
      selectedSystem.value.system.id,
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
  }

  function prepareProbeForSystem(targetSystemId = selectedSystem.value?.system.id) {
    if (!targetSystemId || !currentSeat.value) {
      return;
    }

    const origin = nearestFriendlyOrigin(targetSystemId)?.systemId ?? currentSeat.value.faction.homeSystemId;
    ui.activeAction = "deploy_probe";
    ui.orderDraft.anchorId = targetSystemId;
    ui.orderDraft.probeOriginId = origin;
    selectSystem(origin);
  }

  function setProbeOriginSystemId(systemId) {
    ui.orderDraft.probeOriginId = systemId;
    if (systemId) {
      selectSystem(systemId);
    }
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

  function setProductionFocus(systemId, focus) {
    updateProductionPlan(systemId, { focus });
  }

  function setProductionQuantity(systemId, quantity) {
    updateProductionPlan(systemId, {
      quantity: Math.max(1, Number(quantity || 1)),
    });
  }

  function setProductionPosture(systemId, posture) {
    updateProductionPlan(systemId, { posture });
  }

  function setSpeculationText(value) {
    ui.planner.speculation = value ?? "";
  }

  return {
    ORDER_ACTIONS,
    PRODUCTION_FOCUS_OPTIONS,
    PRODUCTION_POSTURE_OPTIONS,
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
    destinationOptions,
    anchorOptions,
    probeOriginOptions,
    summaryCards,
    mapLayout,
    mapCanvas,
    fleetMarkers,
    probeMarkers,
    feedItems,
    reconSummary,
    orderBrief,
    orderSubmission,
    fleetEntries,
    probeEntries,
    snapshotSystem,
    inboundFleets,
    totalShipsAtSystem,
    routePlan,
    starlaneSegments,
    blockadeStatus,
    homeBadgeForSystem,
    systemTone,
    starClass,
    translateSystemId,
    loadInitialData,
    loadScenario,
    selectSystem,
    setSelectedSystemId,
    setActiveAction,
    prepareProbeForSystem,
    setProbeOriginSystemId,
    setProductionFocus,
    setProductionQuantity,
    setProductionPosture,
    setSpeculationText,
    submitImmediateProbe,
    submitActiveOrder,
  };
}
