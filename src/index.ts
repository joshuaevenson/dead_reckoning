import type { ScenarioDefinition } from "./types.js";
import { scenarioCatalog } from "./generated/scenario-catalog.js";
import { simulateScenario } from "./simulator.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      return Response.json({ ok: true, service: "dead-reckoning-worker" });
    }

    if (request.method === "GET" && url.pathname === "/api/scenarios") {
      const scenarios = Object.entries(scenarioCatalog).map(([id, scenario]) => ({
        id,
        name: scenario.name,
        startDate: scenario.startDate,
        durationDays: scenario.durationDays,
        factionCount: scenario.factions.length,
        systemCount: scenario.systems.length,
      }));

      return Response.json({ scenarios });
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/scenarios/")) {
      const scenarioId = decodeURIComponent(url.pathname.replace("/api/scenarios/", ""));
      const scenario = scenarioCatalog[scenarioId];

      if (!scenario) {
        return Response.json({ error: `Unknown scenario ${scenarioId}` }, { status: 404 });
      }

      return Response.json(scenario);
    }

    if (
      request.method === "POST" &&
      (url.pathname === "/simulate" || url.pathname === "/api/simulate")
    ) {
      const scenario = (await request.json()) as ScenarioDefinition;
      const result = simulateScenario(scenario);
      return Response.json(result);
    }

    return new Response("Not found", { status: 404 });
  },
};
