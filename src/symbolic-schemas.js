import { defineOverlayPipeline } from "./overlay-pipeline.js";

const DEFAULT_PROFILES_BY_COMMANDER_KIND = {
  default: {
    frame: "republic",
    doctrine: "Keep the lanes open until the decisive choice is clear.",
    values: ["order", "commerce", "knowledge"],
    voice: {
      seed: "formal",
      style: "measured civic protocol",
      signoff: "By formal dispatch",
    },
  },
  turtle: {
    frame: "house",
    doctrine: "Hold the core, answer only on favorable terms.",
    values: ["order", "survival", "discipline"],
    voice: {
      seed: "deliberate",
      style: "measured reserve",
      signoff: "By ordered measure",
    },
  },
  frontier_expander: {
    frame: "dynasty",
    doctrine: "Secure the frontier before distance hardens against us.",
    values: ["expansion", "discipline", "prestige"],
    voice: {
      seed: "expansionist",
      style: "forward campaign certainty",
      signoff: "By frontier warrant",
    },
  },
  chatty_frontier: {
    frame: "league",
    doctrine: "Gain position through quick bargains and faster movement.",
    values: ["expansion", "commerce", "knowledge"],
    voice: {
      seed: "opportunistic",
      style: "fast frontier bargaining",
      signoff: "By open channel",
    },
  },
  napoleonic: {
    frame: "dynasty",
    doctrine: "Concentrate force and decide the issue before rivals recover.",
    values: ["prestige", "discipline", "expansion"],
    voice: {
      seed: "imperious",
      style: "court-command certainty",
      signoff: "By imperial prerogative",
    },
  },
  bad_commander: {
    frame: "house",
    doctrine: "Overawe the frontier before anyone notices the seams.",
    values: ["prestige", "survival", "order"],
    voice: {
      seed: "blustering",
      style: "loud coercive posturing",
      signoff: "By hard warning",
    },
  },
};

function dedupeValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string"))];
}

function defaultProfileForCommanderKind(commanderKind) {
  const profile = DEFAULT_PROFILES_BY_COMMANDER_KIND[commanderKind] ?? DEFAULT_PROFILES_BY_COMMANDER_KIND.default;
  return {
    frame: profile.frame,
    doctrine: profile.doctrine,
    values: [...profile.values],
    voice: {
      seed: profile.voice.seed,
      style: profile.voice.style,
      signoff: profile.voice.signoff,
    },
  };
}

function commanderKindForFaction(faction, commanderProfiles) {
  if (!faction?.commanderProfileId) {
    return null;
  }

  const profile = (Array.isArray(commanderProfiles) ? commanderProfiles : []).find(
    (candidate) => candidate.id === faction.commanderProfileId,
  );
  return profile?.kind ?? null;
}

export function normalizeFactionDefinition(faction, commanderProfiles = []) {
  const fallback = defaultProfileForCommanderKind(commanderKindForFaction(faction, commanderProfiles));
  const provided = faction?.profile ?? {};

  return {
    ...faction,
    profile: {
      frame: provided.frame ?? fallback.frame,
      doctrine: provided.doctrine ?? fallback.doctrine,
      values: dedupeValues(provided.values ?? fallback.values),
      voice: {
        seed: provided.voice?.seed ?? fallback.voice.seed,
        style: provided.voice?.style ?? fallback.voice.style,
        signoff: provided.voice?.signoff ?? fallback.voice.signoff,
      },
    },
  };
}

export function normalizeScenarioSymbolicSchemas(scenario) {
  return {
    ...scenario,
    factions: (scenario?.factions ?? []).map((faction) =>
      normalizeFactionDefinition(faction, scenario?.commanderProfiles ?? [])),
  };
}

function parseDiplomaticDispatchEntries(entries, getSystemName) {
  const directives = {
    intent: null,
    subjectSystemId: null,
    subjectSystemName: null,
    demand: null,
    offer: null,
    message: null,
    notes: [],
  };

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry !== "string") {
      continue;
    }

    const separator = entry.indexOf(":");
    if (separator === -1) {
      directives.notes.push(entry.trim());
      continue;
    }

    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();

    if (key === "intent") {
      directives.intent = value || null;
    } else if (key === "subject") {
      directives.subjectSystemId = value || null;
      directives.subjectSystemName = value ? getSystemName(value) : null;
    } else if (key === "demand") {
      directives.demand = value || null;
    } else if (key === "offer") {
      directives.offer = value || null;
    } else if (key === "message") {
      directives.message = value || null;
    } else {
      directives.notes.push(entry.trim());
    }
  }

  return directives;
}

function normalizeDiplomaticIntent(intent, leverage) {
  switch (intent) {
    case "threat":
    case "threaten":
    case "ultimatum":
    case "pressure":
      return "threaten";
    case "offer":
    case "trade":
    case "conciliate":
    case "truce":
      return "offer";
    case "clarify":
    case "probe":
    case "query":
    case "request":
      return "clarify";
    default:
      return leverage === "high" ? "threaten" : "clarify";
  }
}

function diplomaticVoiceLabel(intent, voiceSeed) {
  if (intent === "threaten") {
    return voiceSeed === "deliberate" ? "Measured warning" : "Hard warning";
  }
  if (intent === "offer") {
    return voiceSeed === "opportunistic" ? "Frontier bargain" : "Terms";
  }
  return "Inquiry";
}

function diplomaticItemTone(intent, leverage) {
  if (intent === "threaten" && leverage === "high") {
    return "danger";
  }
  if (intent === "threaten") {
    return "warn";
  }
  if (intent === "offer") {
    return "info";
  }
  return "secondary";
}

function renderDiplomaticMessage(senderFactionName, directives, intent, voiceSeed, leverage) {
  if (directives.message) {
    return directives.message;
  }

  const subjectName = directives.subjectSystemName ?? "the frontier";
  const demandText = directives.demand ?? `keep clear of ${subjectName}`;
  const offerText = directives.offer ?? `trade information instead of racing blind into ${subjectName}`;

  if (intent === "threaten") {
    switch (voiceSeed) {
      case "deliberate":
        return leverage === "high"
          ? `We advise restraint around ${subjectName}. ${demandText}, and this exchange can remain a message instead of a campaign.`
          : `We would prefer calm around ${subjectName}, but continued pressure there will be answered in kind.`;
      case "opportunistic":
        return leverage === "high"
          ? `The lane around ${subjectName} is narrowing. ${demandText} before we settle the question with ships.`
          : `There is still time to step away from ${subjectName} before this frontier becomes expensive for both of us.`;
      case "imperious":
        return `Consider ${subjectName} spoken for. ${demandText}, and spare both courts the formalities of escalation.`;
      case "blustering":
        return `Back away from ${subjectName} now. Ignore this and we will answer with a heavier hand than you expect.`;
      case "expansionist":
        return `We are already moving on ${subjectName}. ${demandText} if you would rather meet our timetable by pigeon than by fleet.`;
      default:
        return `Leave ${subjectName} alone and we may avoid a larger contest.`;
    }
  }

  if (intent === "offer") {
    switch (voiceSeed) {
      case "opportunistic":
        return `A quiet frontier is still cheaper than a loud one. We can ${offerText} if you prefer leverage to remain indirect.`;
      case "deliberate":
        return `We would prefer order over waste. ${offerText}, and let distance do the cooling for us.`;
      default:
        return `There is still room to keep this limited. We can ${offerText}.`;
    }
  }

  switch (voiceSeed) {
    case "deliberate":
      return `We are watching ${subjectName} closely and would prefer to understand your intent before the frontier hardens.`;
    case "opportunistic":
      return `Before either side commits too much around ${subjectName}, tell us whether you are shaping a claim or merely screening it.`;
    default:
      return `${senderFactionName} is seeking clarity about ${subjectName}.`;
  }
}

function renderDiplomaticImplication(senderFactionName, intent, leverage) {
  if (intent === "threaten") {
    if (leverage === "high") {
      return `Envoy Tal reads this as pressure from strength. ${senderFactionName} thinks distance and force let them set the terms unless we answer quickly.`;
    }

    if (leverage === "low") {
      return `Envoy Tal reads this as a testing threat. Even if the bluff is thin, it marks where ${senderFactionName} wants our attention pinned.`;
    }

    return `Envoy Tal reads this as a probe of resolve. ${senderFactionName} is trying to move our reserve by pigeon before ships have to do the work.`;
  }

  if (intent === "offer") {
    return leverage === "high"
      ? `Envoy Tal reads this as terms offered from advantage. The deal matters less than what ${senderFactionName} thinks we are too pressed to refuse.`
      : `Envoy Tal reads this as an information play. Even a soft offer can reveal what ${senderFactionName} wants us to stop watching.`;
  }

  return `Envoy Tal treats this as reconnaissance by conversation. The wording matters, but the real signal is which system ${senderFactionName} chose to make legible.`;
}

function deriveDiplomaticPigeon({
  report,
  senderFaction,
  recipientFaction = null,
  leverage,
  getSystemName,
}) {
  const packetType = typeof report?.content?.packetType === "string" ? report.content.packetType : null;
  if (report?.type !== "dispatch" || packetType !== "diplomatic" || !senderFaction) {
    return null;
  }

  const directives = parseDiplomaticDispatchEntries(report.content.entries, getSystemName);
  const intent = normalizeDiplomaticIntent(directives.intent, leverage);
  const voiceSeed = senderFaction.profile?.voice?.seed ?? "formal";
  const voiceLabel = diplomaticVoiceLabel(intent, voiceSeed);
  const tone = diplomaticItemTone(intent, leverage);
  const destinationSystemId =
    typeof report.content.destinationSystemId === "string" ? report.content.destinationSystemId : null;
  const originSystemId = report.sourceSystemId ?? null;
  const message = renderDiplomaticMessage(senderFaction.name, directives, intent, voiceSeed, leverage);

  return {
    report,
    senderFaction,
    recipientFaction,
    leverage,
    getSystemName,
    directives,
    intent,
    tone,
    voiceSeed,
    voiceLabel,
    destinationSystemId,
    originSystemId,
    message,
  };
}

function composeDiplomaticPigeon(derived) {
  if (!derived) {
    return null;
  }

  const {
    report,
    senderFaction,
    recipientFaction,
    leverage,
    getSystemName,
    directives,
    intent,
    tone,
    voiceSeed,
    voiceLabel,
    destinationSystemId,
    originSystemId,
    message,
  } = derived;

  return {
    id: `diplomatic-pigeon:${report.id}`,
    reportId: report.id,
    date: report.availableDate,
    observedAt: report.observedAt,
    packetType: "diplomatic",
    tone,
    intent,
    leverage,
    senderFactionId: senderFaction.id,
    senderFactionName: senderFaction.name,
    senderProfile: senderFaction.profile,
    recipientFactionId: recipientFaction?.id ?? null,
    recipientFactionName: recipientFaction?.name ?? null,
    originSystemId,
    originSystemName: originSystemId ? getSystemName(originSystemId) : null,
    destinationSystemId,
    destinationSystemName: destinationSystemId ? getSystemName(destinationSystemId) : null,
    voice: {
      seed: voiceSeed,
      label: voiceLabel,
    },
    directives,
    rendered: {
      title: `${senderFaction.name} sent a ${voiceLabel.toLowerCase()} pigeon`,
      summary: `Delivered from ${originSystemId ? getSystemName(originSystemId) : "unknown origin"} to ${destinationSystemId ? getSystemName(destinationSystemId) : "unknown destination"}. ${message}`,
      analysis: renderDiplomaticImplication(senderFaction.name, intent, leverage),
      sourceLine: `${senderFaction.name} · ${voiceLabel}`,
      message,
    },
  };
}

function validateDiplomaticPigeon({ enriched }) {
  if (enriched == null) {
    return true;
  }

  return typeof enriched.id === "string"
    && enriched.packetType === "diplomatic"
    && typeof enriched.senderFactionId === "string"
    && typeof enriched.rendered?.title === "string"
    && typeof enriched.rendered?.summary === "string"
    && typeof enriched.rendered?.analysis === "string";
}

export const diplomaticPigeonOverlayPipeline = defineOverlayPipeline({
  featureId: "diplomacy",
  derive: deriveDiplomaticPigeon,
  compose: composeDiplomaticPigeon,
  validate: validateDiplomaticPigeon,
});

export async function resolveDiplomaticPigeonSchema(options, context = {}) {
  const result = await diplomaticPigeonOverlayPipeline.run(options, context);
  return result.output;
}

export function buildDiplomaticPigeonSchema(options) {
  return diplomaticPigeonOverlayPipeline.runSymbolic(options).output;
}

function relayLine(relay) {
  return relay ? `${relay.title}: ${relay.detail}` : null;
}

function buildEmptyPlan(kind, title, line, constraints) {
  return {
    id: `${kind}:pending`,
    kind,
    title,
    summary: line,
    lines: [line],
    movement: {
      originSystemId: null,
      originSystemName: null,
      destinationSystemId: null,
      destinationSystemName: null,
      travelDays: null,
      distance: null,
    },
    cost: {
      burnSalt: null,
      postLaunchSalt: null,
      probeCostSalt: null,
    },
    cargoFocus: null,
    relay: null,
    constraints,
  };
}

export function buildCommandCandidatePlan(options) {
  const kind = options.kind;
  const relay = options.relay ?? null;
  const travelDays = options.plan?.travelDays ?? null;
  const distance = options.plan?.distance ?? null;

  if ((kind === "attack" || kind === "reinforce" || kind === "blockade" || kind === "resupply" || kind === "trade")
    && !options.originSystemId) {
    return buildEmptyPlan(kind, "Choose An Origin", "Use the Origin field to choose a friendly system before drafting this order.", ["origin_required"]);
  }

  if (kind === "deploy_probe" && !options.destinationSystemId) {
    return buildEmptyPlan(kind, "Choose A Probe Target", "Select an anchor system before dispatching reconnaissance.", ["destination_required"]);
  }

  if (kind === "deploy_probe" && !options.originSystemId) {
    return buildEmptyPlan(kind, "Choose An Origin", "Select a friendly origin with salt and a ready probe to launch reconnaissance.", ["origin_required"]);
  }

  const destinationName = options.destinationSystemName ?? "No destination";
  const originName = options.originSystemName ?? null;
  const relayText = relayLine(relay);

  if (kind === "attack" || kind === "reinforce" || kind === "blockade") {
    const ships = Number(options.ships ?? 1);
    const title =
      kind === "attack" ? "Attack Order"
      : kind === "reinforce" ? "Reinforcement Order"
      : "Blockade Order";
    const intentLine =
      kind === "attack"
        ? "Intent: force a fight and pressure local control."
        : kind === "reinforce"
          ? "Intent: strengthen a friendly position before contact."
          : "Intent: hold a strategic waypoint and threaten passing starlane traffic.";
    return {
      id: `${kind}:${options.originSystemId}:${options.destinationSystemId ?? "none"}`,
      kind,
      title,
      summary: `${ships} ships from ${originName} toward ${destinationName}.`,
      lines: [
        `${ships} ships toward ${destinationName}`,
        intentLine,
        `Transit estimate: ${travelDays !== null ? options.formatTravelSpan(travelDays) : "No route"}`,
        `Projected burn cost: ${options.burnSalt !== null && options.burnSalt !== undefined ? `${options.burnSalt} salt` : "Route required"}`,
        options.postLaunchSalt !== null && options.postLaunchSalt !== undefined
          ? `Post-launch local salt: ${Math.max(0, options.postLaunchSalt)}`
          : "Post-launch local salt: unresolved until a route exists.",
        kind === "blockade"
          ? "Blockading fleets can trigger interception penalties against enemies using adjacent starlanes."
          : null,
        relayText,
      ].filter(Boolean),
      movement: {
        originSystemId: options.originSystemId,
        originSystemName: originName,
        destinationSystemId: options.destinationSystemId ?? null,
        destinationSystemName: destinationName,
        travelDays,
        distance,
      },
      cost: {
        burnSalt: options.burnSalt ?? null,
        postLaunchSalt: options.postLaunchSalt ?? null,
        probeCostSalt: null,
      },
      cargoFocus: null,
      relay,
      constraints: travelDays === null ? ["route_required"] : [],
    };
  }

  if (kind === "resupply") {
    const ships = Number(options.ships ?? 1);
    return {
      id: `${kind}:${options.originSystemId}:${options.destinationSystemId ?? "none"}`,
      kind,
      title: "Resupply Order",
      summary: `${ships} ships escorting ${options.cargoFocus ?? "salt"} toward ${destinationName}.`,
      lines: [
        `${ships} ships escort supplies toward ${destinationName}`,
        `Cargo priority: ${options.titleCase(options.cargoFocus ?? "salt")}`,
        `Transit estimate: ${travelDays !== null ? options.formatTravelSpan(travelDays) : "No route"}`,
        `Escort burn cost: ${options.burnSalt !== null && options.burnSalt !== undefined ? `${options.burnSalt} salt` : "Route required"}`,
        "Supply mass will expand in a later draft; this preview prices the escort first.",
        relayText,
      ].filter(Boolean),
      movement: {
        originSystemId: options.originSystemId,
        originSystemName: originName,
        destinationSystemId: options.destinationSystemId ?? null,
        destinationSystemName: destinationName,
        travelDays,
        distance,
      },
      cost: {
        burnSalt: options.burnSalt ?? null,
        postLaunchSalt: null,
        probeCostSalt: null,
      },
      cargoFocus: options.cargoFocus ?? null,
      relay,
      constraints: travelDays === null ? ["route_required"] : [],
    };
  }

  if (kind === "deploy_probe") {
    const probeStatus = options.probeStatus ?? null;
    return {
      id: `${kind}:${options.originSystemId}:${options.destinationSystemId}`,
      kind,
      title: "Probe Mission",
      summary: `Launch 1 probe from ${originName} toward ${destinationName}.`,
      lines: [
        `Target: ${destinationName}`,
        `Origin: ${originName}`,
        `Estimated arrival: ${options.formatTravelSpan(travelDays ?? 0)}`,
        `Cost: ${options.probeCostSalt} salt`,
        "Requires: 1 ready probe in origin stores",
        "Dispatch from this dock to launch the probe immediately.",
        probeStatus?.status === "in_transit"
          ? probeStatus.label
          : "Probes narrow uncertainty around approach lanes and turns.",
        relayText,
      ].filter(Boolean),
      movement: {
        originSystemId: options.originSystemId,
        originSystemName: originName,
        destinationSystemId: options.destinationSystemId,
        destinationSystemName: destinationName,
        travelDays,
        distance,
      },
      cost: {
        burnSalt: null,
        postLaunchSalt: null,
        probeCostSalt: options.probeCostSalt ?? null,
      },
      cargoFocus: null,
      relay,
      constraints: travelDays === null ? ["route_required"] : [],
    };
  }

  return {
    id: `${kind}:${options.originSystemId}:${options.destinationSystemId ?? "none"}`,
    kind,
    title: "Trade Run",
    summary: `${originName} to ${destinationName}.`,
    lines: [
      `${originName} to ${destinationName}`,
      `Cargo priority: ${options.titleCase(options.cargoFocus ?? "salt")}`,
      `Transit estimate: ${travelDays !== null ? options.formatTravelSpan(travelDays) : "No route"}`,
      `Local production: ${options.localProduction ?? "Unknown production"}`,
      relayText,
    ].filter(Boolean),
    movement: {
      originSystemId: options.originSystemId,
      originSystemName: originName,
      destinationSystemId: options.destinationSystemId ?? null,
      destinationSystemName: destinationName,
      travelDays,
      distance,
    },
    cost: {
      burnSalt: null,
      postLaunchSalt: null,
      probeCostSalt: null,
    },
    cargoFocus: options.cargoFocus ?? null,
    relay,
    constraints: travelDays === null ? ["route_required"] : [],
  };
}
