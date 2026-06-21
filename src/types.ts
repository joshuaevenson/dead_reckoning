export type StarType =
  | "red_dwarf"
  | "yellow_star"
  | "white_blue_star"
  | "giant_or_exotic";

export type SaltProfile = "none" | "trace" | "productive" | "major";

export type MetalRichness = "poor" | "standard" | "rich" | "exceptional";

export type Mission = "attack" | "reinforce" | "resupply" | "trade" | "blockade";

export type FleetAction = "engage" | "hold" | "retreat" | "resupply";

export type FleetStatus = "stationed" | "transit" | "destroyed";

export type ReportType =
  | "intel"
  | "telescope_departure"
  | "telescope_arrival"
  | "probe_sighting"
  | "survey"
  | "combat"
  | "dispatch";

export type CouncilTone =
  | "info"
  | "warn"
  | "danger"
  | "success"
  | "secondary"
  | "contrast";

export type CouncilActorKind = "advisor" | "commander";

export type CouncilBeliefAccess = "direct" | "briefed" | "received";

export type CouncilBeliefPosture = "urgent" | "watchful" | "steady" | "opportunity";

export type CouncilBeliefConfidence = "high" | "medium" | "low";

export type CouncilCauseKey =
  | "probe_cover"
  | "late_probe"
  | "route_blockade"
  | "intercepted_approach"
  | "reserve_stripped"
  | "local_overmatch"
  | "capture_pressure"
  | "open_claim_window";

export type ComparisonOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export type TradeFocus =
  | "buys_metals_pays_salt"
  | "buys_salt_pays_metals";

export type CommanderProfileKind =
  | "turtle"
  | "frontier_expander"
  | "chatty_frontier"
  | "napoleonic"
  | "bad_commander";

export type FactionProfileFrame =
  | "house"
  | "corporation"
  | "republic"
  | "cult"
  | "dynasty"
  | "league";

export type FactionProfileValue =
  | "expansion"
  | "order"
  | "secrecy"
  | "commerce"
  | "discipline"
  | "prestige"
  | "survival"
  | "knowledge";

export type FactionVoiceSeed =
  | "formal"
  | "deliberate"
  | "opportunistic"
  | "imperious"
  | "blustering"
  | "expansionist";

export type DiplomaticIntent = "clarify" | "threaten" | "offer";

export type DiplomaticLeverage = "low" | "balanced" | "high";

export type CandidatePlanKind =
  | "attack"
  | "reinforce"
  | "blockade"
  | "resupply"
  | "deploy_probe"
  | "trade";

export type RuntimeAiMode = "off" | "simulated" | "enabled";

export type RuntimeAiProviderId = "symbolic" | "simulated" | "openai";

export type RuntimeAiProviderStatus =
  | "inactive"
  | "simulated"
  | "available"
  | "unconfigured";

export type RuntimeCapabilityBaseline = "symbolic" | "scenario_seeded";

export type OverlayPipelineStage = "derive" | "compose" | "enrich" | "validate";

export interface SystemPosition {
  x: number;
  y: number;
}

export interface RouteDefinition {
  id: string;
  a: string;
  b: string;
  distance: number;
  travelDays: number;
  headingFromA?: string;
  headingFromB?: string;
}

export interface RuleCondition {
  lhs: string;
  op: ComparisonOperator;
  rhs: number | string;
}

export interface FleetRule {
  condition: RuleCondition;
  action: FleetAction;
}

export interface FleetOrder {
  originSystemId?: string;
  destinationSystemId: string;
  retreatSystemId?: string;
  repeatIntervalDays?: number;
  returnToOrigin?: boolean;
}

export interface FleetState {
  id: string;
  name: string;
  factionId: string;
  ships: number;
  mission: Mission;
  status: FleetStatus;
  currentSystemId?: string;
  destinationSystemId?: string;
  originSystemId?: string;
  departureDate?: string;
  arrivalDate?: string;
  burnSaltRemaining: number;
  cargoSalt: number;
  metals: number;
  routeDistanceRemaining: number;
  routeTravelDaysRemaining: number;
  routeHeading?: string;
  usesStarlane?: boolean;
  travelSegmentIds?: string[];
  travelPathSystemIds?: string[];
  interceptedCombatDaysRemaining?: number;
  interceptedByFactionId?: string;
  retreatSystemId?: string;
  launchVisibleToOthers: boolean;
  rules: FleetRule[];
  tradeOrder?: FleetOrder;
  lastAction?: FleetAction;
}

export interface ProbeState {
  id: string;
  factionId: string;
  status: "transit" | "deployed" | "destroyed";
  originSystemId: string;
  departureDate?: string;
  currentSystemId?: string;
  anchorSystemId: string;
  arrivalDate?: string;
  watchedRouteId?: string;
  watchedStarlaneId?: string;
  watchedCorridorSystemId?: string;
  watchedSystemApproachId?: string;
  reportDestinationSystemId: string;
  reportSaltReserve: number;
  durability: number;
}

export interface PigeonDispatch {
  senderFactionId: string;
  recipientFactionId: string;
  packetType: "intel" | "orders" | "diplomatic" | "logistics";
  entries: string[];
}

export interface FactionProfileVoice {
  seed: FactionVoiceSeed;
  style: string;
  signoff: string;
}

export interface FactionProfile {
  frame: FactionProfileFrame;
  doctrine: string;
  values: FactionProfileValue[];
  voice: FactionProfileVoice;
}

export interface PigeonState {
  id: string;
  factionId: string;
  originSystemId: string;
  destinationSystemId: string;
  arrivalDate: string;
  dispatch: PigeonDispatch;
}

export interface Report {
  id: string;
  type: ReportType;
  factionId: string;
  availableDate: string;
  observedAt: string;
  sourceSystemId?: string;
  probeId?: string;
  burnType?: "departure" | "arrival";
  estimatedFleetMass?: number;
  initialHeading?: string;
  possibleDestinations?: string[];
  content: Record<string, unknown>;
}

export interface CouncilEvidence {
  id: string;
  date: string;
  eventType: string;
  kicker: string;
  title: string;
  summary: string;
  analysis: string;
  tone: CouncilTone;
  advisorSource?: string;
  sourceLine?: string;
  senderFactionId?: string;
  voiceLabel?: string;
  friendlySource?: boolean;
  sourceActorId?: string | null;
  sourceActorName?: string | null;
  sourceActorRole?: string | null;
  causes?: CouncilCause[];
  causeSummary?: string;
  strategicCallbacks?: CouncilStrategicCallback[];
  strategicPriority?: number;
}

export interface CouncilCause {
  key: CouncilCauseKey;
  label: string;
  detail: string;
  severity: CouncilTone;
}

export interface CouncilStrategicCallback {
  systemId: string;
  systemName: string;
  markingValue: string;
  markingLabel: string;
  severity: CouncilTone;
  headline: string;
  summary: string;
  prompt: string;
  priority: number;
}

export interface CouncilActor {
  id: string;
  kind: CouncilActorKind;
  label: string;
  name: string;
  role: string;
  specialty: string;
}

export interface CouncilBelief {
  id: string;
  actorId: string;
  evidenceId: string;
  access: CouncilBeliefAccess;
  posture: CouncilBeliefPosture;
  stance: string;
  stanceLabel: string;
  confidence: CouncilBeliefConfidence;
  confidenceLabel: string;
  confidenceSeverity: CouncilTone;
  summary: string;
  reasoning: string;
  causeSummary?: string;
}

export interface CouncilNote {
  id: string;
  date: string;
  kicker: string;
  title: string;
  summary: string;
  analysis: string;
  tone: CouncilTone;
  stance: string;
  stanceLabel: string;
  confidence: CouncilBeliefConfidence;
  confidenceLabel: string;
  confidenceSeverity: CouncilTone;
  reasoning: string;
  causes?: CouncilCause[];
  causeSummary?: string;
  actorId: string;
  actorKind: CouncilActorKind;
  actorLabel: string;
  actorName: string;
  actorRole: string;
  advisorId: string;
  advisorName: string;
  advisorRole: string;
  advisorSource?: string;
  sourceLine?: string;
  senderFactionId?: string;
  voiceLabel?: string;
  sourceEvidenceId: string;
  sourceTitle: string;
  sourceSummary: string;
  strategicCallbacks?: CouncilStrategicCallback[];
  strategicPriority?: number;
}

export interface CouncilSourceLedgerItem {
  id: string;
  date: string;
  kicker: string;
  title: string;
  summary: string;
  tone: CouncilTone;
  sourceLine?: string;
  strategicCallbacks?: CouncilStrategicCallback[];
  strategicPriority?: number;
}

export interface CouncilCompositionResult {
  actors: CouncilActor[];
  beliefs: CouncilBelief[];
  notes: CouncilNote[];
  sourceLedger: CouncilSourceLedgerItem[];
}

export interface FactionState {
  id: string;
  name: string;
  homeSystemId: string;
  commanderProfileId?: string;
  commanderMemory: Record<string, unknown>;
  reports: Report[];
}

export interface BuildOrder {
  id: string;
  factionId: string;
  systemId: string;
  kind: "ship" | "defense" | "probe";
  quantity: number;
  completeDate: string;
}

export interface SystemDefinition {
  id: string;
  name: string;
  position: SystemPosition;
  starType: StarType;
  saltProfile?: SaltProfile;
  metalRichness: MetalRichness;
  starlaneLinks?: string[];
  ownerId: string | null;
  saltStockpile: number;
  metalStockpile: number;
  probeStockpile?: number;
  infrastructure: number;
  defense: number;
  controlAgeDays: number;
  tradeFocus?: TradeFocus;
  tradeRate?: number;
  tradeCapacity?: number;
  tradeCapacityMax?: number;
  garrisonShips?: Record<string, number>;
}

export interface SystemState extends SystemDefinition {
  captureProgress: number;
  captureAttackerId: string | null;
  claimProgress: number;
  claimingFactionId: string | null;
}

export interface FactionDefinition {
  id: string;
  name: string;
  homeSystemId: string;
  commanderProfileId?: string;
  profile?: FactionProfile;
}

export interface DiplomaticDirectiveSet {
  intent: DiplomaticIntent | null;
  subjectSystemId: string | null;
  subjectSystemName: string | null;
  demand: string | null;
  offer: string | null;
  message: string | null;
  notes: string[];
}

export interface DiplomaticPigeonSchema {
  id: string;
  reportId: string;
  date: string;
  observedAt: string;
  packetType: "diplomatic";
  tone: CouncilTone;
  intent: DiplomaticIntent;
  leverage: DiplomaticLeverage;
  senderFactionId: string;
  senderFactionName: string;
  senderProfile: FactionProfile;
  recipientFactionId: string | null;
  recipientFactionName: string | null;
  originSystemId: string | null;
  originSystemName: string | null;
  destinationSystemId: string | null;
  destinationSystemName: string | null;
  voice: {
    seed: FactionVoiceSeed;
    label: string;
  };
  directives: DiplomaticDirectiveSet;
  rendered: {
    title: string;
    summary: string;
    analysis: string;
    sourceLine: string;
    message: string;
  };
}

export interface CommandCandidatePlan {
  id: string;
  kind: CandidatePlanKind;
  title: string;
  summary: string;
  lines: string[];
  movement: {
    originSystemId: string | null;
    originSystemName: string | null;
    destinationSystemId: string | null;
    destinationSystemName: string | null;
    travelDays: number | null;
    distance: number | null;
  };
  cost: {
    burnSalt: number | null;
    postLaunchSalt: number | null;
    probeCostSalt: number | null;
  };
  cargoFocus: "salt" | "metals" | null;
  relay: {
    title: string;
    detail: string;
  } | null;
  constraints: string[];
}

export interface RecapEntry {
  id: string;
  date: string;
  kind: "combat" | "control" | "intel" | "diplomacy" | "logistics";
  title: string;
  summary: string;
  consequence: string;
  followUp: string;
  evidenceIds: string[];
}

export interface DoctrineProposal {
  id: string;
  date: string;
  title: string;
  summary: string;
  rationale: string;
  originatingActorId: string;
  stance: "adopt" | "revise" | "defer";
  principles: string[];
  evidenceIds: string[];
}

export interface CommanderProfileDefinition {
  id: string;
  kind: CommanderProfileKind;
  options?: Record<string, number | string | boolean>;
}

export interface InitialFleetDefinition {
  id: string;
  name: string;
  factionId: string;
  currentSystemId: string;
  ships: number;
  mission?: Mission;
  cargoSalt?: number;
  metals?: number;
  retreatSystemId?: string;
  rules?: FleetRule[];
}

export interface LaunchFleetCommand {
  type: "launch_fleet";
  at: string;
  factionId: string;
  originSystemId: string;
  destinationSystemId: string;
  ships: number;
  cargoSalt?: number;
  metals?: number;
  mission?: Mission;
  retreatSystemId?: string;
  rules?: FleetRule[];
  name?: string;
}

export interface SendPigeonCommand {
  type: "send_pigeon";
  at: string;
  factionId: string;
  originSystemId: string;
  destinationSystemId: string;
  recipientFactionId: string;
  packetType: "intel" | "orders" | "diplomatic" | "logistics";
  entries: string[];
}

export interface DeployProbeCommand {
  type: "deploy_probe";
  at: string;
  factionId: string;
  originSystemId: string;
  anchorSystemId: string;
  reportDestinationSystemId: string;
  watchedRouteId?: string;
  watchedStarlaneId?: string;
  watchedCorridorSystemId?: string;
  watchedSystemApproachId?: string;
  reportSaltReserve?: number;
  name?: string;
}

export interface BuildCommand {
  type: "build";
  at: string;
  factionId: string;
  systemId: string;
  kind: "ship" | "defense" | "probe";
  quantity: number;
}

export interface CommandTurnFleet {
  type: "turn_fleet";
  at: string;
  fleetId: string;
  destinationSystemId: string;
}

export type ScenarioCommand =
  | LaunchFleetCommand
  | SendPigeonCommand
  | DeployProbeCommand
  | BuildCommand
  | CommandTurnFleet;

export type ExpectationOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "includes";

export interface ScenarioExpectation {
  at: string;
  path: string;
  op: ExpectationOperator;
  value: unknown;
}

export interface InitialReportDefinition {
  factionId: string;
  type: ReportType;
  observedAt: string;
  sourceSystemId?: string;
  probeId?: string;
  burnType?: "departure" | "arrival";
  estimatedFleetMass?: number;
  initialHeading?: string;
  possibleDestinations?: string[];
  content: Record<string, unknown>;
}

export interface ScenarioDefinition {
  name: string;
  seed: number;
  startDate: string;
  durationDays: number;
  commanderProfiles?: CommanderProfileDefinition[];
  factions: FactionDefinition[];
  systems: SystemDefinition[];
  routes?: RouteDefinition[];
  fleets?: InitialFleetDefinition[];
  initialReports?: InitialReportDefinition[];
  commands?: ScenarioCommand[];
  expectations?: ScenarioExpectation[];
}

export interface SnapshotSystemView {
  ownerId: string | null;
  saltStockpile: number;
  metalStockpile: number;
  probeStockpile: number;
  defense: number;
  controlAgeDays: number;
  captureProgress: number;
  claimProgress: number;
}

export interface SnapshotFleetView {
  factionId: string;
  ships: number;
  status: FleetStatus;
  currentSystemId?: string;
  destinationSystemId?: string;
  originSystemId?: string;
  departureDate?: string;
  arrivalDate?: string;
  cargoSalt: number;
  metals: number;
  mission: Mission;
  usesStarlane?: boolean;
  travelPathSystemIds?: string[];
  interceptedCombatDaysRemaining?: number;
  interceptedByFactionId?: string;
  launchVisibleToOthers: boolean;
}

export interface SnapshotProbeView {
  factionId: string;
  status: ProbeState["status"];
  originSystemId?: string;
  departureDate?: string;
  currentSystemId?: string;
  anchorSystemId: string;
  arrivalDate?: string;
  watchedRouteId?: string;
  watchedStarlaneId?: string;
  watchedCorridorSystemId?: string;
  watchedSystemApproachId?: string;
}

export interface SnapshotFactionView {
  reportCount: number;
  ownedSystems: number;
  totalSaltStockpile: number;
  totalMetalStockpile: number;
  totalShips: number;
}

export interface SimulationSnapshot {
  date: string;
  systems: Record<string, SnapshotSystemView>;
  fleets: Record<string, SnapshotFleetView>;
  probes: Record<string, SnapshotProbeView>;
  factions: Record<string, SnapshotFactionView>;
}

export interface RuntimeCapabilitySurface {
  id: string;
  label: string;
  baseline: RuntimeCapabilityBaseline;
  summary: string;
  overlayPipeline?: {
    entryPoint: string;
    stages: OverlayPipelineStage[];
  };
}

export interface RuntimeCapabilities {
  summary: string;
  ai: {
    requestedMode: RuntimeAiMode;
    mode: RuntimeAiMode;
    label: string;
    summary: string;
    provider: {
      id: RuntimeAiProviderId;
      label: string;
      status: RuntimeAiProviderStatus;
      summary: string;
    };
    fallback?: {
      mode: RuntimeAiMode;
      reason: string;
    };
  };
  surfaces: RuntimeCapabilitySurface[];
}

export interface AssertionResult {
  at: string;
  path: string;
  op: ExpectationOperator;
  expected: unknown;
  actual: unknown;
  pass: boolean;
}

export interface SimulationResult {
  scenario: string;
  seed: number;
  startDate: string;
  endDate: string;
  assertions: AssertionResult[];
  passed: boolean;
  snapshots: SimulationSnapshot[];
  log: string[];
  reportsByFactionId: Record<string, Report[]>;
  runtimeCapabilities?: RuntimeCapabilities;
}
