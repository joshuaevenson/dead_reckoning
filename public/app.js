const state = {
  scenarios: [],
  result: null,
};

const elements = {
  apiStatus: document.querySelector("#api-status"),
  assertions: document.querySelector("#assertions"),
  factions: document.querySelector("#factions"),
  fleets: document.querySelector("#fleets"),
  loadScenario: document.querySelector("#load-scenario"),
  log: document.querySelector("#log"),
  resultSummary: document.querySelector("#result-summary"),
  runSimulation: document.querySelector("#run-simulation"),
  scenarioEditor: document.querySelector("#scenario-editor"),
  scenarioSelect: document.querySelector("#scenario-select"),
  snapshotDate: document.querySelector("#snapshot-date"),
  snapshotRange: document.querySelector("#snapshot-range"),
  summaryGrid: document.querySelector("#summary-grid"),
  systems: document.querySelector("#systems"),
  timelinePanel: document.querySelector("#timeline-panel"),
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function setApiStatus(text, tone) {
  elements.apiStatus.textContent = text;
  elements.apiStatus.dataset.tone = tone;
}

function createEmptyState(message) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = message;
  return div;
}

function createTable(columns, rows) {
  if (!rows.length) {
    return createEmptyState("Nothing to show yet.");
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  for (const column of columns) {
    const th = document.createElement("th");
    th.textContent = column.label;
    headRow.appendChild(th);
  }

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const column of columns) {
      const td = document.createElement("td");
      td.textContent = String(row[column.key] ?? "");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

function renderScenarioList() {
  elements.scenarioSelect.innerHTML = "";

  for (const scenario of state.scenarios) {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = `${scenario.name} (${scenario.systemCount} systems, ${scenario.durationDays}d)`;
    elements.scenarioSelect.appendChild(option);
  }
}

async function loadScenarioIntoEditor(id) {
  const response = await fetch(`/api/scenarios/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Unable to load scenario ${id}`);
  }

  const scenario = await response.json();
  elements.scenarioEditor.value = JSON.stringify(scenario, null, 2);
}

function renderSummary(result) {
  elements.summaryGrid.innerHTML = "";

  const cards = [
    { label: "Scenario", value: result.scenario },
    { label: "Status", value: result.passed ? "Passed" : "Failed" },
    { label: "Snapshots", value: formatNumber(result.snapshots.length) },
    { label: "Assertions", value: formatNumber(result.assertions.length) },
    { label: "Range", value: `${result.startDate} to ${result.endDate}` },
    { label: "Seed", value: String(result.seed) },
  ];

  for (const card of cards) {
    const article = document.createElement("article");
    article.className = "summary-card";

    const label = document.createElement("div");
    label.className = "summary-label";
    label.textContent = card.label;

    const value = document.createElement("div");
    value.className = "summary-value";
    value.textContent = card.value;

    article.append(label, value);
    elements.summaryGrid.appendChild(article);
  }
}

function renderAssertions(result) {
  elements.assertions.innerHTML = "";

  if (!result.assertions.length) {
    elements.assertions.appendChild(createEmptyState("No assertions defined for this scenario."));
    return;
  }

  const rows = result.assertions.map((assertion) => ({
    date: assertion.at,
    path: assertion.path,
    op: assertion.op,
    expected: JSON.stringify(assertion.expected),
    actual: JSON.stringify(assertion.actual),
    pass: assertion.pass ? "pass" : "fail",
  }));

  elements.assertions.appendChild(
    createTable(
      [
        { key: "date", label: "Date" },
        { key: "path", label: "Path" },
        { key: "op", label: "Op" },
        { key: "expected", label: "Expected" },
        { key: "actual", label: "Actual" },
        { key: "pass", label: "Result" },
      ],
      rows,
    ),
  );
}

function renderSnapshot(snapshot) {
  elements.snapshotDate.textContent = snapshot.date;

  elements.factions.innerHTML = "";
  elements.factions.appendChild(
    createTable(
      [
        { key: "factionId", label: "Faction" },
        { key: "ownedSystems", label: "Systems" },
        { key: "totalShips", label: "Ships" },
        { key: "totalSaltStockpile", label: "Salt" },
        { key: "totalMetalStockpile", label: "Metals" },
        { key: "reportCount", label: "Reports" },
      ],
      Object.entries(snapshot.factions).map(([factionId, faction]) => ({
        factionId,
        ownedSystems: formatNumber(faction.ownedSystems),
        totalShips: formatNumber(faction.totalShips),
        totalSaltStockpile: formatNumber(faction.totalSaltStockpile),
        totalMetalStockpile: formatNumber(faction.totalMetalStockpile),
        reportCount: formatNumber(faction.reportCount),
      })),
    ),
  );

  elements.systems.innerHTML = "";
  elements.systems.appendChild(
    createTable(
      [
        { key: "systemId", label: "System" },
        { key: "ownerId", label: "Owner" },
        { key: "defense", label: "Defense" },
        { key: "saltStockpile", label: "Salt" },
        { key: "metalStockpile", label: "Metals" },
        { key: "captureProgress", label: "Capture" },
        { key: "claimProgress", label: "Claim" },
      ],
      Object.entries(snapshot.systems).map(([systemId, system]) => ({
        systemId,
        ownerId: system.ownerId || "open",
        defense: formatNumber(system.defense),
        saltStockpile: formatNumber(system.saltStockpile),
        metalStockpile: formatNumber(system.metalStockpile),
        captureProgress: formatNumber(system.captureProgress),
        claimProgress: formatNumber(system.claimProgress),
      })),
    ),
  );

  elements.fleets.innerHTML = "";
  elements.fleets.appendChild(
    createTable(
      [
        { key: "fleetId", label: "Fleet" },
        { key: "factionId", label: "Faction" },
        { key: "status", label: "Status" },
        { key: "ships", label: "Ships" },
        { key: "location", label: "Location" },
        { key: "mission", label: "Mission" },
        { key: "cargoSalt", label: "Cargo Salt" },
        { key: "metals", label: "Metals" },
      ],
      Object.entries(snapshot.fleets).map(([fleetId, fleet]) => ({
        fleetId,
        factionId: fleet.factionId,
        status: fleet.status,
        ships: formatNumber(fleet.ships),
        location: fleet.currentSystemId || `to ${fleet.destinationSystemId}`,
        mission: fleet.mission,
        cargoSalt: formatNumber(fleet.cargoSalt),
        metals: formatNumber(fleet.metals),
      })),
    ),
  );
}

function renderLog(result) {
  elements.log.innerHTML = "";

  if (!result.log.length) {
    elements.log.appendChild(createEmptyState("No events were recorded."));
    return;
  }

  const list = document.createElement("ol");
  list.className = "log-list";

  for (const entry of result.log.slice(-80)) {
    const item = document.createElement("li");
    item.textContent = entry;
    list.appendChild(item);
  }

  elements.log.appendChild(list);
}

function renderResult(result) {
  state.result = result;
  elements.resultSummary.textContent = result.passed
    ? "Assertions passed. Scrub the timeline to inspect how the world evolved."
    : "At least one assertion failed. Use the timeline and log to see where the scenario drifted.";

  renderSummary(result);
  renderAssertions(result);
  renderLog(result);

  elements.timelinePanel.hidden = result.snapshots.length === 0;
  elements.snapshotRange.min = "0";
  elements.snapshotRange.max = String(Math.max(0, result.snapshots.length - 1));
  elements.snapshotRange.value = "0";

  if (result.snapshots.length > 0) {
    renderSnapshot(result.snapshots[0]);
  } else {
    elements.snapshotDate.textContent = "No snapshots captured";
  }
}

async function runSimulation() {
  let scenario;

  try {
    scenario = JSON.parse(elements.scenarioEditor.value);
  } catch (error) {
    elements.resultSummary.textContent =
      error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON";
    return;
  }

  elements.resultSummary.textContent = "Running simulation...";

  const response = await fetch("/api/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(scenario),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Simulation failed");
  }

  const result = await response.json();
  renderResult(result);
}

elements.loadScenario.addEventListener("click", async () => {
  const id = elements.scenarioSelect.value;
  if (!id) {
    return;
  }

  elements.resultSummary.textContent = `Loading ${id}...`;
  await loadScenarioIntoEditor(id);
  elements.resultSummary.textContent = `Loaded ${id}. Review or edit the JSON, then run the simulation.`;
});

elements.runSimulation.addEventListener("click", async () => {
  try {
    await runSimulation();
  } catch (error) {
    elements.resultSummary.textContent =
      error instanceof Error ? error.message : "Simulation failed";
  }
});

elements.snapshotRange.addEventListener("input", (event) => {
  if (!state.result) {
    return;
  }

  const index = Number(event.target.value);
  const snapshot = state.result.snapshots[index];
  if (snapshot) {
    renderSnapshot(snapshot);
  }
});

async function init() {
  try {
    const health = await fetch("/api/health");
    if (!health.ok) {
      throw new Error("health check failed");
    }

    setApiStatus("Worker API online", "good");

    const response = await fetch("/api/scenarios");
    if (!response.ok) {
      throw new Error("scenario list failed");
    }

    const payload = await response.json();
    state.scenarios = payload.scenarios;
    renderScenarioList();

    if (state.scenarios.length > 0) {
      await loadScenarioIntoEditor(state.scenarios[0].id);
      elements.resultSummary.textContent =
        "Bundled scenario loaded. Run it as-is or tune the JSON first.";
    } else {
      elements.resultSummary.textContent = "No bundled scenarios were found.";
    }
  } catch (error) {
    setApiStatus("Worker API unavailable", "bad");
    elements.resultSummary.textContent =
      error instanceof Error ? error.message : "Unable to initialize UI";
  }
}

init();
