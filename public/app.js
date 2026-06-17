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
const ORDER_ACTIONS = ["send_pigeon", "launch_fleet", "deploy_probe", "trade"];
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  scenarioId: null,
  scenarios: [],
  scenario: null,
  result: null,
  seatFactionId: null,
  selectedSystemId: null,
  activeAction: "send_pigeon",
};

const elements = {
  apiStatus: document.querySelector("#api-status"),
  briefingDate: document.querySelector("#briefing-date"),
  briefingTitle: document.querySelector("#briefing-title"),
  feedList: document.querySelector("#feed-list"),
  feedMeta: document.querySelector("#feed-meta"),
  galaxyMap: document.querySelector("#galaxy-map"),
  mapMeta: document.querySelector("#map-meta"),
  orderBrief: document.querySelector("#order-brief"),
  orderForm: document.querySelector("#order-form"),
  ordersActions: document.querySelector("#orders-actions"),
  ordersMeta: document.querySelector("#orders-meta"),
  scenarioSelect: document.querySelector("#scenario-select"),
  seatSelect: document.querySelector("#seat-select"),
  selectionCard: document.querySelector("#selection-card"),
  summaryBar: document.querySelector("#summary-bar"),
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
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

function setApiStatus(text, tone) {
  elements.apiStatus.textContent = text;
  elements.apiStatus.dataset.tone = tone;
}

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function emptyPanel(message) {
  return createNode("div", "empty-state", message);
}

function scenarioById(id) {
  return state.scenarios.find((scenario) => scenario.id === id) ?? null;
}

function currentSeat() {
  if (!state.scenario || !state.result || !state.seatFactionId) {
    return null;
  }

  const faction = state.scenario.factions.find(
    (candidate) => candidate.id === state.seatFactionId,
  );
  const latestSnapshot = latestSnapshotForResult();
  const factionSnapshot = latestSnapshot?.factions[state.seatFactionId];

  if (!faction || !factionSnapshot) {
    return null;
  }

  return {
    faction,
    snapshot: factionSnapshot,
  };
}

function latestSnapshotForResult() {
  return state.result?.snapshots?.[state.result.snapshots.length - 1] ?? null;
}

function systemsMap() {
  return new Map((state.scenario?.systems ?? []).map((system) => [system.id, system]));
}

function snapshotSystem(systemId) {
  return latestSnapshotForResult()?.systems?.[systemId] ?? null;
}

function ownedSystemsForSeat() {
  const seat = currentSeat();
  if (!seat) {
    return [];
  }

  return state.scenario.systems.filter(
    (system) => latestSnapshotForResult()?.systems?.[system.id]?.ownerId === seat.faction.id,
  );
}

function fleetEntries() {
  return Object.entries(latestSnapshotForResult()?.fleets ?? {}).map(([fleetId, fleet]) => ({
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
  return (state.scenario?.routes ?? []).filter(
    (route) => route.a === systemId || route.b === systemId,
  );
}

function routePlan(originSystemId, destinationSystemId) {
  if (!state.scenario) {
    return null;
  }

  const adjacency = new Map();
  for (const route of state.scenario.routes) {
    const left = adjacency.get(route.a) ?? [];
    left.push({ systemId: route.b, distance: route.distance, travelDays: route.travelDays });
    adjacency.set(route.a, left);

    const right = adjacency.get(route.b) ?? [];
    right.push({ systemId: route.a, distance: route.distance, travelDays: route.travelDays });
    adjacency.set(route.b, right);
  }

  const distances = new Map([[originSystemId, { distance: 0, travelDays: 0 }]]);
  const queue = [{ systemId: originSystemId, distance: 0, travelDays: 0 }];

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

function chooseDefaultScenarioId(scenarios) {
  if (scenarios.some((scenario) => scenario.id === "profile_frontier_vs_turtle")) {
    return "profile_frontier_vs_turtle";
  }

  return [...scenarios]
    .sort((left, right) => right.systemCount - left.systemCount || right.durationDays - left.durationDays)[0]
    ?.id;
}

function chooseDefaultSeatId() {
  if (!state.scenario) {
    return null;
  }

  const latest = latestSnapshotForResult();
  if (!latest) {
    return state.scenario.factions[0]?.id ?? null;
  }

  return [...state.scenario.factions]
    .sort((left, right) => {
      const leftOwned = latest.factions[left.id]?.ownedSystems ?? 0;
      const rightOwned = latest.factions[right.id]?.ownedSystems ?? 0;
      return rightOwned - leftOwned;
    })[0]
    ?.id;
}

function populateScenarioSelect() {
  elements.scenarioSelect.innerHTML = "";

  for (const scenario of state.scenarios) {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.name;
    elements.scenarioSelect.appendChild(option);
  }

  if (state.scenarioId) {
    elements.scenarioSelect.value = state.scenarioId;
  }
}

function populateSeatSelect() {
  elements.seatSelect.innerHTML = "";

  for (const faction of state.scenario?.factions ?? []) {
    const option = document.createElement("option");
    option.value = faction.id;
    option.textContent = faction.name;
    elements.seatSelect.appendChild(option);
  }

  if (state.seatFactionId) {
    elements.seatSelect.value = state.seatFactionId;
  }
}

function renderSummaryBar() {
  const seat = currentSeat();
  elements.summaryBar.innerHTML = "";

  if (!seat) {
    elements.summaryBar.appendChild(emptyPanel("Load a briefing to populate the command table."));
    return;
  }

  const latest = latestSnapshotForResult();
  const reportsRecent = buildFeedItems().filter((item) => item.tone !== "logistics").length;
  const transitCount = fleetEntries().filter(
    (fleet) => fleet.factionId === seat.faction.id && fleet.status === "transit",
  ).length;
  const contested = state.scenario.systems.filter((system) => {
    const view = latest.systems[system.id];
    return view.ownerId === seat.faction.id && (view.captureProgress > 0 || view.claimProgress > 0);
  }).length;

  const cards = [
    { label: "Salt", value: formatNumber(seat.snapshot.totalSaltStockpile) },
    { label: "Metals", value: formatNumber(seat.snapshot.totalMetalStockpile) },
    { label: "Owned Systems", value: formatNumber(seat.snapshot.ownedSystems) },
    { label: "Fleets In Transit", value: formatNumber(transitCount) },
    { label: "Actionable Reports", value: formatNumber(reportsRecent) },
    { label: "Contested Worlds", value: formatNumber(contested) },
  ];

  for (const card of cards) {
    const article = createNode("article", "summary-card");
    article.append(
      createNode("div", "summary-label", card.label),
      createNode("div", "summary-value", card.value),
    );
    elements.summaryBar.appendChild(article);
  }
}

function buildMapLayout() {
  const seat = currentSeat();
  if (!seat || !state.scenario) {
    return new Map();
  }

  const homeSystemId = seat.faction.homeSystemId;
  const systems = state.scenario.systems;
  const distanceEntries = systems.map((system) => {
    const plan = routePlan(homeSystemId, system.id);
    return {
      systemId: system.id,
      distance: plan?.distance ?? Number.POSITIVE_INFINITY,
      travelDays: plan?.travelDays ?? Number.POSITIVE_INFINITY,
    };
  });

  const uniqueDistances = [...new Set(distanceEntries.map((entry) => entry.distance))].sort((left, right) => left - right);
  const columns = new Map(uniqueDistances.map((distance, index) => [distance, index]));
  const layout = new Map();
  const grouped = new Map();

  for (const entry of distanceEntries) {
    const key = columns.get(entry.distance) ?? 0;
    const group = grouped.get(key) ?? [];
    group.push(entry.systemId);
    grouped.set(key, group);
  }

  const columnCount = Math.max(1, uniqueDistances.length);
  for (const [columnIndex, systemIds] of grouped.entries()) {
    systemIds.sort((left, right) => left.localeCompare(right));
    const x = 110 + (columnIndex / Math.max(1, columnCount - 1 || 1)) * 660;
    const laneCount = Math.max(1, systemIds.length);
    for (const [index, systemId] of systemIds.entries()) {
      const y = laneCount === 1 ? 310 : 120 + (index / (laneCount - 1)) * 380;
      layout.set(systemId, { x, y });
    }
  }

  return layout;
}

function systemVisualTone(systemId) {
  const seat = currentSeat();
  const snapshot = snapshotSystem(systemId);
  if (!snapshot || !seat) {
    return "neutral";
  }
  if (snapshot.ownerId === seat.faction.id) {
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

function renderMap() {
  const seat = currentSeat();
  elements.galaxyMap.innerHTML = "";

  if (!seat || !state.scenario || !state.result) {
    return;
  }

  const positions = buildMapLayout();
  const selectedId = state.selectedSystemId;

  for (const route of state.scenario.routes) {
    const a = positions.get(route.a);
    const b = positions.get(route.b);
    if (!a || !b) {
      continue;
    }

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(a.x));
    line.setAttribute("y1", String(a.y));
    line.setAttribute("x2", String(b.x));
    line.setAttribute("y2", String(b.y));
    line.setAttribute("class", selectedId && (route.a === selectedId || route.b === selectedId) ? "route route-active" : "route");
    elements.galaxyMap.appendChild(line);
  }

  for (const system of state.scenario.systems) {
    const position = positions.get(system.id);
    if (!position) {
      continue;
    }

    const snapshot = snapshotSystem(system.id);
    const inbound = inboundFleets(system.id).length;
    const tone = systemVisualTone(system.id);
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `system system-${tone}`);
    group.dataset.systemId = system.id;
    group.setAttribute("transform", `translate(${position.x} ${position.y})`);

    if (snapshot && (snapshot.captureProgress > 0 || snapshot.claimProgress > 0)) {
      const halo = document.createElementNS(SVG_NS, "circle");
      halo.setAttribute("r", "26");
      halo.setAttribute("class", "system-halo");
      group.appendChild(halo);
    }

    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("r", selectedId === system.id ? "18" : "15");
    ring.setAttribute("class", `system-ring ${selectedId === system.id ? "system-selected" : ""}`);
    group.appendChild(ring);

    const star = document.createElementNS(SVG_NS, "circle");
    star.setAttribute("r", system.starType === "giant_or_exotic" ? "10" : "8");
    star.setAttribute("class", `system-star ${starClass(system.starType)}`);
    group.appendChild(star);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", "0");
    label.setAttribute("y", "34");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "system-label");
    label.textContent = system.name;
    group.appendChild(label);

    if (inbound > 0) {
      const badge = document.createElementNS(SVG_NS, "circle");
      badge.setAttribute("cx", "16");
      badge.setAttribute("cy", "-16");
      badge.setAttribute("r", "10");
      badge.setAttribute("class", "incoming-badge");
      group.appendChild(badge);

      const badgeText = document.createElementNS(SVG_NS, "text");
      badgeText.setAttribute("x", "16");
      badgeText.setAttribute("y", "-12");
      badgeText.setAttribute("text-anchor", "middle");
      badgeText.setAttribute("class", "incoming-badge-text");
      badgeText.textContent = String(inbound);
      group.appendChild(badgeText);
    }

    elements.galaxyMap.appendChild(group);
  }

  elements.galaxyMap.onclick = (event) => {
    const target = event.target.closest?.("[data-system-id]");
    if (!target) {
      state.selectedSystemId = null;
      renderSelectionCard();
      renderMap();
      renderOrdersTray();
      return;
    }

    state.selectedSystemId = target.dataset.systemId;
    renderSelectionCard();
    renderMap();
    renderOrdersTray();
  };

  elements.mapMeta.textContent = `${seat.faction.name} holds ${seat.snapshot.ownedSystems} systems on ${state.result.endDate}`;
}

function renderSelectionCard() {
  elements.selectionCard.innerHTML = "";

  if (!state.selectedSystemId || !state.scenario) {
    elements.selectionCard.append(
      createNode("p", "selection-kicker", "No system selected"),
      createNode("h3", "", "Select a star on the map"),
      createNode(
        "p",
        "selection-copy",
        "Choose a system to inspect defenses, ships, resources, and the best available orders.",
      ),
    );
    return;
  }

  const system = systemsMap().get(state.selectedSystemId);
  const snapshot = snapshotSystem(state.selectedSystemId);
  const seat = currentSeat();
  if (!system || !snapshot || !seat) {
    return;
  }

  const friendlyShips = totalShipsAtSystem(system.id, seat.faction.id);
  const enemyShips = fleetsAtSystem(system.id)
    .filter((fleet) => fleet.factionId !== seat.faction.id)
    .reduce((total, fleet) => total + fleet.ships, 0);
  const inbound = inboundFleets(system.id);
  const ownership = snapshot.ownerId === seat.faction.id
    ? "Friendly Control"
    : snapshot.ownerId
      ? `Held by ${state.scenario.factions.find((faction) => faction.id === snapshot.ownerId)?.name ?? snapshot.ownerId}`
      : "Open System";

  const stats = [
    ["Star", titleCase(system.starType)],
    ["Metals", titleCase(system.metalRichness)],
    ["Salt Output", `${STAR_OUTPUT[system.starType]}/day`],
    ["Defense", formatNumber(snapshot.defense)],
    ["Friendly Ships", formatNumber(friendlyShips)],
    ["Enemy Ships", formatNumber(enemyShips)],
    ["Local Salt", formatNumber(snapshot.saltStockpile)],
    ["Local Metals", formatNumber(snapshot.metalStockpile)],
  ];

  const routes = neighboringRoutes(system.id)
    .map((route) => {
      const otherId = route.a === system.id ? route.b : route.a;
      const other = systemsMap().get(otherId);
      return `${other?.name ?? otherId} in ${route.travelDays}d`;
    })
    .join(" • ");

  elements.selectionCard.append(
    createNode("p", "selection-kicker", ownership),
    createNode("h3", "", system.name),
    createNode("p", "selection-copy", routes || "No known routes."),
  );

  const grid = createNode("div", "selection-grid");
  for (const [label, value] of stats) {
    const block = createNode("div", "selection-stat");
    block.append(createNode("span", "selection-label", label), createNode("strong", "", value));
    grid.appendChild(block);
  }
  elements.selectionCard.appendChild(grid);

  if (inbound.length > 0) {
    const alert = createNode(
      "p",
      "selection-alert",
      `${inbound.length} fleet${inbound.length === 1 ? "" : "s"} inbound to this system.`,
    );
    elements.selectionCard.appendChild(alert);
  }
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

function buildFeedItems() {
  const seat = currentSeat();
  if (!seat || !state.result) {
    return [];
  }

  const relevantSystemIds = new Set(ownedSystemsForSeat().map((system) => system.id));
  relevantSystemIds.add(seat.faction.homeSystemId);

  const items = [];

  for (const line of [...state.result.log].reverse()) {
    const parsed = parseLogEntry(line);
    if (!parsed || parsed.detail.includes(" produced ")) {
      continue;
    }

    const detail = parsed.detail;
    const involvesSeat =
      detail.includes(`${seat.faction.id} `) ||
      [...relevantSystemIds].some((systemId) => detail.includes(systemId));

    if (!involvesSeat && !detail.includes("combat at") && !detail.includes("captured")) {
      continue;
    }

    let item;

    const launchMatch = detail.match(/^(\w+) launched (\S+) from (\S+) to (\S+)$/u);
    if (launchMatch) {
      item = {
        date: parsed.date,
        eyebrow: "Departure Burn",
        title: `${translateSystemId(launchMatch[3])} committed ships`,
        summary: `${titleCase(launchMatch[1])} launched a fleet toward ${translateSystemId(launchMatch[4])}.`,
        consequence: `Expect arrival in ${routePlan(launchMatch[3], launchMatch[4])?.travelDays ?? "?"} days if the course holds.`,
        recommendation: launchMatch[1] === seat.faction.id ? "Watch the destination for reinforcement needs." : "Consider probes or reserve positioning.",
        tone: launchMatch[1] === seat.faction.id ? "friendly" : "warning",
      };
    }

    const arrivalMatch = detail.match(/^fleet (\S+) arrived at (\S+)$/u);
    if (!item && arrivalMatch) {
      item = {
        date: parsed.date,
        eyebrow: "Arrival",
        title: `${translateSystemId(arrivalMatch[2])} received a fleet`,
        summary: `A fleet reached ${translateSystemId(arrivalMatch[2])}.`,
        consequence: "Local force balance may have shifted immediately.",
        recommendation: "Inspect the map for updated defenses and ship counts.",
        tone: relevantSystemIds.has(arrivalMatch[2]) ? "warning" : "neutral",
      };
    }

    const combatMatch = detail.match(/^combat at (\S+); attacker (\w+) lost (\d+), defender (\w+) lost (\d+)$/u);
    if (!item && combatMatch) {
      item = {
        date: parsed.date,
        eyebrow: "Combat Report",
        title: `${translateSystemId(combatMatch[1])} is under pressure`,
        summary: `Attacker losses: ${combatMatch[3]}. Defender losses: ${combatMatch[5]}.`,
        consequence: "Control may change if defenders stay below the holding threshold.",
        recommendation: relevantSystemIds.has(combatMatch[1]) ? "Reinforce or accept a delayed control loss." : "Track whether the battle opens a frontier lane.",
        tone: relevantSystemIds.has(combatMatch[1]) ? "warning" : "neutral",
      };
    }

    const claimMatch = detail.match(/^(\w+) claimed open system (\S+)$/u);
    if (!item && claimMatch) {
      item = {
        date: parsed.date,
        eyebrow: "Control Shift",
        title: `${translateSystemId(claimMatch[2])} was claimed`,
        summary: `${titleCase(claimMatch[1])} established control over an open system.`,
        consequence: "Salt and metals from that star will now begin feeding its new owner.",
        recommendation: claimMatch[1] === seat.faction.id ? "Stabilize the frontier with defense or a probe." : "Review whether the new border changes your threat picture.",
        tone: claimMatch[1] === seat.faction.id ? "friendly" : "warning",
      };
    }

    const captureMatch = detail.match(/^(\w+) captured (\S+)$/u);
    if (!item && captureMatch) {
      item = {
        date: parsed.date,
        eyebrow: "System Lost",
        title: `${translateSystemId(captureMatch[2])} changed hands`,
        summary: `${titleCase(captureMatch[1])} completed a capture.`,
        consequence: "Existing routes and local production now favor the new owner.",
        recommendation: captureMatch[1] === seat.faction.id ? "Consolidate the gain before pushing farther." : "Decide whether to counterattack before control age hardens.",
        tone: captureMatch[1] === seat.faction.id ? "friendly" : "warning",
      };
    }

    const probeMatch = detail.match(/^(\w+) deployed probe (\S+)$/u);
    if (!item && probeMatch) {
      item = {
        date: parsed.date,
        eyebrow: "Probe Deployed",
        title: `${titleCase(probeMatch[1])} put scouts in motion`,
        summary: "New eyes are moving toward the frontier.",
        consequence: "Future fleet turns may become less ambiguous.",
        recommendation: probeMatch[1] === seat.faction.id ? "Use the extra warning time to keep fleets concentrated." : "Expect your turns to be harder to hide.",
        tone: probeMatch[1] === seat.faction.id ? "friendly" : "neutral",
      };
    }

    const pigeonMatch = detail.match(/^(\w+) sent pigeon (\S+) to (\S+)$/u);
    if (!item && pigeonMatch) {
      item = {
        date: parsed.date,
        eyebrow: "Dispatch",
        title: `Courier launched toward ${translateSystemId(pigeonMatch[3])}`,
        summary: `${titleCase(pigeonMatch[1])} spent salt to move information.`,
        consequence: "Fresh intent or logistics updates are now in transit.",
        recommendation: pigeonMatch[1] === seat.faction.id ? "Keep communications disciplined so salt remains available for movement." : "Watch for follow-up fleet actions after the courier lands.",
        tone: "logistics",
      };
    }

    const reportMatch = detail.match(/^report (\S+) delivered to (\w+)$/u);
    if (!item && reportMatch && reportMatch[2] === seat.faction.id) {
      item = {
        date: parsed.date,
        eyebrow: "Intel Arrived",
        title: "A new report reached command",
        summary: "Your knowledge of the frontier just changed.",
        consequence: "The map may now show new risks, routes, or force estimates.",
        recommendation: "Re-check contested systems and incoming lanes before spending salt.",
        tone: "friendly",
      };
    }

    const queueMatch = detail.match(/^(\w+) queued (\d+) (ship|defense) at (\S+)$/u);
    if (!item && queueMatch && queueMatch[1] === seat.faction.id) {
      item = {
        date: parsed.date,
        eyebrow: "Construction Started",
        title: `${translateSystemId(queueMatch[4])} began new works`,
        summary: `${queueMatch[2]} ${queueMatch[3]} queued for construction.`,
        consequence: "Resources are committed now, power arrives later.",
        recommendation: "Protect the system long enough for the investment to finish.",
        tone: "logistics",
      };
    }

    const completeMatch = detail.match(/^(\w+) completed (\d+) ship\(s\) at (\S+)$/u)
      ?? detail.match(/^(\w+) completed (\d+) defense at (\S+)$/u);
    if (!item && completeMatch && completeMatch[1] === seat.faction.id) {
      item = {
        date: parsed.date,
        eyebrow: "Construction Complete",
        title: `${translateSystemId(completeMatch[3])} is stronger today`,
        summary: `${completeMatch[2]} new asset${completeMatch[2] === "1" ? "" : "s"} entered service.`,
        consequence: "You can now garrison, trade, or concentrate force from this system more safely.",
        recommendation: "Check whether the new strength frees ships elsewhere.",
        tone: "friendly",
      };
    }

    if (!item) {
      item = {
        date: parsed.date,
        eyebrow: "Field Note",
        title: sentenceCase(detail),
        summary: "A noteworthy change occurred in the theater.",
        consequence: "Check the operational picture for a knock-on effect.",
        recommendation: "Use the map before committing new orders.",
        tone: "neutral",
      };
    }

    items.push(item);

    if (items.length >= 10) {
      break;
    }
  }

  return items;
}

function renderFeed() {
  elements.feedList.innerHTML = "";
  const items = buildFeedItems();

  if (!items.length) {
    elements.feedList.appendChild(emptyPanel("No command feed items are available yet."));
    elements.feedMeta.textContent = "Quiet frontier";
    return;
  }

  elements.feedMeta.textContent = `${items.length} latest updates`;

  for (const item of items) {
    const article = createNode("article", `feed-card tone-${item.tone}`);
    article.append(
      createNode("p", "feed-eyebrow", item.eyebrow),
      createNode("h3", "feed-title", item.title),
      createNode("p", "feed-date", item.date),
      createNode("p", "feed-summary", item.summary),
      createNode("p", "feed-consequence", item.consequence),
      createNode("p", "feed-recommendation", `Next: ${item.recommendation}`),
    );
    elements.feedList.appendChild(article);
  }
}

function renderOrdersActions() {
  elements.ordersActions.innerHTML = "";

  for (const action of ORDER_ACTIONS) {
    const button = createNode(
      "button",
      `order-action ${state.activeAction === action ? "order-action-active" : ""}`,
      titleCase(action),
    );
    button.type = "button";
    button.addEventListener("click", () => {
      state.activeAction = action;
      renderOrdersTray();
    });
    elements.ordersActions.appendChild(button);
  }
}

function systemUnderCommand() {
  if (!state.selectedSystemId) {
    return null;
  }

  const system = systemsMap().get(state.selectedSystemId);
  const snapshot = snapshotSystem(state.selectedSystemId);
  const seat = currentSeat();
  if (!system || !snapshot || !seat) {
    return null;
  }

  return {
    system,
    snapshot,
    seat,
    isFriendly: snapshot.ownerId === seat.faction.id,
  };
}

function renderOrderForm() {
  elements.orderForm.innerHTML = "";
  const command = systemUnderCommand();

  if (!command) {
    elements.orderForm.appendChild(emptyPanel("Select a system to prepare an order."));
    return;
  }

  const { system, seat, isFriendly } = command;

  if (!isFriendly) {
    elements.orderForm.appendChild(
      emptyPanel("Orders can only be drafted from systems your command currently controls."),
    );
    return;
  }

  const destinations = state.scenario.systems.filter((candidate) => candidate.id !== system.id);
  const destinationOptions = destinations
    .map((candidate) => `<option value="${candidate.id}">${candidate.name}</option>`)
    .join("");
  const localShips = totalShipsAtSystem(system.id, seat.faction.id);

  if (state.activeAction === "send_pigeon") {
    elements.orderForm.innerHTML = `
      <div class="form-grid">
        <label class="tray-field">
          <span>Origin</span>
          <input value="${system.name}" disabled />
        </label>
        <label class="tray-field">
          <span>Destination</span>
          <select id="order-destination">${destinationOptions}</select>
        </label>
        <label class="tray-field">
          <span>Packet Type</span>
          <select id="order-packet-type">
            <option value="intel">Intel</option>
            <option value="orders">Orders</option>
            <option value="logistics">Logistics</option>
            <option value="diplomatic">Diplomatic</option>
          </select>
        </label>
      </div>
    `;
    return;
  }

  if (state.activeAction === "launch_fleet") {
    elements.orderForm.innerHTML = `
      <div class="form-grid">
        <label class="tray-field">
          <span>Origin</span>
          <input value="${system.name}" disabled />
        </label>
        <label class="tray-field">
          <span>Destination</span>
          <select id="order-destination">${destinationOptions}</select>
        </label>
        <label class="tray-field">
          <span>Mission</span>
          <select id="order-mission">
            <option value="attack">Attack</option>
            <option value="reinforce">Reinforce</option>
            <option value="resupply">Resupply</option>
            <option value="trade">Trade</option>
          </select>
        </label>
        <label class="tray-field">
          <span>Ships</span>
          <input id="order-ships" type="range" min="1" max="${Math.max(1, localShips)}" value="${Math.max(1, Math.min(3, localShips))}" />
        </label>
      </div>
      <p class="helper-copy">Available ships at ${system.name}: ${localShips}</p>
    `;
    return;
  }

  if (state.activeAction === "deploy_probe") {
    const routeOptions = neighboringRoutes(system.id)
      .map((route) => {
        const otherId = route.a === system.id ? route.b : route.a;
        return `<option value="${otherId}">${translateSystemId(otherId)}</option>`;
      })
      .join("");

    elements.orderForm.innerHTML = `
      <div class="form-grid">
        <label class="tray-field">
          <span>Launch System</span>
          <input value="${system.name}" disabled />
        </label>
        <label class="tray-field">
          <span>Probe Anchor</span>
          <select id="order-anchor">${routeOptions || `<option value="${system.id}">${system.name}</option>`}</select>
        </label>
        <label class="tray-field">
          <span>Report Home</span>
          <input value="${translateSystemId(seat.faction.homeSystemId)}" disabled />
        </label>
      </div>
    `;
    return;
  }

  elements.orderForm.innerHTML = `
    <div class="form-grid">
      <label class="tray-field">
        <span>Origin</span>
        <input value="${system.name}" disabled />
      </label>
      <label class="tray-field">
        <span>Trade Destination</span>
        <select id="order-destination">${destinationOptions}</select>
      </label>
      <label class="tray-field">
        <span>Cargo Focus</span>
        <select id="order-trade-focus">
          <option value="salt">Salt</option>
          <option value="metals">Metals</option>
        </select>
      </label>
    </div>
  `;
}

function readOrderValue(id) {
  return document.querySelector(`#${id}`)?.value ?? null;
}

function renderOrderBrief() {
  elements.orderBrief.innerHTML = "";
  const command = systemUnderCommand();

  if (!command) {
    elements.orderBrief.appendChild(emptyPanel("The order brief appears here once a system is selected."));
    return;
  }

  const { system, snapshot, seat, isFriendly } = command;
  if (!isFriendly) {
    elements.orderBrief.appendChild(
      emptyPanel("You can inspect hostile and open systems here, but your orders must originate from friendly control."),
    );
    elements.ordersMeta.textContent = `${system.name} is not under your control`;
    return;
  }

  elements.ordersMeta.textContent = `${system.name} can issue ${titleCase(state.activeAction)} orders`;

  const destinationId = readOrderValue("order-destination") ?? state.scenario.systems.find((candidate) => candidate.id !== system.id)?.id;
  const plan = destinationId ? routePlan(system.id, destinationId) : null;
  const destinationName = destinationId ? translateSystemId(destinationId) : "No destination";

  const article = createNode("article", "brief-card");
  article.append(createNode("h3", "", titleCase(state.activeAction)));

  if (state.activeAction === "send_pigeon") {
    article.append(
      createNode("p", "brief-copy", `Courier route: ${system.name} to ${destinationName}`),
      createNode("p", "brief-copy", `Estimated transit: ${plan?.travelDays ?? "?"} days`),
      createNode("p", "brief-copy", "Cost: 1 salt"),
      createNode("p", "brief-footnote", "Draft only for now. The tray is validating the command flow, not sending persistent orders yet."),
    );
  } else if (state.activeAction === "launch_fleet") {
    const ships = Number(readOrderValue("order-ships") ?? Math.max(1, Math.min(3, totalShipsAtSystem(system.id, seat.faction.id))));
    const mission = readOrderValue("order-mission") ?? "attack";
    const burn = plan ? requiredBurnSalt(ships, 0, 0, plan.distance) : null;

    article.append(
      createNode("p", "brief-copy", `${ships} ships from ${system.name} toward ${destinationName}.`),
      createNode("p", "brief-copy", `Mission: ${titleCase(mission)}`),
      createNode("p", "brief-copy", `Estimated transit: ${plan?.travelDays ?? "?"} days`),
      createNode("p", "brief-copy", `Estimated burn cost: ${burn ?? "?"} salt`),
      createNode("p", "brief-copy", `Local salt after launch: ${Math.max(0, snapshot.saltStockpile - (burn ?? 0))}`),
      createNode("p", "brief-footnote", "Draft only for now. Final order submission will wire into persistent game state next."),
    );
  } else if (state.activeAction === "deploy_probe") {
    const anchorId = readOrderValue("order-anchor") ?? system.id;
    const anchorPlan = routePlan(system.id, anchorId);
    article.append(
      createNode("p", "brief-copy", `Probe anchor: ${translateSystemId(anchorId)}`),
      createNode("p", "brief-copy", `Travel time to anchor: ${anchorPlan?.travelDays ?? 0} days`),
      createNode("p", "brief-copy", "Cost: 2 salt, 2 metals"),
      createNode("p", "brief-copy", "Use probes to keep pressure on uncertain approach lanes."),
      createNode("p", "brief-footnote", "Draft only for now. This UI is focused on the player decision surface first."),
    );
  } else {
    const tradeFocus = readOrderValue("order-trade-focus") ?? "salt";
    article.append(
      createNode("p", "brief-copy", `Trade run from ${system.name} to ${destinationName}.`),
      createNode("p", "brief-copy", `Priority cargo: ${titleCase(tradeFocus)}`),
      createNode("p", "brief-copy", `Estimated transit: ${plan?.travelDays ?? "?"} days`),
      createNode("p", "brief-copy", `Local star output: ${STAR_OUTPUT[system.starType]} salt / ${METAL_OUTPUT[system.metalRichness]} metals per day`),
      createNode("p", "brief-footnote", "Draft only for now. This preview helps us validate the least-click order flow."),
    );
  }

  elements.orderBrief.appendChild(article);
}

function bindOrderInputs() {
  for (const control of elements.orderForm.querySelectorAll("select, input[type=\"range\"]")) {
    control.addEventListener("input", () => {
      renderOrderBrief();
    });
  }
}

function renderOrdersTray() {
  renderOrdersActions();
  renderOrderForm();
  renderOrderBrief();
  bindOrderInputs();
}

function renderSeatView() {
  const seat = currentSeat();
  if (!seat || !state.result || !state.scenario) {
    return;
  }

  state.selectedSystemId = state.selectedSystemId && systemsMap().has(state.selectedSystemId)
    ? state.selectedSystemId
    : seat.faction.homeSystemId;

  elements.briefingDate.textContent = state.result.endDate;
  elements.briefingTitle.textContent = `${seat.faction.name} command seat. Read the feed, inspect the map, and draft your next move.`;
  renderSummaryBar();
  renderSelectionCard();
  renderMap();
  renderFeed();
  renderOrdersTray();
}

async function loadScenario(id) {
  const response = await fetch(`/api/scenarios/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(`Unable to load scenario ${id}`);
  }

  const scenario = await response.json();
  const simulationResponse = await fetch("/api/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(scenario),
  });

  if (!simulationResponse.ok) {
    throw new Error(`Unable to simulate scenario ${id}`);
  }

  state.scenarioId = id;
  state.scenario = scenario;
  state.result = await simulationResponse.json();
  state.seatFactionId = chooseDefaultSeatId();
  populateSeatSelect();
  renderSeatView();
}

elements.scenarioSelect.addEventListener("change", async (event) => {
  const id = event.target.value;
  if (!id) {
    return;
  }

  await loadScenario(id);
});

elements.seatSelect.addEventListener("change", (event) => {
  state.seatFactionId = event.target.value;
  renderSeatView();
});

async function init() {
  try {
    const health = await fetch("/api/health");
    if (!health.ok) {
      throw new Error("health check failed");
    }

    setApiStatus("Link live", "good");

    const response = await fetch("/api/scenarios");
    if (!response.ok) {
      throw new Error("scenario list failed");
    }

    const payload = await response.json();
    state.scenarios = payload.scenarios;
    state.scenarioId = chooseDefaultScenarioId(payload.scenarios);
    populateScenarioSelect();

    if (state.scenarioId) {
      await loadScenario(state.scenarioId);
    }
  } catch (error) {
    setApiStatus("Link lost", "bad");
    elements.summaryBar.innerHTML = "";
    elements.summaryBar.appendChild(
      emptyPanel(error instanceof Error ? error.message : "Unable to initialize command table."),
    );
  }
}

init();
