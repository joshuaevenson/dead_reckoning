import { RouteGraph } from "./graph.js";
import { Rng } from "./rng.js";
import type {
  AssertionResult,
  BuildOrder,
  CommanderProfileDefinition,
  CommanderProfileKind,
  DeployProbeCommand,
  ExpectationOperator,
  FactionState,
  FleetAction,
  FleetOrder,
  FleetRule,
  FleetState,
  InitialReportDefinition,
  LaunchFleetCommand,
  Mission,
  PigeonDispatch,
  PigeonState,
  ProbeState,
  Report,
  ScenarioCommand,
  ScenarioDefinition,
  ScenarioExpectation,
  SimulationResult,
  SimulationSnapshot,
  SnapshotFactionView,
  SnapshotFleetView,
  SnapshotProbeView,
  SnapshotSystemView,
  SystemState,
} from "./types.js";
import { addDays, ceil, clamp, deepClone, diffDays, getByPath, round } from "./utils.js";

const SHIP_MASS = 5;
const DEFENSE_POWER = 3;
const HOLD_BONUS = 0.15;
const CONTEST_THRESHOLD = 3;
const SHIP_BUILD_SALT = 5;
const SHIP_BUILD_METAL = 10;
const SHIP_BUILD_TIME = 2;
const DEFENSE_BUILD_SALT = 10;
const DEFENSE_BUILD_METAL = 25;
const DEFENSE_BUILD_TIME = 5;
const PROBE_COST_SALT = 2;
const PROBE_COST_METAL = 2;

type PendingReport = {
  deliverDate: string;
  report: Report;
};

type PerceivedRouteOption = {
  originSystemId: string;
  distance: number;
  travelDays: number;
};

type PerceivedSystemIntel = {
  systemId: string;
  starType?: SystemState["starType"];
  metalRichness?: SystemState["metalRichness"];
  knownOwnerId?: string | null;
  knownShips?: number;
  knownDefense?: number;
  lastObservedAt?: string;
  routeOptions: PerceivedRouteOption[];
  threatScore: number;
};

type PerceivedState = {
  factionId: string;
  homeSystemId: string;
  ownedSystems: SystemState[];
  ownFleets: FleetState[];
  systems: Map<string, PerceivedSystemIntel>;
  reports: Report[];
};

export function simulateScenario(scenario: ScenarioDefinition): SimulationResult {
  const engine = new SimulationEngine(scenario);
  return engine.run();
}

class SimulationEngine {
  private readonly rng: Rng;
  private readonly graph: RouteGraph;
  private readonly scenario: ScenarioDefinition;
  private readonly systems = new Map<string, SystemState>();
  private readonly factions = new Map<string, FactionState>();
  private readonly fleets = new Map<string, FleetState>();
  private readonly probes = new Map<string, ProbeState>();
  private readonly pigeons = new Map<string, PigeonState>();
  private readonly buildOrders = new Map<string, BuildOrder>();
  private readonly pendingReports: PendingReport[] = [];
  private readonly commandsByDate = new Map<string, ScenarioCommand[]>();
  private readonly commanderProfiles = new Map<string, CommanderProfileDefinition>();
  private readonly snapshots: SimulationSnapshot[] = [];
  private readonly log: string[] = [];
  private idCounter = 1;

  constructor(scenario: ScenarioDefinition) {
    this.scenario = deepClone(scenario);
    this.rng = new Rng(scenario.seed);
    this.graph = new RouteGraph(scenario.routes);

    for (const profile of scenario.commanderProfiles ?? []) {
      this.commanderProfiles.set(profile.id, profile);
    }

    for (const faction of scenario.factions) {
      this.factions.set(faction.id, {
        id: faction.id,
        name: faction.name,
        homeSystemId: faction.homeSystemId,
        commanderProfileId: faction.commanderProfileId,
        commanderMemory: {},
        reports: [],
      });
    }

    for (const report of scenario.initialReports ?? []) {
      this.seedInitialReport(report);
    }

    for (const system of scenario.systems) {
      this.systems.set(system.id, {
        ...system,
        captureProgress: 0,
        captureAttackerId: null,
        claimProgress: 0,
        claimingFactionId: null,
        tradeCapacityMax: system.tradeCapacityMax ?? system.tradeCapacity ?? 0,
      });

      for (const [factionId, ships] of Object.entries(system.garrisonShips ?? {})) {
        if (ships > 0) {
          this.createStationedFleet({
            id: `${system.id}-${factionId}-garrison`,
            name: `${system.name} Garrison`,
            factionId,
            currentSystemId: system.id,
            ships,
            mission: "reinforce",
            cargoSalt: 0,
            metals: 0,
            retreatSystemId: undefined,
            rules: [],
          });
        }
      }
    }

    for (const fleet of scenario.fleets ?? []) {
      this.createStationedFleet({
        id: fleet.id,
        name: fleet.name,
        factionId: fleet.factionId,
        currentSystemId: fleet.currentSystemId,
        ships: fleet.ships,
        mission: fleet.mission ?? "reinforce",
        cargoSalt: fleet.cargoSalt ?? 0,
        metals: fleet.metals ?? 0,
        retreatSystemId: fleet.retreatSystemId,
        rules: fleet.rules ?? [],
      });
    }

    for (const command of scenario.commands ?? []) {
      const entries = this.commandsByDate.get(command.at) ?? [];
      entries.push(command);
      this.commandsByDate.set(command.at, entries);
    }
  }

  run(): SimulationResult {
    for (let dayOffset = 0; dayOffset < this.scenario.durationDays; dayOffset += 1) {
      const date = addDays(this.scenario.startDate, dayOffset);
      this.processBuildCompletions(date);
      this.processArrivals(date);
      this.deliverReports(date);
      this.executeCommands(date);
      this.executeAutonomousProfiles(date);
      this.processProduction(date);
      this.processCombat(date);
      this.processControl(date);
      this.incrementControlAge();
      this.recordSnapshot(date);
    }

    const assertions = this.evaluateAssertions();
    const endDate = addDays(this.scenario.startDate, this.scenario.durationDays - 1);

    return {
      scenario: this.scenario.name,
      seed: this.scenario.seed,
      startDate: this.scenario.startDate,
      endDate,
      assertions,
      passed: assertions.every((assertion) => assertion.pass),
      snapshots: this.snapshots,
      log: this.log,
    };
  }

  private seedInitialReport(report: InitialReportDefinition): void {
    this.requireFaction(report.factionId).reports.push({
      id: this.nextId("report"),
      type: report.type,
      factionId: report.factionId,
      availableDate: this.scenario.startDate,
      observedAt: report.observedAt,
      sourceSystemId: report.sourceSystemId,
      probeId: report.probeId,
      burnType: report.burnType,
      estimatedFleetMass: report.estimatedFleetMass,
      initialHeading: report.initialHeading,
      possibleDestinations: report.possibleDestinations,
      content: report.content,
    });
  }

  private processBuildCompletions(date: string): void {
    for (const [buildOrderId, order] of this.buildOrders.entries()) {
      if (order.completeDate !== date) {
        continue;
      }

      const system = this.requireSystem(order.systemId);
      if (order.kind === "ship") {
        const garrison = this.ensureGarrisonFleet(order.systemId, order.factionId);
        garrison.ships += order.quantity;
        this.log.push(
          `${date}: ${order.factionId} completed ${order.quantity} ship(s) at ${order.systemId}`,
        );
      } else {
        system.defense += order.quantity;
        this.log.push(
          `${date}: ${order.factionId} completed ${order.quantity} defense at ${order.systemId}`,
        );
      }
      this.buildOrders.delete(buildOrderId);
    }
  }

  private processArrivals(date: string): void {
    for (const fleet of this.fleets.values()) {
      if (fleet.status === "transit" && fleet.arrivalDate === date) {
        fleet.status = "stationed";
        fleet.currentSystemId = fleet.destinationSystemId;
        fleet.originSystemId = undefined;
        fleet.departureDate = undefined;
        fleet.routeDistanceRemaining = 0;
        fleet.routeTravelDaysRemaining = 0;
        fleet.burnSaltRemaining = 0;
        this.log.push(`${date}: fleet ${fleet.id} arrived at ${fleet.currentSystemId}`);
        this.scheduleSurveyReport(date, fleet);
        this.scheduleTelescopeBurnReports(date, fleet.currentSystemId!, "arrival", fleet);
        this.handleArrivalMission(date, fleet);
      }
    }

    for (const probe of this.probes.values()) {
      if (probe.status === "transit" && probe.arrivalDate === date) {
        probe.status = "deployed";
        probe.currentSystemId = probe.anchorSystemId;
        probe.arrivalDate = undefined;
        this.log.push(`${date}: probe ${probe.id} deployed at ${probe.anchorSystemId}`);
      }
    }

    for (const [pigeonId, pigeon] of this.pigeons.entries()) {
      if (pigeon.arrivalDate !== date) {
        continue;
      }
      const report: Report = {
        id: this.nextId("report"),
        type: "dispatch",
        factionId: pigeon.dispatch.recipientFactionId,
        availableDate: date,
        observedAt: date,
        sourceSystemId: pigeon.originSystemId,
        content: {
          packetType: pigeon.dispatch.packetType,
          senderFactionId: pigeon.dispatch.senderFactionId,
          entries: pigeon.dispatch.entries,
        },
      };
      this.requireFaction(pigeon.dispatch.recipientFactionId).reports.push(report);
      this.pigeons.delete(pigeonId);
      this.log.push(`${date}: pigeon ${pigeon.id} delivered to ${pigeon.destinationSystemId}`);
    }
  }

  private deliverReports(date: string): void {
    for (let index = this.pendingReports.length - 1; index >= 0; index -= 1) {
      const pending = this.pendingReports[index];
      if (pending.deliverDate !== date) {
        continue;
      }
      this.requireFaction(pending.report.factionId).reports.push(pending.report);
      this.pendingReports.splice(index, 1);
      this.log.push(`${date}: report ${pending.report.id} delivered to ${pending.report.factionId}`);
    }
  }

  private executeCommands(date: string): void {
    for (const command of this.commandsByDate.get(date) ?? []) {
      switch (command.type) {
        case "launch_fleet":
          this.executeLaunchFleet(date, command);
          break;
        case "send_pigeon":
          this.executeSendPigeon(date, command.factionId, {
            senderFactionId: command.factionId,
            recipientFactionId: command.recipientFactionId,
            packetType: command.packetType,
            entries: command.entries,
          }, command.originSystemId, command.destinationSystemId);
          break;
        case "deploy_probe":
          this.executeDeployProbe(date, command);
          break;
        case "build":
          this.executeBuild(date, command);
          break;
        case "turn_fleet":
          this.executeTurnFleet(date, command.fleetId, command.destinationSystemId);
          break;
      }
    }
  }

  private executeAutonomousProfiles(date: string): void {
    for (const faction of this.factions.values()) {
      if (!faction.commanderProfileId) {
        continue;
      }

      const profile = this.commanderProfiles.get(faction.commanderProfileId);
      if (!profile) {
        throw new Error(`Unknown commander profile ${faction.commanderProfileId}`);
      }

      const perceivedState = this.buildPerceivedState(faction.id);

      switch (profile.kind) {
        case "turtle":
          this.runTurtleProfile(date, faction.id, profile, perceivedState);
          break;
        case "frontier_expander":
          this.runFrontierExpanderProfile(date, faction.id, profile, perceivedState, false);
          break;
        case "chatty_frontier":
          this.runFrontierExpanderProfile(date, faction.id, profile, perceivedState, true);
          break;
        case "napoleonic":
          this.runNapoleonicProfile(date, faction.id, profile, perceivedState);
          break;
        case "bad_commander":
          this.runBadCommanderProfile(date, faction.id, profile, perceivedState);
          break;
      }
    }
  }

  private executeLaunchFleet(date: string, command: LaunchFleetCommand): void {
    const system = this.requireSystem(command.originSystemId);
    if (system.saltStockpile < 0) {
      throw new Error(`System ${system.id} is in an invalid salt state`);
    }

    const plan = this.graph.getPlan(command.originSystemId, command.destinationSystemId);
    const desiredCargoSalt = command.cargoSalt ?? 0;
    const metals = command.metals ?? 0;
    const requiredBurnSalt = this.requiredBurnSalt(command.ships, desiredCargoSalt, metals, plan.distance);
    const totalDepartureSalt = requiredBurnSalt + desiredCargoSalt;

    if (system.saltStockpile < totalDepartureSalt) {
      throw new Error(
        `${command.factionId} cannot launch from ${command.originSystemId}; needs ${totalDepartureSalt} salt`,
      );
    }

    this.withdrawShipsFromSystem(command.originSystemId, command.factionId, command.ships);
    system.saltStockpile -= totalDepartureSalt;

    const fleetId = this.nextId("fleet");
    const fleet: FleetState = {
      id: fleetId,
      name: command.name ?? fleetId,
      factionId: command.factionId,
      ships: command.ships,
      mission: command.mission ?? "attack",
      status: "transit",
      originSystemId: command.originSystemId,
      destinationSystemId: command.destinationSystemId,
      departureDate: date,
      arrivalDate: addDays(date, plan.travelDays),
      burnSaltRemaining: requiredBurnSalt,
      cargoSalt: desiredCargoSalt,
      metals,
      routeDistanceRemaining: plan.distance,
      routeTravelDaysRemaining: plan.travelDays,
      routeHeading: plan.heading,
      retreatSystemId: command.retreatSystemId,
      rules: command.rules ?? [],
    };

    this.fleets.set(fleet.id, fleet);
    this.log.push(
      `${date}: ${command.factionId} launched ${fleet.id} from ${command.originSystemId} to ${command.destinationSystemId}`,
    );

    this.scheduleTelescopeBurnReports(date, command.originSystemId, "departure", fleet);
    this.scheduleProbeSightings(date, fleet, plan.firstRouteId);
  }

  private executeSendPigeon(
    date: string,
    factionId: string,
    dispatch: PigeonDispatch,
    originSystemId: string,
    destinationSystemId: string,
  ): void {
    const origin = this.requireSystem(originSystemId);
    if (origin.ownerId !== factionId) {
      throw new Error(`Faction ${factionId} does not control ${originSystemId}`);
    }
    if (origin.saltStockpile < 1) {
      throw new Error(`System ${originSystemId} lacks salt for pigeon dispatch`);
    }

    origin.saltStockpile -= 1;
    const plan = this.graph.getPlan(originSystemId, destinationSystemId);
    const pigeon: PigeonState = {
      id: this.nextId("pigeon"),
      factionId,
      originSystemId,
      destinationSystemId,
      arrivalDate: addDays(date, plan.travelDays),
      dispatch,
    };
    this.pigeons.set(pigeon.id, pigeon);
    this.log.push(`${date}: ${factionId} sent pigeon ${pigeon.id} to ${destinationSystemId}`);
  }

  private executeDeployProbe(date: string, command: DeployProbeCommand): void {
    const origin = this.requireSystem(command.originSystemId);
    if (origin.ownerId !== command.factionId) {
      throw new Error(`Faction ${command.factionId} does not control ${command.originSystemId}`);
    }
    if (origin.saltStockpile < PROBE_COST_SALT || origin.metalStockpile < PROBE_COST_METAL) {
      throw new Error(`System ${origin.id} lacks resources to deploy a probe`);
    }

    origin.saltStockpile -= PROBE_COST_SALT;
    origin.metalStockpile -= PROBE_COST_METAL;

    const plan = this.graph.getPlan(command.originSystemId, command.anchorSystemId);
    const probe: ProbeState = {
      id: this.nextId("probe"),
      factionId: command.factionId,
      status: plan.travelDays === 0 ? "deployed" : "transit",
      currentSystemId: plan.travelDays === 0 ? command.anchorSystemId : undefined,
      anchorSystemId: command.anchorSystemId,
      arrivalDate: plan.travelDays === 0 ? undefined : addDays(date, plan.travelDays),
      watchedRouteId: command.watchedRouteId,
      watchedSystemApproachId: command.watchedSystemApproachId,
      reportDestinationSystemId: command.reportDestinationSystemId,
      reportSaltReserve: command.reportSaltReserve ?? 1,
      durability: 2,
    };

    this.probes.set(probe.id, probe);
    this.log.push(`${date}: ${command.factionId} deployed probe ${probe.id}`);
  }

  private executeBuild(
    date: string,
    command: Extract<ScenarioCommand, { type: "build" }>,
  ): void {
    const system = this.requireSystem(command.systemId);
    if (system.ownerId !== command.factionId) {
      throw new Error(`Faction ${command.factionId} does not control ${command.systemId}`);
    }

    const saltCost =
      command.kind === "ship"
        ? SHIP_BUILD_SALT * command.quantity
        : DEFENSE_BUILD_SALT * command.quantity;
    const metalCost =
      command.kind === "ship"
        ? SHIP_BUILD_METAL * command.quantity
        : DEFENSE_BUILD_METAL * command.quantity;
    const buildTime =
      command.kind === "ship" ? SHIP_BUILD_TIME : DEFENSE_BUILD_TIME;

    if (system.saltStockpile < saltCost || system.metalStockpile < metalCost) {
      throw new Error(`System ${command.systemId} lacks resources for ${command.kind}`);
    }

    system.saltStockpile -= saltCost;
    system.metalStockpile -= metalCost;

    const order: BuildOrder = {
      id: this.nextId("build"),
      factionId: command.factionId,
      systemId: command.systemId,
      kind: command.kind,
      quantity: command.quantity,
      completeDate: addDays(date, buildTime),
    };

    this.buildOrders.set(order.id, order);
    this.log.push(`${date}: ${command.factionId} queued ${command.quantity} ${command.kind} at ${command.systemId}`);
  }

  private executeTurnFleet(date: string, fleetId: string, destinationSystemId: string): void {
    const fleet = this.requireFleet(fleetId);
    if (fleet.status !== "transit" || !fleet.originSystemId || !fleet.destinationSystemId || !fleet.departureDate) {
      throw new Error(`Fleet ${fleetId} is not in transit and cannot turn`);
    }

    const elapsedDays = diffDays(fleet.departureDate, date);
    const totalTravelDays = Math.max(1, diffDays(fleet.departureDate, fleet.arrivalDate!));
    const remainingFraction = clamp(0, 1, 1 - elapsedDays / totalTravelDays);
    const remainingDistance = fleet.routeDistanceRemaining * remainingFraction;
    const effectiveMass = this.effectiveMass(fleet.ships, fleet.cargoSalt, fleet.metals);
    const remainingBurnSalt = ceil(remainingDistance * effectiveMass);
    const courseChangePenalty = Math.max(2, ceil(0.25 * remainingBurnSalt));

    if (fleet.burnSaltRemaining < remainingBurnSalt + courseChangePenalty) {
      this.log.push(`${date}: fleet ${fleetId} failed to turn for lack of salt`);
      return;
    }

    fleet.burnSaltRemaining -= courseChangePenalty;
    const newPlan = this.graph.getPlan(fleet.destinationSystemId, destinationSystemId);
    fleet.destinationSystemId = destinationSystemId;
    fleet.routeDistanceRemaining = newPlan.distance;
    fleet.routeTravelDaysRemaining = newPlan.travelDays;
    fleet.arrivalDate = addDays(date, newPlan.travelDays);
    fleet.routeHeading = newPlan.heading;
    this.log.push(`${date}: fleet ${fleetId} turned toward ${destinationSystemId}`);
    this.scheduleProbeSightings(date, fleet, newPlan.firstRouteId);
  }

  private processProduction(date: string): void {
    for (const system of this.systems.values()) {
      if (system.ownerId) {
        const saltBase = this.baseSaltOutput(system.starType);
        const metalBase = this.baseMetalOutput(system.metalRichness);
        const dailySalt = round(saltBase * this.rng.between(0.9, 1.1));
        const dailyMetal = round(metalBase * this.rng.between(0.95, 1.05));
        system.saltStockpile += dailySalt;
        system.metalStockpile += dailyMetal;
        this.log.push(`${date}: ${system.id} produced ${dailySalt} salt and ${dailyMetal} metals`);
      }

      if (system.tradeCapacityMax && system.tradeCapacity !== undefined) {
        system.tradeCapacity = Math.min(system.tradeCapacityMax, system.tradeCapacity + 1);
      }
    }
  }

  private processCombat(date: string): void {
    for (const system of this.systems.values()) {
      const factionsPresent = this.presentFactions(system.id);
      if (factionsPresent.length < 2) {
        continue;
      }

      const defenderFactionId =
        (system.ownerId && factionsPresent.includes(system.ownerId)) ? system.ownerId : factionsPresent[0];
      const attackerFactionId = factionsPresent.find((factionId) => factionId !== defenderFactionId);
      if (!attackerFactionId) {
        continue;
      }

      const attackerShips = this.totalShipsAtSystem(system.id, attackerFactionId);
      const defenderShips = this.totalShipsAtSystem(system.id, defenderFactionId);
      const defenderBasePower = defenderShips + (system.ownerId === defenderFactionId ? system.defense * DEFENSE_POWER : 0);
      const defenderEffectivePower =
        system.ownerId === defenderFactionId
          ? defenderBasePower * (1 + HOLD_BONUS)
          : defenderBasePower;
      const attackerEffectivePower = attackerShips;

      if (attackerEffectivePower <= 0 || defenderEffectivePower <= 0) {
        continue;
      }

      const attackerRoll = attackerEffectivePower * this.rng.between(0.9, 1.1);
      const defenderRoll = defenderEffectivePower * this.rng.between(0.9, 1.1);
      const attackerLossFraction = clamp(0.15, 0.85, defenderRoll / (attackerRoll + defenderRoll));
      const defenderLossFraction = clamp(0.15, 0.85, attackerRoll / (attackerRoll + defenderRoll));
      const attackerShipLosses = Math.min(attackerShips, ceil(attackerShips * attackerLossFraction * 0.5));
      const defenderShipLosses = Math.min(defenderShips, ceil(defenderShips * defenderLossFraction * 0.5));
      const defenseLosses =
        system.ownerId === defenderFactionId
          ? Math.min(system.defense, ceil(system.defense * defenderLossFraction * 0.35))
          : 0;

      this.applyShipLosses(system.id, attackerFactionId, attackerShipLosses);
      this.applyShipLosses(system.id, defenderFactionId, defenderShipLosses);
      system.defense = Math.max(0, system.defense - defenseLosses);

      this.scheduleCombatReports(date, system.id, attackerFactionId, defenderFactionId, attackerShipLosses, defenderShipLosses, defenseLosses);
      this.log.push(
        `${date}: combat at ${system.id}; attacker ${attackerFactionId} lost ${attackerShipLosses}, defender ${defenderFactionId} lost ${defenderShipLosses}`,
      );

      this.evaluateFleetDecisions(date, system.id);
      this.removeDestroyedFleets();
    }
  }

  private processControl(date: string): void {
    for (const system of this.systems.values()) {
      const powers = this.controlPowers(system.id);
      const ownerPower = system.ownerId ? (powers[system.ownerId] ?? 0) : 0;
      const hostileEntries = Object.entries(powers)
        .filter(([factionId]) => factionId !== system.ownerId)
        .sort((left, right) => right[1] - left[1]);
      const leadingHostile = hostileEntries[0];

      if (!system.ownerId) {
        const meaningful = hostileEntries.filter(([, power]) => power >= CONTEST_THRESHOLD);
        if (meaningful.length === 1) {
          const [claimantId] = meaningful[0];
          if (system.claimingFactionId !== claimantId) {
            system.claimingFactionId = claimantId;
            system.claimProgress = 0;
          }
          system.claimProgress += 1;
          const claimDuration = 3 + ceil(system.infrastructure / 10);
          if (system.claimProgress >= claimDuration) {
            system.ownerId = claimantId;
            system.controlAgeDays = 0;
            system.claimProgress = 0;
            system.claimingFactionId = null;
            this.log.push(`${date}: ${claimantId} claimed open system ${system.id}`);
          }
        }
        continue;
      }

      if (
        leadingHostile &&
        leadingHostile[1] >= CONTEST_THRESHOLD &&
        ownerPower < CONTEST_THRESHOLD
      ) {
        const attackerId = leadingHostile[0];
        if (system.captureAttackerId !== attackerId) {
          system.captureAttackerId = attackerId;
          system.captureProgress = 0;
        }
        system.captureProgress += 1;
        const captureDuration =
          7 + ceil(system.infrastructure / 5) + Math.min(21, Math.floor(system.controlAgeDays / 30));
        if (system.captureProgress >= captureDuration) {
          system.ownerId = attackerId;
          system.controlAgeDays = 0;
          system.captureProgress = 0;
          system.captureAttackerId = null;
          this.log.push(`${date}: ${attackerId} captured ${system.id}`);
        }
      } else if (ownerPower >= CONTEST_THRESHOLD) {
        system.captureProgress = 0;
        system.captureAttackerId = null;
      }
    }
  }

  private incrementControlAge(): void {
    for (const system of this.systems.values()) {
      if (system.ownerId) {
        system.controlAgeDays += 1;
      }
    }
  }

  private recordSnapshot(date: string): void {
    const systems: Record<string, SnapshotSystemView> = {};
    for (const system of this.systems.values()) {
      systems[system.id] = {
        ownerId: system.ownerId,
        saltStockpile: system.saltStockpile,
        metalStockpile: system.metalStockpile,
        defense: system.defense,
        controlAgeDays: system.controlAgeDays,
        captureProgress: system.captureProgress,
        claimProgress: system.claimProgress,
      };
    }

    const fleets: Record<string, SnapshotFleetView> = {};
    for (const fleet of this.fleets.values()) {
      fleets[fleet.id] = {
        factionId: fleet.factionId,
        ships: fleet.ships,
        status: fleet.status,
        currentSystemId: fleet.currentSystemId,
        destinationSystemId: fleet.destinationSystemId,
        cargoSalt: fleet.cargoSalt,
        metals: fleet.metals,
        mission: fleet.mission,
      };
    }

    const probes: Record<string, SnapshotProbeView> = {};
    for (const probe of this.probes.values()) {
      if (probe.status === "destroyed") {
        continue;
      }
      probes[probe.id] = {
        factionId: probe.factionId,
        status: probe.status,
        currentSystemId: probe.currentSystemId,
        anchorSystemId: probe.anchorSystemId,
        watchedRouteId: probe.watchedRouteId,
        watchedSystemApproachId: probe.watchedSystemApproachId,
      };
    }

    const factions: Record<string, SnapshotFactionView> = {};
    for (const faction of this.factions.values()) {
      const ownedSystems = [...this.systems.values()].filter((system) => system.ownerId === faction.id);
      factions[faction.id] = {
        reportCount: faction.reports.length,
        ownedSystems: ownedSystems.length,
        totalSaltStockpile: ownedSystems.reduce((total, system) => total + system.saltStockpile, 0),
        totalMetalStockpile: ownedSystems.reduce((total, system) => total + system.metalStockpile, 0),
        totalShips: [...this.fleets.values()]
          .filter((fleet) => fleet.factionId === faction.id && fleet.status !== "destroyed")
          .reduce((total, fleet) => total + fleet.ships, 0),
      };
    }

    this.snapshots.push({
      date,
      systems,
      fleets,
      probes,
      factions,
    });
  }

  private evaluateAssertions(): AssertionResult[] {
    const snapshotByDate = new Map(this.snapshots.map((snapshot) => [snapshot.date, snapshot]));

    return (this.scenario.expectations ?? []).map((expectation) => {
      const snapshot = snapshotByDate.get(expectation.at);
      if (!snapshot) {
        return {
          at: expectation.at,
          path: expectation.path,
          op: expectation.op,
          expected: expectation.value,
          actual: undefined,
          pass: false,
        };
      }

      const actual = getByPath(snapshot as unknown as Record<string, unknown>, expectation.path);
      return {
        at: expectation.at,
        path: expectation.path,
        op: expectation.op,
        expected: expectation.value,
        actual,
        pass: this.compare(expectation.op, actual, expectation.value),
      };
    });
  }

  private compare(op: ExpectationOperator, actual: unknown, expected: unknown): boolean {
    switch (op) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "gt":
        return typeof actual === "number" && typeof expected === "number" && actual > expected;
      case "gte":
        return typeof actual === "number" && typeof expected === "number" && actual >= expected;
      case "lt":
        return typeof actual === "number" && typeof expected === "number" && actual < expected;
      case "lte":
        return typeof actual === "number" && typeof expected === "number" && actual <= expected;
      case "includes":
        return Array.isArray(actual) ? actual.includes(expected) : false;
    }
  }

  private createStationedFleet(input: {
    id: string;
    name: string;
    factionId: string;
    currentSystemId: string;
    ships: number;
    mission: Mission;
    cargoSalt: number;
    metals: number;
    retreatSystemId?: string;
    rules: FleetRule[];
  }): FleetState {
    const fleet: FleetState = {
      id: input.id,
      name: input.name,
      factionId: input.factionId,
      ships: input.ships,
      mission: input.mission,
      status: "stationed",
      currentSystemId: input.currentSystemId,
      burnSaltRemaining: 0,
      cargoSalt: input.cargoSalt,
      metals: input.metals,
      routeDistanceRemaining: 0,
      routeTravelDaysRemaining: 0,
      retreatSystemId: input.retreatSystemId,
      rules: input.rules,
    };
    this.fleets.set(fleet.id, fleet);
    return fleet;
  }

  private ensureGarrisonFleet(systemId: string, factionId: string): FleetState {
    const existing = [...this.fleets.values()].find(
      (fleet) =>
        fleet.status === "stationed" &&
        fleet.currentSystemId === systemId &&
        fleet.factionId === factionId &&
        fleet.name.endsWith("Garrison"),
    );
    if (existing) {
      return existing;
    }
    return this.createStationedFleet({
      id: `${systemId}-${factionId}-garrison`,
      name: `${this.requireSystem(systemId).name} Garrison`,
      factionId,
      currentSystemId: systemId,
      ships: 0,
      mission: "reinforce",
      cargoSalt: 0,
      metals: 0,
      rules: [],
    });
  }

  private scheduleSurveyReport(date: string, fleet: FleetState): void {
    const system = this.requireSystem(fleet.currentSystemId!);
    const report: Report = {
      id: this.nextId("report"),
      type: "survey",
      factionId: fleet.factionId,
      availableDate: date,
      observedAt: date,
      sourceSystemId: system.id,
      content: {
        ownerId: system.ownerId,
        ships: this.totalShipsAtSystem(system.id),
        defense: system.defense,
        saltOutput: this.baseSaltOutput(system.starType),
        metalRichness: system.metalRichness,
      },
    };
    this.requireFaction(fleet.factionId).reports.push(report);
  }

  private scheduleCombatReports(
    date: string,
    systemId: string,
    attackerFactionId: string,
    defenderFactionId: string,
    attackerLosses: number,
    defenderLosses: number,
    defenseLosses: number,
  ): void {
    for (const factionId of [attackerFactionId, defenderFactionId]) {
      const homeSystemId = this.requireFaction(factionId).homeSystemId;
      const travelDays = this.safeTravelDays(systemId, homeSystemId);
      if (travelDays === null) {
        continue;
      }
      const deliverDate = addDays(date, travelDays);
      this.pendingReports.push({
        deliverDate,
        report: {
          id: this.nextId("report"),
          type: "combat",
          factionId,
          availableDate: deliverDate,
          observedAt: date,
          sourceSystemId: systemId,
          content: {
            attackerFactionId,
            defenderFactionId,
            attackerLosses,
            defenderLosses,
            defenseLosses,
          },
        },
      });
    }
  }

  private scheduleTelescopeBurnReports(
    date: string,
    sourceSystemId: string,
    burnType: "departure" | "arrival",
    fleet: FleetState,
  ): void {
    for (const faction of this.factions.values()) {
      const travelDays = this.safeTravelDays(sourceSystemId, faction.homeSystemId);
      if (travelDays === null) {
        continue;
      }
      const deliverDate = addDays(date, travelDays);
      const possibleDestinations =
        burnType === "departure"
          ? this.graph.getPossibleDestinationsFromHeading(sourceSystemId, fleet.routeHeading)
          : [sourceSystemId];
      this.pendingReports.push({
        deliverDate,
        report: {
          id: this.nextId("report"),
          type: burnType === "departure" ? "telescope_departure" : "telescope_arrival",
          factionId: faction.id,
          availableDate: deliverDate,
          observedAt: date,
          sourceSystemId,
          burnType,
          estimatedFleetMass: this.effectiveMass(fleet.ships, fleet.cargoSalt, fleet.metals),
          initialHeading: fleet.routeHeading,
          possibleDestinations,
          content: {
            fleetId: fleet.id,
            mission: fleet.mission,
          },
        },
      });
    }
  }

  private scheduleProbeSightings(date: string, fleet: FleetState, routeId: string): void {
    for (const probe of this.probes.values()) {
      if (probe.status !== "deployed" || probe.factionId === fleet.factionId || probe.durability <= 0) {
        continue;
      }

      let observedAt: string | null = null;
      let possibleDestinations: string[] = [];

      if (probe.watchedRouteId && probe.watchedRouteId === routeId) {
        const arrival = fleet.arrivalDate ? diffDays(date, fleet.arrivalDate) : 0;
        observedAt = addDays(date, Math.max(1, Math.floor(arrival / 2)));
        possibleDestinations = fleet.routeHeading
          ? this.graph.getPossibleDestinationsFromHeading(fleet.originSystemId!, fleet.routeHeading)
          : [fleet.destinationSystemId!];
      } else if (
        probe.watchedSystemApproachId &&
        probe.watchedSystemApproachId === fleet.destinationSystemId &&
        fleet.arrivalDate
      ) {
        observedAt = addDays(fleet.arrivalDate, -1);
        possibleDestinations = [fleet.destinationSystemId];
      }

      if (!observedAt) {
        continue;
      }

      probe.durability -= 1;
      if (probe.durability <= 0) {
        probe.status = "destroyed";
      }

      if (probe.reportSaltReserve <= 0) {
        continue;
      }

      probe.reportSaltReserve -= 1;
      const deliverDate = addDays(
        observedAt,
        this.safeTravelDays(probe.anchorSystemId, probe.reportDestinationSystemId) ?? 0,
      );

      const faction = this.requireFaction(probe.factionId);
      this.pendingReports.push({
        deliverDate,
        report: {
          id: this.nextId("report"),
          type: "probe_sighting",
          factionId: faction.id,
          availableDate: deliverDate,
          observedAt,
          probeId: probe.id,
          sourceSystemId: probe.anchorSystemId,
          estimatedFleetMass: this.effectiveMass(fleet.ships, fleet.cargoSalt, fleet.metals),
          initialHeading: fleet.routeHeading,
          possibleDestinations,
          content: {
            watchedRouteId: probe.watchedRouteId,
            watchedSystemApproachId: probe.watchedSystemApproachId,
          },
        },
      });
    }
  }

  private handleArrivalMission(date: string, fleet: FleetState): void {
    const system = this.requireSystem(fleet.currentSystemId!);

    if (fleet.mission === "trade" && system.ownerId === fleet.factionId) {
      system.saltStockpile += fleet.cargoSalt;
      system.metalStockpile += fleet.metals;
      fleet.cargoSalt = 0;
      fleet.metals = 0;
      this.log.push(`${date}: fleet ${fleet.id} unloaded friendly cargo at ${system.id}`);
      return;
    }

    if (fleet.mission === "trade" && system.tradeFocus && system.tradeRate && system.tradeCapacity) {
      if (system.tradeFocus === "buys_metals_pays_salt") {
        const tradedMetals = Math.min(fleet.metals, system.tradeCapacity);
        fleet.metals -= tradedMetals;
        fleet.cargoSalt += Math.floor(tradedMetals * system.tradeRate);
        system.tradeCapacity -= tradedMetals;
      } else {
        const tradedSalt = Math.min(fleet.cargoSalt, system.tradeCapacity);
        fleet.cargoSalt -= tradedSalt;
        fleet.metals += Math.floor(tradedSalt * system.tradeRate);
        system.tradeCapacity -= tradedSalt;
      }
      this.log.push(`${date}: fleet ${fleet.id} traded at ${system.id}`);
    }
  }

  private buildPerceivedState(factionId: string): PerceivedState {
    const faction = this.requireFaction(factionId);
    const systems = new Map<string, PerceivedSystemIntel>();
    const ownedSystems = this.ownedSystems(factionId);
    const ownFleets = [...this.fleets.values()].filter(
      (fleet) => fleet.factionId === factionId && fleet.status !== "destroyed",
    );

    for (const system of ownedSystems) {
      systems.set(system.id, {
        systemId: system.id,
        starType: system.starType,
        metalRichness: system.metalRichness,
        knownOwnerId: system.ownerId,
        knownShips: this.totalShipsAtSystem(system.id),
        knownDefense: system.defense,
        lastObservedAt: this.scenario.startDate,
        routeOptions: [{ originSystemId: system.id, distance: 0, travelDays: 0 }],
        threatScore: 0,
      });

      for (const neighbor of this.graph.getNeighbors(system.id)) {
        const target = this.requireSystem(neighbor.systemId);
        const current = systems.get(target.id) ?? {
          systemId: target.id,
          routeOptions: [],
          threatScore: 0,
        };
        current.starType = current.starType ?? target.starType;
        current.metalRichness = current.metalRichness ?? target.metalRichness;
        current.routeOptions.push({
          originSystemId: system.id,
          distance: neighbor.distance,
          travelDays: neighbor.travelDays,
        });
        systems.set(target.id, current);
      }
    }

    for (const report of faction.reports) {
      this.applyReportToPerceivedState(systems, report);
    }

    for (const intel of systems.values()) {
      if (intel.routeOptions.length > 0) {
        continue;
      }
      for (const origin of ownedSystems) {
        const plan = this.safePlan(origin.id, intel.systemId);
        if (!plan) {
          continue;
        }
        intel.routeOptions.push({
          originSystemId: origin.id,
          distance: plan.distance,
          travelDays: plan.travelDays,
        });
      }
    }

    return {
      factionId,
      homeSystemId: faction.homeSystemId,
      ownedSystems,
      ownFleets,
      systems,
      reports: faction.reports,
    };
  }

  private applyReportToPerceivedState(
    systems: Map<string, PerceivedSystemIntel>,
    report: Report,
  ): void {
    const systemId =
      typeof report.content.systemId === "string"
        ? report.content.systemId
        : report.sourceSystemId;
    if (!systemId) {
      return;
    }

    const current = systems.get(systemId) ?? {
      systemId,
      routeOptions: [],
      threatScore: 0,
    };

    switch (report.type) {
      case "intel":
      case "survey": {
        if (typeof report.content.ownerId === "string" || report.content.ownerId === null) {
          current.knownOwnerId = report.content.ownerId as string | null;
        }
        if (typeof report.content.ships === "number") {
          current.knownShips = report.content.ships;
        }
        if (typeof report.content.defense === "number") {
          current.knownDefense = report.content.defense;
        }
        if (typeof report.content.starType === "string") {
          current.starType = report.content.starType as SystemState["starType"];
        }
        if (typeof report.content.metalRichness === "string") {
          current.metalRichness = report.content.metalRichness as SystemState["metalRichness"];
        }
        current.lastObservedAt = report.observedAt;
        break;
      }
      case "combat": {
        if (typeof report.content.defenderFactionId === "string") {
          current.knownOwnerId = report.content.defenderFactionId as string;
        }
        current.lastObservedAt = report.observedAt;
        break;
      }
      case "telescope_departure":
      case "probe_sighting": {
        for (const destination of report.possibleDestinations ?? []) {
          const destinationIntel = systems.get(destination) ?? {
            systemId: destination,
            routeOptions: [],
            threatScore: 0,
          };
          destinationIntel.threatScore += report.estimatedFleetMass ?? 1;
          destinationIntel.lastObservedAt = report.observedAt;
          systems.set(destination, destinationIntel);
        }
        break;
      }
      case "telescope_arrival": {
        current.lastObservedAt = report.observedAt;
        break;
      }
      case "dispatch":
        break;
    }

    systems.set(systemId, current);
  }

  private runTurtleProfile(
    date: string,
    factionId: string,
    profile: CommanderProfileDefinition,
    perceived: PerceivedState,
  ): void {
    const home = this.requireSystem(perceived.homeSystemId);
    const homeDefenseTarget = this.profileNumber(profile, "homeDefenseTarget", 8);
    const frontierDefenseTarget = this.profileNumber(profile, "frontierDefenseTarget", 3);

    if (home.defense < homeDefenseTarget && this.canBuildAtSystem(home.id, "defense")) {
      this.executeBuild(date, {
        type: "build",
        at: date,
        factionId,
        systemId: home.id,
        kind: "defense",
        quantity: 1,
      });
      return;
    }

    for (const system of perceived.ownedSystems) {
      if (system.id === home.id) {
        continue;
      }
      if (system.defense < frontierDefenseTarget && this.canBuildAtSystem(system.id, "defense")) {
        this.executeBuild(date, {
          type: "build",
          at: date,
          factionId,
          systemId: system.id,
          kind: "defense",
          quantity: 1,
        });
        return;
      }
    }

    if (this.canBuildAtSystem(home.id, "ship")) {
      this.executeBuild(date, {
        type: "build",
        at: date,
        factionId,
        systemId: home.id,
        kind: "ship",
        quantity: 1,
      });
    }
  }

  private runFrontierExpanderProfile(
    date: string,
    factionId: string,
    profile: CommanderProfileDefinition,
    perceived: PerceivedState,
    chatty: boolean,
  ): void {
    const home = this.requireSystem(perceived.homeSystemId);
    const homeReserveShips = this.profileNumber(profile, "homeReserveShips", 2);
    const claimFleetShips = this.profileNumber(profile, "claimFleetShips", 4);
    const preferredSystems = this.profileNumber(profile, "preferredSystems", 3);
    const frontierDefenseTarget = this.profileNumber(profile, "frontierDefenseTarget", 2);
    const maxExpansionDistance = this.profileNumber(profile, "maxExpansionDistance", 3);

    if (chatty) {
      this.sendRoutineStatusPigeons(date, perceived);
    }

    if (perceived.ownedSystems.length < preferredSystems) {
      const expansion = this.findBestOpenExpansionTarget(perceived, maxExpansionDistance);
      if (expansion) {
        const availableShips = this.availableShipsAtSystem(expansion.originSystemId);
        const reserve = expansion.originSystemId === perceived.homeSystemId ? homeReserveShips : 1;
        if (availableShips - claimFleetShips >= reserve && this.canLaunchFleet(expansion.originSystemId, claimFleetShips, 0, 0, expansion.targetSystemId)) {
          this.executeLaunchFleet(date, {
            type: "launch_fleet",
            at: date,
            factionId,
            originSystemId: expansion.originSystemId,
            destinationSystemId: expansion.targetSystemId,
            ships: claimFleetShips,
            mission: "attack",
            cargoSalt: 0,
            metals: 0,
            retreatSystemId: perceived.homeSystemId,
            name: `${factionId}-claim-${expansion.targetSystemId}`,
          });
          return;
        }
      }
    }

    for (const system of perceived.ownedSystems) {
      if (system.id === home.id) {
        continue;
      }
      if (system.defense < frontierDefenseTarget && this.canBuildAtSystem(system.id, "defense")) {
        this.executeBuild(date, {
          type: "build",
          at: date,
          factionId,
          systemId: system.id,
          kind: "defense",
          quantity: 1,
        });
        return;
      }
    }

    if (this.canBuildAtSystem(home.id, "ship")) {
      this.executeBuild(date, {
        type: "build",
        at: date,
        factionId,
        systemId: home.id,
        kind: "ship",
        quantity: 1,
      });
    }
  }

  private runNapoleonicProfile(
    date: string,
    factionId: string,
    profile: CommanderProfileDefinition,
    perceived: PerceivedState,
  ): void {
    const faction = this.requireFaction(factionId);
    const home = perceived.homeSystemId;
    const probeKey = "probeDeployed";
    if (!faction.commanderMemory[probeKey]) {
      const probeAnchor = this.findProbeAnchor(perceived);
      if (probeAnchor && this.canDeployProbe(home, probeAnchor.anchorSystemId)) {
        this.executeDeployProbe(date, {
          type: "deploy_probe",
          at: date,
          factionId,
          originSystemId: home,
          anchorSystemId: probeAnchor.anchorSystemId,
          reportDestinationSystemId: home,
          watchedSystemApproachId: probeAnchor.watchedSystemApproachId,
          reportSaltReserve: 1,
        });
        faction.commanderMemory[probeKey] = true;
      }
    }

    const currentCampaignTarget =
      typeof faction.commanderMemory.campaignTargetSystemId === "string"
        ? faction.commanderMemory.campaignTargetSystemId
        : null;
    const currentTargetIntel = currentCampaignTarget
      ? perceived.systems.get(currentCampaignTarget)
      : null;

    if (
      currentCampaignTarget &&
      currentTargetIntel &&
      currentTargetIntel.knownOwnerId &&
      currentTargetIntel.knownOwnerId !== factionId
    ) {
      const focusedAttack = this.findAttackPlanForTarget(perceived, profile, currentCampaignTarget);
      if (focusedAttack && this.canLaunchFleet(focusedAttack.originSystemId, focusedAttack.shipsToSend, 0, 0, focusedAttack.targetSystemId)) {
        this.executeLaunchFleet(date, {
          type: "launch_fleet",
          at: date,
          factionId,
          originSystemId: focusedAttack.originSystemId,
          destinationSystemId: focusedAttack.targetSystemId,
          ships: focusedAttack.shipsToSend,
          mission: "attack",
          cargoSalt: 0,
          metals: 0,
          retreatSystemId: faction.homeSystemId,
          name: `${factionId}-main-${focusedAttack.targetSystemId}`,
          rules: [
            {
              condition: {
                lhs: "system.enemy_ships",
                op: ">",
                rhs: "fleet.ships",
              },
              action: "retreat",
            },
          ],
        });
        return;
      }

      if (this.canBuildAtSystem(home, "ship")) {
        this.executeBuild(date, {
          type: "build",
          at: date,
          factionId,
          systemId: home,
          kind: "ship",
          quantity: 1,
        });
      }
      return;
    }

    let attack = this.findBestConcentratedAttackTarget(perceived, profile);
    if (attack) {
      faction.commanderMemory.campaignTargetSystemId = attack.targetSystemId;
    } else if (currentCampaignTarget) {
      delete faction.commanderMemory.campaignTargetSystemId;
    }

    if (attack && this.canLaunchFleet(attack.originSystemId, attack.shipsToSend, 0, 0, attack.targetSystemId)) {
      this.executeLaunchFleet(date, {
        type: "launch_fleet",
        at: date,
        factionId,
        originSystemId: attack.originSystemId,
        destinationSystemId: attack.targetSystemId,
        ships: attack.shipsToSend,
        mission: "attack",
        cargoSalt: 0,
        metals: 0,
        retreatSystemId: faction.homeSystemId,
        name: `${factionId}-main-${attack.targetSystemId}`,
        rules: [
          {
            condition: {
              lhs: "system.enemy_ships",
              op: ">",
              rhs: "fleet.ships",
            },
            action: "retreat",
          },
        ],
      });
      return;
    }

    if (this.hasPerceivedEnemyFieldTargets(perceived)) {
      const availableShips = this.availableShipsAtSystem(home, factionId);
      const reserve = this.profileNumber(profile, "homeReserveShips", 4);
      const minimumAttackShips = this.profileNumber(profile, "minimumAttackShips", 6);
      if (availableShips - reserve < minimumAttackShips && this.canBuildAtSystem(home, "ship")) {
        this.executeBuild(date, {
          type: "build",
          at: date,
          factionId,
          systemId: home,
          kind: "ship",
          quantity: 1,
        });
      }
      return;
    }

    this.runFrontierExpanderProfile(date, factionId, profile, perceived, false);
  }

  private runBadCommanderProfile(
    date: string,
    factionId: string,
    profile: CommanderProfileDefinition,
    perceived: PerceivedState,
  ): void {
    const home = this.requireSystem(perceived.homeSystemId);
    const borderShipTarget = this.profileNumber(profile, "borderShipTarget", 5);
    const packetThreshold = this.profileNumber(profile, "panicPigeonThreshold", 1);

    const threatenedSystems = perceived.ownedSystems
      .filter((system) => system.id !== home.id)
      .sort((left, right) => {
        const leftThreat = perceived.systems.get(left.id)?.threatScore ?? 0;
        const rightThreat = perceived.systems.get(right.id)?.threatScore ?? 0;
        if (rightThreat !== leftThreat) {
          return rightThreat - leftThreat;
        }
        return this.totalShipsAtSystem(left.id, factionId) - this.totalShipsAtSystem(right.id, factionId);
      });

    for (const system of threatenedSystems) {
      const localShips = this.totalShipsAtSystem(system.id, factionId);
      if (localShips < borderShipTarget && this.availableShipsAtSystem(home.id, factionId) >= 4 && this.canLaunchFleet(home.id, 2, 0, 0, system.id)) {
        this.executeLaunchFleet(date, {
          type: "launch_fleet",
          at: date,
          factionId,
          originSystemId: home.id,
          destinationSystemId: system.id,
          ships: 2,
          mission: "reinforce",
          cargoSalt: 0,
          metals: 0,
          retreatSystemId: home.id,
          name: `${factionId}-relief-${system.id}`,
        });
        return;
      }
    }

    if (threatenedSystems.length >= packetThreshold) {
      this.sendRoutineStatusPigeons(date, perceived);
    }

    if (home.defense < this.profileNumber(profile, "homeDefenseTarget", 7) && this.canBuildAtSystem(home.id, "defense")) {
      this.executeBuild(date, {
        type: "build",
        at: date,
        factionId,
        systemId: home.id,
        kind: "defense",
        quantity: 1,
      });
      return;
    }

    if (this.canBuildAtSystem(home.id, "ship")) {
      this.executeBuild(date, {
        type: "build",
        at: date,
        factionId,
        systemId: home.id,
        kind: "ship",
        quantity: 1,
      });
    }
  }

  private sendRoutineStatusPigeons(date: string, perceived: PerceivedState): void {
    const home = perceived.homeSystemId;
    for (const system of perceived.ownedSystems) {
      if (system.id === home || system.saltStockpile < 1) {
        continue;
      }
      this.executeSendPigeon(
        date,
        perceived.factionId,
        {
          senderFactionId: perceived.factionId,
          recipientFactionId: perceived.factionId,
          packetType: "logistics",
          entries: [`status:${system.id}:${date}`],
        },
        system.id,
        home,
      );
    }
  }

  private findBestOpenExpansionTarget(
    perceived: PerceivedState,
    maxExpansionDistance: number,
  ): { originSystemId: string; targetSystemId: string } | null {
    let best:
      | {
          originSystemId: string;
          targetSystemId: string;
          score: number;
        }
      | null = null;

    for (const system of perceived.systems.values()) {
      if (system.systemId === perceived.homeSystemId || system.knownOwnerId === perceived.factionId) {
        continue;
      }
      if (system.knownOwnerId && system.knownOwnerId !== perceived.factionId) {
        continue;
      }
      if (this.hasFriendlyPresence(system.systemId, perceived.factionId) || this.hasFriendlyInboundFleet(system.systemId, perceived.factionId)) {
        continue;
      }

      const bestRoute = system.routeOptions
        .filter((route) => route.distance <= maxExpansionDistance)
        .sort((left, right) => left.distance - right.distance || left.travelDays - right.travelDays)[0];
      if (!bestRoute) {
        continue;
      }

      const actualSystem = this.requireSystem(system.systemId);
      const knownDefense = system.knownDefense ?? 1;
      const score =
        this.baseSaltOutput(system.starType ?? actualSystem.starType) * 3 +
        this.baseMetalOutput(system.metalRichness ?? actualSystem.metalRichness) * 2 -
        bestRoute.distance * 2 -
        knownDefense * 3 -
        system.threatScore;

      if (!best || score > best.score) {
        best = {
          originSystemId: bestRoute.originSystemId,
          targetSystemId: system.systemId,
          score,
        };
      }
    }

    return best ? { originSystemId: best.originSystemId, targetSystemId: best.targetSystemId } : null;
  }

  private findBestConcentratedAttackTarget(
    perceived: PerceivedState,
    profile: CommanderProfileDefinition,
  ): { originSystemId: string; targetSystemId: string; shipsToSend: number } | null {
    let best:
      | {
          targetSystemId: string;
          shipsToSend: number;
          score: number;
        }
      | null = null;

    for (const intel of perceived.systems.values()) {
      if (!intel.knownOwnerId || intel.knownOwnerId === perceived.factionId) {
        continue;
      }
      if (intel.systemId === this.requireFaction(intel.knownOwnerId).homeSystemId) {
        continue;
      }
      const attackPlan = this.findAttackPlanForTarget(perceived, profile, intel.systemId);
      if (!attackPlan) {
        continue;
      }
      const route = this.safePlan(perceived.homeSystemId, intel.systemId);
      if (!route) {
        continue;
      }
      const actualSystem = this.requireSystem(intel.systemId);
      const knownShips = intel.knownShips ?? 3;
      const knownDefense = intel.knownDefense ?? 1;
      const defenderPower = knownShips + knownDefense * DEFENSE_POWER;
      const concentrationScore =
        this.baseSaltOutput(intel.starType ?? actualSystem.starType) * 4 +
        this.baseMetalOutput(intel.metalRichness ?? actualSystem.metalRichness) * 2 -
        defenderPower * 2 -
        route.distance +
        intel.threatScore;

      if (!best || concentrationScore > best.score) {
        best = {
          targetSystemId: intel.systemId,
          shipsToSend: attackPlan.shipsToSend,
          score: concentrationScore,
        };
      }
    }

    return best
      ? {
          originSystemId: perceived.homeSystemId,
          targetSystemId: best.targetSystemId,
          shipsToSend: best.shipsToSend,
        }
      : null;
  }

  private findAttackPlanForTarget(
    perceived: PerceivedState,
    profile: CommanderProfileDefinition,
    targetSystemId: string,
  ): { originSystemId: string; targetSystemId: string; shipsToSend: number } | null {
    const intel = perceived.systems.get(targetSystemId);
    if (!intel || !intel.knownOwnerId || intel.knownOwnerId === perceived.factionId) {
      return null;
    }

    const homeId = perceived.homeSystemId;
    const homeShips = this.availableShipsAtSystem(homeId, perceived.factionId);
    const reserve = this.profileNumber(profile, "homeReserveShips", 4);
    const minimumAttackShips = this.profileNumber(profile, "minimumAttackShips", 6);
    const availableToSend = homeShips - reserve;
    if (availableToSend < minimumAttackShips) {
      return null;
    }

    const route = intel.routeOptions
      .filter((option) => option.originSystemId === homeId)
      .sort((left, right) => left.distance - right.distance || left.travelDays - right.travelDays)[0];
    if (!route) {
      return null;
    }

    const knownShips = intel.knownShips ?? 3;
    const knownDefense = intel.knownDefense ?? 1;
    const defenderPower = knownShips + knownDefense * DEFENSE_POWER;
    const friendlyShipsCommitted = perceived.ownFleets
      .filter((fleet) => fleet.currentSystemId === targetSystemId || fleet.destinationSystemId === targetSystemId)
      .reduce((total, fleet) => total + fleet.ships, 0);
    const neededShips = Math.max(minimumAttackShips, defenderPower + 2 - friendlyShipsCommitted);
    const shipsToSend = Math.min(availableToSend, neededShips);

    if (shipsToSend < 1) {
      return null;
    }

    return {
      originSystemId: homeId,
      targetSystemId,
      shipsToSend,
    };
  }

  private findProbeAnchor(
    perceived: PerceivedState,
  ): { anchorSystemId: string; watchedSystemApproachId: string } | null {
    for (const system of perceived.ownedSystems) {
      for (const neighbor of this.graph.getNeighbors(system.id)) {
        const knownNeighbor = perceived.systems.get(neighbor.systemId);
        if (knownNeighbor?.knownOwnerId && knownNeighbor.knownOwnerId !== perceived.factionId) {
          return {
            anchorSystemId: system.id,
            watchedSystemApproachId: system.id,
          };
        }
      }
    }
    return null;
  }

  private evaluateFleetDecisions(date: string, systemId: string): void {
    const fleets = [...this.fleets.values()].filter(
      (fleet) => fleet.status === "stationed" && fleet.currentSystemId === systemId && fleet.ships > 0,
    );
    for (const fleet of fleets) {
      const action = this.resolveFleetAction(fleet, systemId);
      fleet.lastAction = action;
      if (action === "retreat") {
        this.tryRetreat(date, fleet);
      } else if (action === "resupply") {
        this.tryResupply(fleet);
      }
    }
  }

  private resolveFleetAction(fleet: FleetState, systemId: string): FleetAction {
    for (const rule of fleet.rules) {
      if (this.ruleMatches(fleet, systemId, rule)) {
        return rule.action;
      }
    }

    const enemyShips = this.enemyShipsAtSystem(systemId, fleet.factionId);
    switch (fleet.mission) {
      case "attack":
      case "reinforce":
        return enemyShips > 0 ? "engage" : "hold";
      case "resupply":
        return this.requireSystem(systemId).ownerId === fleet.factionId ? "resupply" : "hold";
      case "trade":
        return "hold";
    }
  }

  private ruleMatches(fleet: FleetState, systemId: string, rule: FleetRule): boolean {
    const lhs = this.resolveRuleOperand(rule.condition.lhs, fleet, systemId);
    const rhs = this.resolveRuleOperand(rule.condition.rhs, fleet, systemId);
    switch (rule.condition.op) {
      case ">":
        return Number(lhs) > Number(rhs);
      case ">=":
        return Number(lhs) >= Number(rhs);
      case "<":
        return Number(lhs) < Number(rhs);
      case "<=":
        return Number(lhs) <= Number(rhs);
      case "==":
        return lhs === rhs;
      case "!=":
        return lhs !== rhs;
    }
  }

  private resolveRuleOperand(
    operand: string | number,
    fleet: FleetState,
    systemId: string,
  ): number | string | null {
    if (typeof operand === "number") {
      return operand;
    }
    const system = this.requireSystem(systemId);
    const values: Record<string, number | string | null> = {
      "fleet.ships": fleet.ships,
      "fleet.salt": fleet.cargoSalt,
      "fleet.cargo_salt": fleet.cargoSalt,
      "fleet.metals": fleet.metals,
      "system.owner": system.ownerId,
      "system.enemy_ships": this.enemyShipsAtSystem(systemId, fleet.factionId),
      "system.friendly_ships": this.totalShipsAtSystem(systemId, fleet.factionId),
      "system.defense": system.ownerId === fleet.factionId ? system.defense : 0,
      "system.salt_stockpile": system.saltStockpile,
      "system.metal_stockpile": system.metalStockpile,
      friendly: fleet.factionId,
      none: null,
    };
    if (operand in values) {
      return values[operand];
    }
    return operand;
  }

  private tryRetreat(date: string, fleet: FleetState): void {
    if (!fleet.currentSystemId || !fleet.retreatSystemId) {
      return;
    }

    const currentSystem = this.requireSystem(fleet.currentSystemId);
    const plan = this.graph.getPlan(fleet.currentSystemId, fleet.retreatSystemId);
    const desiredCargoSalt = currentSystem.ownerId === fleet.factionId ? fleet.cargoSalt : 0;
    const requiredBurnSalt = this.requiredBurnSalt(fleet.ships, desiredCargoSalt, fleet.metals, plan.distance);
    const localSalt = currentSystem.ownerId === fleet.factionId ? currentSystem.saltStockpile : 0;
    const availableSalt = localSalt + fleet.cargoSalt;

    if (availableSalt < requiredBurnSalt + desiredCargoSalt) {
      return;
    }

    let burnToPay = requiredBurnSalt;
    if (fleet.cargoSalt >= burnToPay) {
      fleet.cargoSalt -= burnToPay;
      burnToPay = 0;
    } else {
      burnToPay -= fleet.cargoSalt;
      fleet.cargoSalt = 0;
    }
    currentSystem.saltStockpile -= burnToPay;

    fleet.status = "transit";
    fleet.originSystemId = fleet.currentSystemId;
    fleet.currentSystemId = undefined;
    fleet.destinationSystemId = fleet.retreatSystemId;
    fleet.departureDate = date;
    fleet.arrivalDate = addDays(date, plan.travelDays);
    fleet.burnSaltRemaining = requiredBurnSalt;
    fleet.routeDistanceRemaining = plan.distance;
    fleet.routeTravelDaysRemaining = plan.travelDays;
    fleet.routeHeading = plan.heading;
    this.log.push(`${date}: fleet ${fleet.id} retreated toward ${fleet.retreatSystemId}`);
  }

  private tryResupply(fleet: FleetState): void {
    if (!fleet.currentSystemId) {
      return;
    }
    const system = this.requireSystem(fleet.currentSystemId);
    if (system.ownerId !== fleet.factionId) {
      return;
    }
    const desired = 10;
    const amount = Math.min(desired - fleet.cargoSalt, system.saltStockpile);
    if (amount > 0) {
      system.saltStockpile -= amount;
      fleet.cargoSalt += amount;
    }
  }

  private applyShipLosses(systemId: string, factionId: string, losses: number): void {
    if (losses <= 0) {
      return;
    }

    const fleets = [...this.fleets.values()]
      .filter((fleet) => fleet.status === "stationed" && fleet.currentSystemId === systemId && fleet.factionId === factionId)
      .sort((left, right) => right.ships - left.ships);

    let remaining = losses;
    for (const fleet of fleets) {
      if (remaining <= 0) {
        break;
      }
      const delta = Math.min(fleet.ships, remaining);
      fleet.ships -= delta;
      remaining -= delta;
    }
  }

  private removeDestroyedFleets(): void {
    for (const [fleetId, fleet] of this.fleets.entries()) {
      if (fleet.ships <= 0) {
        fleet.status = "destroyed";
        this.fleets.delete(fleetId);
      }
    }
  }

  private presentFactions(systemId: string): string[] {
    return [...new Set(
      [...this.fleets.values()]
        .filter((fleet) => fleet.status === "stationed" && fleet.currentSystemId === systemId && fleet.ships > 0)
        .map((fleet) => fleet.factionId),
    )];
  }

  private totalShipsAtSystem(systemId: string, factionId?: string): number {
    return [...this.fleets.values()]
      .filter((fleet) => fleet.status === "stationed" && fleet.currentSystemId === systemId)
      .filter((fleet) => (factionId ? fleet.factionId === factionId : true))
      .reduce((total, fleet) => total + fleet.ships, 0);
  }

  private enemyShipsAtSystem(systemId: string, factionId: string): number {
    return [...this.fleets.values()]
      .filter((fleet) => fleet.status === "stationed" && fleet.currentSystemId === systemId && fleet.factionId !== factionId)
      .reduce((total, fleet) => total + fleet.ships, 0);
  }

  private controlPowers(systemId: string): Record<string, number> {
    const system = this.requireSystem(systemId);
    const powers: Record<string, number> = {};
    for (const fleet of this.fleets.values()) {
      if (fleet.status !== "stationed" || fleet.currentSystemId !== systemId) {
        continue;
      }
      powers[fleet.factionId] = (powers[fleet.factionId] ?? 0) + fleet.ships;
    }
    if (system.ownerId) {
      powers[system.ownerId] = (powers[system.ownerId] ?? 0) + system.defense * DEFENSE_POWER;
    }
    return powers;
  }

  private withdrawShipsFromSystem(systemId: string, factionId: string, ships: number): void {
    let remaining = ships;
    const fleets = [...this.fleets.values()]
      .filter((fleet) => fleet.status === "stationed" && fleet.currentSystemId === systemId && fleet.factionId === factionId)
      .sort((left, right) => left.name.endsWith("Garrison") ? -1 : right.name.endsWith("Garrison") ? 1 : 0);

    const available = fleets.reduce((total, fleet) => total + fleet.ships, 0);
    if (available < ships) {
      throw new Error(`Faction ${factionId} only has ${available} ships at ${systemId}, needs ${ships}`);
    }

    for (const fleet of fleets) {
      if (remaining <= 0) {
        break;
      }
      const removed = Math.min(remaining, fleet.ships);
      fleet.ships -= removed;
      remaining -= removed;
    }
    this.removeDestroyedFleets();
  }

  private ownedSystems(factionId: string): SystemState[] {
    return [...this.systems.values()]
      .filter((system) => system.ownerId === factionId)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private hasFriendlyPresence(systemId: string, factionId: string): boolean {
    return this.totalShipsAtSystem(systemId, factionId) > 0;
  }

  private hasFriendlyInboundFleet(systemId: string, factionId: string): boolean {
    return [...this.fleets.values()].some(
      (fleet) =>
        fleet.factionId === factionId &&
        fleet.status === "transit" &&
        fleet.destinationSystemId === systemId,
    );
  }

  private availableShipsAtSystem(systemId: string, factionId?: string): number {
    return this.totalShipsAtSystem(systemId, factionId);
  }

  private safePlan(originSystemId: string, destinationSystemId: string) {
    try {
      return this.graph.getPlan(originSystemId, destinationSystemId);
    } catch {
      return null;
    }
  }

  private safeTravelDays(originSystemId: string, destinationSystemId: string): number | null {
    const plan = this.safePlan(originSystemId, destinationSystemId);
    return plan ? plan.travelDays : null;
  }

  private canLaunchFleet(
    originSystemId: string,
    ships: number,
    cargoSalt: number,
    metals: number,
    destinationSystemId: string,
  ): boolean {
    const origin = this.requireSystem(originSystemId);
    const plan = this.safePlan(originSystemId, destinationSystemId);
    if (!plan) {
      return false;
    }
    const totalDepartureSalt =
      this.requiredBurnSalt(ships, cargoSalt, metals, plan.distance) + cargoSalt;
    return origin.saltStockpile >= totalDepartureSalt;
  }

  private canBuildAtSystem(systemId: string, kind: "ship" | "defense"): boolean {
    const system = this.requireSystem(systemId);
    if (kind === "ship") {
      return system.saltStockpile >= SHIP_BUILD_SALT && system.metalStockpile >= SHIP_BUILD_METAL;
    }
    return system.saltStockpile >= DEFENSE_BUILD_SALT && system.metalStockpile >= DEFENSE_BUILD_METAL;
  }

  private canDeployProbe(originSystemId: string, anchorSystemId: string): boolean {
    const origin = this.requireSystem(originSystemId);
    return (
      this.safePlan(originSystemId, anchorSystemId) !== null &&
      origin.saltStockpile >= PROBE_COST_SALT &&
      origin.metalStockpile >= PROBE_COST_METAL
    );
  }

  private profileNumber(
    profile: CommanderProfileDefinition,
    key: string,
    fallback: number,
  ): number {
    const value = profile.options?.[key];
    return typeof value === "number" ? value : fallback;
  }

  private hasPerceivedEnemyFieldTargets(perceived: PerceivedState): boolean {
    return [...perceived.systems.values()].some(
      (system) =>
        !!system.knownOwnerId &&
        system.knownOwnerId !== perceived.factionId &&
        system.systemId !== this.requireFaction(system.knownOwnerId).homeSystemId,
    );
  }

  private effectiveMass(ships: number, cargoSalt: number, metals: number): number {
    return ships * SHIP_MASS + metals + ceil(cargoSalt / 4);
  }

  private requiredBurnSalt(
    ships: number,
    cargoSalt: number,
    metals: number,
    routeDistance: number,
  ): number {
    return ceil(routeDistance * this.effectiveMass(ships, cargoSalt, metals));
  }

  private baseSaltOutput(starType: SystemState["starType"]): number {
    switch (starType) {
      case "red_dwarf":
        return 2;
      case "yellow_star":
        return 4;
      case "white_blue_star":
        return 6;
      case "giant_or_exotic":
        return 8;
    }
  }

  private baseMetalOutput(metalRichness: SystemState["metalRichness"]): number {
    switch (metalRichness) {
      case "poor":
        return 1;
      case "standard":
        return 2;
      case "rich":
        return 4;
      case "exceptional":
        return 6;
    }
  }

  private requireSystem(systemId: string): SystemState {
    const system = this.systems.get(systemId);
    if (!system) {
      throw new Error(`Unknown system ${systemId}`);
    }
    return system;
  }

  private requireFaction(factionId: string): FactionState {
    const faction = this.factions.get(factionId);
    if (!faction) {
      throw new Error(`Unknown faction ${factionId}`);
    }
    return faction;
  }

  private requireFleet(fleetId: string): FleetState {
    const fleet = this.fleets.get(fleetId);
    if (!fleet) {
      throw new Error(`Unknown fleet ${fleetId}`);
    }
    return fleet;
  }

  private nextId(prefix: string): string {
    const id = `${prefix}-${this.idCounter}`;
    this.idCounter += 1;
    return id;
  }
}
