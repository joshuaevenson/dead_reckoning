import type { RuntimeCapabilities } from "./types.js";

export const runtimeCapabilities: RuntimeCapabilities = {
  summary:
    "The current product runs in an explicit AI-off mode. Advisor notes, reports, diplomacy, opening guidance, and faction identity all resolve through deterministic data, heuristics, and templates.",
  ai: {
    mode: "off",
    label: "AI Off",
    summary:
      "No model calls are required for the current command table. The worker and UI run entirely on deterministic simulation, stored profiles, and symbolic composition.",
  },
  surfaces: [
    {
      id: "advisor_desk",
      label: "Advisor Desk",
      baseline: "symbolic",
      summary:
        "Council evidence, beliefs, and split advisor takes are derived from simulation reports and role-specific template logic.",
    },
    {
      id: "reports",
      label: "Reports",
      baseline: "symbolic",
      summary:
        "Morning briefs, council inbox items, source ledgers, and after-action explanations are composed without generated prose.",
    },
    {
      id: "diplomacy",
      label: "Diplomacy",
      baseline: "symbolic",
      summary:
        "Delivered pigeons and diplomatic stance boards use commander profiles, leverage rules, and deterministic voice templates.",
    },
    {
      id: "identity",
      label: "Faction Identity",
      baseline: "scenario_seeded",
      summary:
        "Current faction identity comes from scenario-authored faction names and commander profiles rather than runtime text generation.",
    },
    {
      id: "opening_loop",
      label: "Opening Loop",
      baseline: "symbolic",
      summary:
        "The opportunity, threat, and lesson brief is assembled from map state, markings, reports, diplomacy, and probe coverage heuristics.",
    },
  ],
};
