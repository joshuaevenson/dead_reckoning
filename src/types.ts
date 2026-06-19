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
}
