const COUNCIL_ACTOR_PROFILES = {
  marshal: {
    id: "marshal",
    kind: "advisor",
    label: "Advisor",
    name: "Marshal Hale",
    role: "Fleet Consequences",
    specialty: "campaigns",
  },
  spymaster: {
    id: "spymaster",
    kind: "advisor",
    label: "Advisor",
    name: "Spymaster Vey",
    role: "Reconnaissance",
    specialty: "reconnaissance",
  },
  steward: {
    id: "steward",
    kind: "advisor",
    label: "Advisor",
    name: "Steward Sen",
    role: "Logistics",
    specialty: "logistics",
  },
  envoy: {
    id: "envoy",
    kind: "advisor",
    label: "Advisor",
    name: "Envoy Tal",
    role: "Signals",
    specialty: "signals",
  },
  line_command: {
    id: "line_command",
    kind: "commander",
    label: "Commander",
    name: "Commodore Vale",
    role: "Field Command",
    specialty: "line",
  },
  recon_command: {
    id: "recon_command",
    kind: "commander",
    label: "Commander",
    name: "Scout Captain Neral",
    role: "Recon Wing",
    specialty: "recon",
  },
  convoy_command: {
    id: "convoy_command",
    kind: "commander",
    label: "Commander",
    name: "Captain Oris",
    role: "Convoy Command",
    specialty: "convoy",
  },
};

function cloneActor(profile, overrides = {}) {
  return {
    ...profile,
    name: overrides.name ?? profile.name,
    role: overrides.role ?? profile.role,
  };
}

export function getCouncilActorProfile(actorId) {
  return COUNCIL_ACTOR_PROFILES[actorId] ?? COUNCIL_ACTOR_PROFILES.envoy;
}

const COUNCIL_CONFIDENCE = {
  high: {
    label: "High confidence",
    severity: "success",
  },
  medium: {
    label: "Medium confidence",
    severity: "info",
  },
  low: {
    label: "Low confidence",
    severity: "secondary",
  },
};

function confidenceMetadata(confidence) {
  return COUNCIL_CONFIDENCE[confidence] ?? COUNCIL_CONFIDENCE.medium;
}

function primaryAdvisorActorIdForEvidence(evidence) {
  switch (evidence?.eventType) {
    case "recon_launch":
    case "recon_station":
      return "spymaster";
    case "trade_signal":
    case "supply_convoy":
    case "frontier_claim":
    case "expansion_burn":
    case "reinforcement_burn":
      return "steward";
    case "incoming_threat":
    case "attack_burn":
    case "blockade_burn":
    case "battle_report":
    case "control_shift":
    case "arrival_burn":
      return "marshal";
    default:
      return "envoy";
  }
}

function commanderActorIdForEvidence(evidence) {
  switch (evidence?.eventType) {
    case "recon_launch":
    case "recon_station":
      return "recon_command";
    case "trade_signal":
    case "supply_convoy":
      return "convoy_command";
    case "reinforcement_burn":
    case "incoming_threat":
    case "attack_burn":
    case "battle_report":
    case "control_shift":
    case "frontier_claim":
    case "arrival_burn":
      return "line_command";
    default:
      return null;
  }
}

function beliefPostureForEvidence(evidence) {
  if (evidence?.tone === "danger") {
    return "urgent";
  }
  if (evidence?.tone === "success") {
    return "opportunity";
  }
  if (evidence?.tone === "warn") {
    return "watchful";
  }
  return "steady";
}

function defaultTakeForActor(actor) {
  switch (actor.id) {
    case "marshal":
      return {
        stance: "set_tempo",
        stanceLabel: "Set the tempo",
        confidence: "high",
      };
    case "spymaster":
      return {
        stance: "collapse_uncertainty",
        stanceLabel: "Collapse uncertainty",
        confidence: "high",
      };
    case "steward":
      return {
        stance: "secure_supply",
        stanceLabel: "Secure supply",
        confidence: "high",
      };
    case "envoy":
      return {
        stance: "read_the_signal",
        stanceLabel: "Read the signal",
        confidence: "medium",
      };
    default:
      return {
        stance: "local_response",
        stanceLabel: "Local response",
        confidence: "high",
      };
  }
}

function advisorTakeSpecsForEvidence(evidence) {
  const primaryActorId = primaryAdvisorActorIdForEvidence(evidence);
  if (evidence?.friendlySource) {
    return [{ actorId: primaryActorId }];
  }

  switch (evidence?.eventType) {
    case "incoming_threat":
    case "attack_burn":
    case "blockade_burn":
    case "arrival_burn":
      return [
        {
          actorId: "marshal",
          stance: "meet_force",
          stanceLabel: "Meet force",
          confidence: "high",
        },
        {
          actorId: "steward",
          stance: "preserve_reserve",
          stanceLabel: "Preserve reserve",
          confidence: "medium",
        },
      ];
    case "battle_report":
    case "control_shift":
      return [
        {
          actorId: "marshal",
          stance: "press_tempo",
          stanceLabel: "Press tempo",
          confidence: "high",
        },
        {
          actorId: "steward",
          stance: "rebuild_position",
          stanceLabel: "Rebuild position",
          confidence: "medium",
        },
      ];
    case "frontier_claim":
    case "expansion_burn":
      return [
        {
          actorId: "steward",
          stance: "secure_foothold",
          stanceLabel: "Secure foothold",
          confidence: "high",
        },
        {
          actorId: "marshal",
          stance: "screen_before_extend",
          stanceLabel: "Screen before extend",
          confidence: "medium",
        },
      ];
    case "diplomatic_pigeon":
      return [
        {
          actorId: "envoy",
          stance: "test_intent",
          stanceLabel: "Test intent",
          confidence: "medium",
        },
        {
          actorId: "marshal",
          stance: "show_resolve",
          stanceLabel: "Show resolve",
          confidence: "low",
        },
      ];
    default:
      return [{ actorId: primaryActorId }];
  }
}

function buildTake(spec, evidence) {
  const actorProfile = getCouncilActorProfile(spec.actorId);
  const actor = cloneActor(actorProfile, spec.actorOverrides);
  const defaults = defaultTakeForActor(actor);
  const confidence = spec.confidence ?? defaults.confidence;
  const confidenceInfo = confidenceMetadata(confidence);

  return {
    actor,
    stance: spec.stance ?? defaults.stance,
    stanceLabel: spec.stanceLabel ?? defaults.stanceLabel,
    confidence,
    confidenceLabel: confidenceInfo.label,
    confidenceSeverity: confidenceInfo.severity,
  };
}

function takesForEvidence(evidence) {
  const takes = advisorTakeSpecsForEvidence(evidence).map((spec) => buildTake(spec, evidence));

  if (evidence?.friendlySource) {
    const commanderActorId = commanderActorIdForEvidence(evidence);
    if (commanderActorId) {
      takes.unshift(buildTake({
        actorId: commanderActorId,
        actorOverrides: {
          name: evidence.sourceActorName ?? undefined,
          role: evidence.sourceActorRole ?? undefined,
        },
      }, evidence));
    }
  }

  return takes;
}

function beliefAccessForActor(actor, evidence) {
  if (actor.kind === "commander") {
    return "direct";
  }
  return evidence?.friendlySource ? "briefed" : "received";
}

function beliefReasoningForActor(actor, evidence, take) {
  if (actor.kind === "commander") {
    return `${actor.name} is speaking from a local command channel tied to the source event and is pushing ${take.stanceLabel.toLowerCase()}.`;
  }
  if (evidence?.friendlySource) {
    return `${actor.name} is reading a council-facing brief derived from subordinate reporting and favors ${take.stanceLabel.toLowerCase()}.`;
  }
  return `${actor.name} is interpreting a delivered signal that reached the council desk and favors ${take.stanceLabel.toLowerCase()}.`;
}

function beliefSummaryForActor(actor, evidence, take) {
  if (actor.kind === "commander") {
    return `${actor.name} believes this source event changes local action immediately and warrants ${take.stanceLabel.toLowerCase()}.`;
  }
  return `${actor.name} believes this source event changes imperial priorities beyond the immediate contact and warrants ${take.stanceLabel.toLowerCase()}.`;
}

function advisorConsequenceForEvidence(evidence, actor) {
  switch (`${actor.id}:${evidence?.eventType}`) {
    case "marshal:incoming_threat":
    case "marshal:attack_burn":
      return `${actor.name} frames this as tempo pressure. If we answer from the wrong reserve, the attacker chooses both the fight and the follow-up.`;
    case "steward:incoming_threat":
    case "steward:attack_burn":
      return `${actor.name} warns against matching this ship for ship by reflex. If we strip depots and relief routes to answer the first punch, the second one lands harder.`;
    case "marshal:blockade_burn":
      return `${actor.name} warns that this is about lane control, not only local ships. If the blockade sticks, movement through the lane gets riskier and slower to answer.`;
    case "steward:blockade_burn":
      return `${actor.name} sees a supply contest first. A blockade that starves couriers and stores can break our timing even before it breaks a fleet.`;
    case "marshal:battle_report":
      return `${actor.name} says the lesson is not just who traded well, but who can seize the next beat before losses harden into a retreat.`;
    case "steward:battle_report":
      return `${actor.name} is looking past the exchange to replacement depth. Whoever can refill salt, repair, and hulls first owns the more durable result.`;
    case "marshal:control_shift":
      return `${actor.name} treats this as a tempo chain: once local control broke, nearby lanes and relief timings tilted with it.`;
    case "steward:control_shift":
      return `${actor.name} treats the transfer as unfinished until stores, courier rhythm, and local repair all change hands as well.`;
    case "marshal:frontier_claim":
    case "marshal:expansion_burn":
      return `${actor.name} wants a screen before celebration. A new foothold is useful only if it does not invite a cleaner counterstroke than the gain was worth.`;
    case "steward:frontier_claim":
    case "steward:expansion_burn":
      return `${actor.name} says frontier gains snowball. A quiet claim today becomes extra salt, extra options, and harder eviction tomorrow.`;
    case "marshal:arrival_burn":
      return `${actor.name} says arrivals matter because they pin choices. A force landing in place can force us to defend the system and the nearby lane at the same time.`;
    case "steward:arrival_burn":
      return `${actor.name} cares less about the landing than the sustainment behind it. If that force can be fed and screened, the position hardens before our answer arrives.`;
    case "envoy:diplomatic_pigeon":
      return `${actor.name} treats the packet as a probe of intent. The language matters less than which commitments it tries to make us reveal too early.`;
    case "marshal:diplomatic_pigeon":
      return `${actor.name} reads the packet as leverage theater. Even a soft phrase can be trying to buy time for a harder move elsewhere.`;
    default:
      break;
  }

  switch (evidence?.kicker) {
    case "Recon launched":
      return `${actor.name} says the real gain is warning time: once the probe arrives, we stop defending every rumor at once.`;
    case "Recon on station":
      return `${actor.name} says this closes a blind angle, which means future enemy burns here can be answered with commitment instead of guesswork.`;
    case "Trade signal":
      return `${actor.name} reads this as compounding strength: quiet cargo runs often decide who can afford the decisive move later.`;
    case "Supply convoy":
      return `${actor.name} reads endurance here. If the convoy lands cleanly, the target can absorb pressure longer than its fleet count alone suggests.`;
    case "Blockade burn":
      return `${actor.name} warns that this is about lane control, not only local ships. If the blockade sticks, movement through the lane gets riskier and slower to answer.`;
    case "Reinforcement burn":
      return `${actor.name} reads a posture shift. Reinforcements make the next fight cheaper for them and more expensive for anyone arriving late.`;
    case "Expansion burn":
    case "Frontier claim":
      return `${actor.name} says frontier gains snowball. A quiet claim today becomes extra salt, extra options, and harder eviction tomorrow.`;
    case "Incoming threat":
    case "Attack burn":
      return `${actor.name} frames this as tempo pressure. If we answer from the wrong reserve, the attacker chooses both the fight and the follow-up.`;
    case "Battle report":
      return `${actor.name} says the lesson is not just who traded well, but who can replace losses first and keep control after the shooting stops.`;
    case "Control shift":
      return `${actor.name} treats this as a consequence chain: once local control broke, ownership followed immediately and the surrounding lane picture changed with it.`;
    case "Arrival burn":
      return `${actor.name} says arrivals matter because they pin choices. A force landing in place can force us to defend the system and the nearby lane at the same time.`;
    default:
      return evidence?.analysis ?? "";
  }
}

function commanderConsequenceForEvidence(evidence, actor) {
  switch (evidence?.eventType) {
    case "recon_launch":
      return `${actor.name} wants the lane kept quiet until the probe settles. Early warning matters more than one fast guess.`;
    case "recon_station":
      return `${actor.name} reports that the blind approach has narrowed. That certainty is only useful if we act before the picture goes stale.`;
    case "trade_signal":
      return `${actor.name} considers this shipment part of the campaign, not background traffic. Quiet stores are what let later operations stay in motion.`;
    case "supply_convoy":
      return `${actor.name} is trying to thicken endurance at the destination. If the salt lands cleanly, the next decision there gets easier for us.`;
    case "reinforcement_burn":
      return `${actor.name} is committing ships to make the next local fight cheaper. Follow-through matters more now than spectacle elsewhere.`;
    case "incoming_threat":
    case "attack_burn":
      return `${actor.name} reads this as a test of reaction time. If we answer from the wrong reserve, the enemy chooses the whole rhythm of the exchange.`;
    case "battle_report":
      return `${actor.name} is judging whether the line can stand a second shock. Losses only matter in context of who can recover first.`;
    case "control_shift":
      return `${actor.name} treats the new control as provisional until courier lines, stores, and relief routes are secure.`;
    case "frontier_claim":
      return `${actor.name} views the claim as a foothold that needs immediate support before it can become durable strength.`;
    case "arrival_burn":
      return `${actor.name} has put force in place. What matters next is whether the landing can be supplied, screened, and reinforced before the enemy answers.`;
    default:
      return evidence?.analysis ?? "";
  }
}

function causeSuffixForEvidence(evidence) {
  return evidence?.causeSummary ? ` Drivers: ${evidence.causeSummary}` : "";
}

function strategicSummarySuffixForEvidence(evidence) {
  const callbacks = evidence?.strategicCallbacks ?? [];
  if (callbacks.length === 0) {
    return "";
  }

  return ` Strategic callback: ${callbacks.map((callback) => callback.summary).join(" ")}`;
}

function strategicPromptSuffixForEvidence(evidence) {
  const callbacks = evidence?.strategicCallbacks ?? [];
  if (callbacks.length === 0) {
    return "";
  }

  return ` Follow-up: ${callbacks.map((callback) => callback.prompt).join(" ")}`;
}

function buildBelief(take, evidence) {
  const { actor } = take;
  return {
    id: `${actor.id}:${evidence.id}:belief`,
    actorId: actor.id,
    evidenceId: evidence.id,
    access: beliefAccessForActor(actor, evidence),
    posture: beliefPostureForEvidence(evidence),
    stance: take.stance,
    stanceLabel: take.stanceLabel,
    confidence: take.confidence,
    confidenceLabel: take.confidenceLabel,
    confidenceSeverity: take.confidenceSeverity,
    summary: beliefSummaryForActor(actor, evidence, take),
    reasoning: `${beliefReasoningForActor(actor, evidence, take)}${strategicPromptSuffixForEvidence(evidence)}`,
    causeSummary: evidence.causeSummary,
  };
}

function buildNote(take, evidence) {
  const { actor } = take;
  const baseAnalysis =
    actor.kind === "commander"
      ? commanderConsequenceForEvidence(evidence, actor)
      : advisorConsequenceForEvidence(evidence, actor);
  const analysis = `${baseAnalysis}${causeSuffixForEvidence(evidence)}${strategicSummarySuffixForEvidence(evidence)}`;

  return {
    id: `${evidence.id}:${actor.id}:note`,
    date: evidence.date,
    kicker: evidence.kicker,
    title: evidence.title,
    summary: evidence.summary,
    analysis,
    tone: evidence.tone,
    stance: take.stance,
    stanceLabel: take.stanceLabel,
    confidence: take.confidence,
    confidenceLabel: take.confidenceLabel,
    confidenceSeverity: take.confidenceSeverity,
    reasoning: `${beliefReasoningForActor(actor, evidence, take)}${strategicPromptSuffixForEvidence(evidence)}`,
    causes: evidence.causes ?? [],
    causeSummary: evidence.causeSummary,
    actorId: actor.id,
    actorKind: actor.kind,
    actorLabel: actor.label,
    actorName: actor.name,
    actorRole: actor.role,
    advisorId: actor.id,
    advisorName: actor.name,
    advisorRole: actor.role,
    advisorSource: evidence.advisorSource ?? evidence.kicker,
    sourceLine: evidence.sourceLine,
    senderFactionId: evidence.senderFactionId,
    voiceLabel: evidence.voiceLabel,
    sourceEvidenceId: evidence.id,
    sourceTitle: evidence.title,
    sourceSummary: evidence.summary,
    strategicCallbacks: evidence.strategicCallbacks ?? [],
    strategicPriority: evidence.strategicPriority ?? 0,
  };
}

function buildSourceLedger(evidenceItems) {
  return evidenceItems
    .filter((item) => item.eventType !== "diplomatic_pigeon")
    .map((item) => ({
      id: `source:${item.id}`,
      date: item.date,
      kicker: item.kicker,
      title: item.title,
      summary: item.summary,
      tone: item.tone,
      sourceLine: item.sourceLine ?? item.kicker,
      strategicCallbacks: item.strategicCallbacks ?? [],
      strategicPriority: item.strategicPriority ?? 0,
    }));
}

export function composeCouncilStateFromEvidence(evidenceItems) {
  const actorsById = new Map();
  const beliefs = [];
  const notes = [];

  for (const evidence of evidenceItems) {
    for (const take of takesForEvidence(evidence)) {
      const { actor } = take;
      if (!actorsById.has(actor.id)) {
        actorsById.set(actor.id, actor);
      }
      beliefs.push(buildBelief(take, evidence));
      notes.push(buildNote(take, evidence));
    }
  }

  return {
    actors: [...actorsById.values()],
    beliefs,
    notes,
    sourceLedger: buildSourceLedger(evidenceItems),
  };
}
