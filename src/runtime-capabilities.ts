import type { RuntimeAiMode, RuntimeCapabilities } from "./types.js";

export const RUNTIME_AI_MODE_HEADER = "x-runtime-ai-mode";

const DEFAULT_RUNTIME_AI_MODE: RuntimeAiMode = "off";

const RUNTIME_CAPABILITY_SURFACES: RuntimeCapabilities["surfaces"] = [
  {
    id: "advisor_desk",
    label: "Advisor Desk",
    baseline: "symbolic",
    summary:
      "Council evidence, beliefs, and split advisor takes are derived from simulation reports and role-specific template logic.",
    overlayPipeline: {
      entryPoint: "composeCouncilStateFromEvidence",
      stages: ["derive", "compose", "enrich", "validate"],
    },
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
      "Delivered pigeons and diplomatic stance boards use canonical faction profiles, leverage rules, and deterministic voice templates.",
    overlayPipeline: {
      entryPoint: "buildDiplomaticPigeonSchema",
      stages: ["derive", "compose", "enrich", "validate"],
    },
  },
  {
    id: "identity",
    label: "Faction Identity",
    baseline: "scenario_seeded",
    summary:
      "Current faction identity comes from scenario-authored faction profiles and symbolic defaults rather than runtime text generation.",
  },
  {
    id: "opening_loop",
    label: "Opening Loop",
    baseline: "symbolic",
    summary:
      "The opportunity, threat, and lesson brief is assembled from map state, markings, reports, diplomacy, and probe coverage heuristics.",
  },
];

export function normalizeRuntimeAiMode(value: unknown): RuntimeAiMode | null {
  if (value === "off" || value === "simulated" || value === "enabled") {
    return value;
  }

  return null;
}

export function buildRuntimeCapabilities(
  requestedMode: RuntimeAiMode = DEFAULT_RUNTIME_AI_MODE,
): RuntimeCapabilities {
  if (requestedMode === "simulated") {
    return {
      summary:
        "The product is running against the symbolic baseline while keeping the overlay entry points live in simulated mode for local and test-time enrichment.",
      ai: {
        requestedMode,
        mode: "simulated",
        label: "AI Simulated",
        summary:
          "No external model calls are required, but AI-shaped surfaces execute through the same overlay interfaces used by live enrichment.",
        provider: {
          id: "simulated",
          label: "Simulated Overlay",
          status: "simulated",
          summary:
            "Developer-supplied enrichers can exercise advisor and diplomacy overlays without network dependencies.",
        },
      },
      surfaces: RUNTIME_CAPABILITY_SURFACES,
    };
  }

  if (requestedMode === "enabled") {
    return {
      summary:
        "A live AI mode was requested, but no provider is configured yet, so the product fell back to the symbolic baseline without changing any gameplay-facing interfaces.",
      ai: {
        requestedMode,
        mode: "off",
        label: "AI Fallback",
        summary:
          "Live enrichment is not configured in this repo yet. The worker and UI remain on the deterministic symbolic baseline.",
        provider: {
          id: "openai",
          label: "Live Provider",
          status: "unconfigured",
          summary:
            "Wire a live provider into the overlay boundary before enabled mode can execute runtime enrichment.",
        },
        fallback: {
          mode: "off",
          reason: "No live AI provider is configured.",
        },
      },
      surfaces: RUNTIME_CAPABILITY_SURFACES,
    };
  }

  return {
    summary:
      "The current product runs in an explicit AI-off mode. Advisor notes, reports, diplomacy, opening guidance, and faction identity all resolve through deterministic data, heuristics, and templates, with shared overlay boundaries ready for optional enrichment later.",
    ai: {
      requestedMode: "off",
      mode: "off",
      label: "AI Off",
      summary:
        "No model calls are required for the current command table. The worker and UI run entirely on deterministic simulation, stored profiles, and symbolic composition.",
      provider: {
        id: "symbolic",
        label: "Symbolic Baseline",
        status: "inactive",
        summary:
          "All current player-facing surfaces resolve through deterministic state, heuristics, and templates only.",
      },
    },
    surfaces: RUNTIME_CAPABILITY_SURFACES,
  };
}

export function runtimeCapabilitiesForRequest(request: Request): RuntimeCapabilities {
  const url = new URL(request.url);
  const requestedMode =
    normalizeRuntimeAiMode(url.searchParams.get("ai"))
    ?? normalizeRuntimeAiMode(request.headers.get(RUNTIME_AI_MODE_HEADER))
    ?? DEFAULT_RUNTIME_AI_MODE;

  return buildRuntimeCapabilities(requestedMode);
}

export const runtimeCapabilities = buildRuntimeCapabilities();
