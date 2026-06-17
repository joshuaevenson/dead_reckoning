import type { SystemDefinition } from "./types.js";

const DIRECT_TIME_MULTIPLIER = 1.0;
const DIRECT_SALT_MULTIPLIER = 1.0;
const STARLANE_TIME_MULTIPLIER = 0.7;
const STARLANE_SALT_MULTIPLIER = 0.8;

const HEADING_DIRECTIONS = [
  "east",
  "north_east",
  "north",
  "north_west",
  "west",
  "south_west",
  "south",
  "south_east",
];

type PositionedSystem = Pick<SystemDefinition, "id" | "position" | "starlaneLinks">;

type PathSegment = {
  fromSystemId: string;
  toSystemId: string;
  distance: number;
  timeCost: number;
  saltCostDistance: number;
  travelDays: number;
  mode: "direct" | "starlane";
  segmentId: string;
};

type PathNode = {
  systemId: string;
  timeCost: number;
  saltCostDistance: number;
  pathSystemIds: string[];
  segments: PathSegment[];
};

export interface RoutePlan {
  distance: number;
  totalDistance: number;
  travelDays: number;
  firstHopSystemId: string;
  heading?: string;
  firstRouteId: string;
  usesStarlane: boolean;
  segmentIds: string[];
  pathSystemIds: string[];
}

export interface NeighborEdge {
  systemId: string;
  distance: number;
  totalDistance: number;
  travelDays: number;
  heading?: string;
  routeId: string;
  usesStarlane: boolean;
}

function computeDistance(origin: PositionedSystem, destination: PositionedSystem): number {
  return Math.hypot(
    destination.position.x - origin.position.x,
    destination.position.y - origin.position.y,
  );
}

function computeTravelDays(distance: number, multiplier: number): number {
  if (distance <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(distance * multiplier));
}

function computeHeading(origin: PositionedSystem, destination: PositionedSystem): string | undefined {
  const deltaX = destination.position.x - origin.position.x;
  const deltaY = destination.position.y - origin.position.y;
  if (deltaX === 0 && deltaY === 0) {
    return undefined;
  }

  const angle = Math.atan2(deltaY, deltaX);
  const octant = Math.round(angle / (Math.PI / 4));
  return HEADING_DIRECTIONS[(octant + 8) % 8];
}

function formatDirectSegmentId(origin: string, destination: string): string {
  return `direct:${origin}:${destination}`;
}

export function formatStarlaneSegmentId(a: string, b: string): string {
  return a < b ? `lane:${a}:${b}` : `lane:${b}:${a}`;
}

function comparePathNode(left: PathNode, right: PathNode): number {
  if (left.timeCost !== right.timeCost) {
    return left.timeCost - right.timeCost;
  }
  if (left.saltCostDistance !== right.saltCostDistance) {
    return left.saltCostDistance - right.saltCostDistance;
  }
  if (left.segments.length !== right.segments.length) {
    return left.segments.length - right.segments.length;
  }
  return left.systemId.localeCompare(right.systemId);
}

export class TravelGraph {
  private readonly systems = new Map<string, PositionedSystem>();
  private readonly starlanes = new Map<string, Set<string>>();

  constructor(systems: PositionedSystem[]) {
    for (const system of systems) {
      this.systems.set(system.id, system);
    }

    for (const system of systems) {
      for (const neighborId of system.starlaneLinks ?? []) {
        if (!this.systems.has(neighborId)) {
          continue;
        }
        const ownSet = this.starlanes.get(system.id) ?? new Set<string>();
        ownSet.add(neighborId);
        this.starlanes.set(system.id, ownSet);

        const reverseSet = this.starlanes.get(neighborId) ?? new Set<string>();
        reverseSet.add(system.id);
        this.starlanes.set(neighborId, reverseSet);
      }
    }
  }

  getPlan(originId: string, destinationId: string): RoutePlan {
    const origin = this.requireSystem(originId);
    const destination = this.requireSystem(destinationId);

    if (originId === destinationId) {
      return {
        distance: 0,
        totalDistance: 0,
        travelDays: 0,
        firstHopSystemId: destinationId,
        firstRouteId: "local",
        usesStarlane: false,
        segmentIds: [],
        pathSystemIds: [originId],
      };
    }

    const best = this.findBestPath(originId, destinationId);
    const firstHopSystemId = best.pathSystemIds[1] ?? destinationId;

    return {
      distance: best.segments.reduce((total, segment) => total + segment.saltCostDistance, 0),
      totalDistance: best.segments.reduce((total, segment) => total + segment.distance, 0),
      travelDays: best.segments.length === 0 ? 0 : Math.max(1, Math.ceil(best.timeCost)),
      firstHopSystemId,
      heading: computeHeading(origin, this.requireSystem(firstHopSystemId)),
      firstRouteId: best.segments[0]?.segmentId ?? formatDirectSegmentId(originId, destinationId),
      usesStarlane: best.segments.some((segment) => segment.mode === "starlane"),
      segmentIds: best.segments.map((segment) => segment.segmentId),
      pathSystemIds: best.pathSystemIds,
    };
  }

  getTravelDays(originId: string, destinationId: string): number {
    return this.getPlan(originId, destinationId).travelDays;
  }

  getPossibleDestinationsFromHeading(originId: string, heading?: string): string[] {
    if (!heading) {
      return [];
    }

    return [...this.systems.values()]
      .filter((system) => system.id !== originId)
      .map((system) => ({
        systemId: system.id,
        plan: this.getPlan(originId, system.id),
      }))
      .filter(({ plan }) => plan.heading === heading)
      .sort((left, right) =>
        left.plan.travelDays - right.plan.travelDays
        || left.plan.distance - right.plan.distance
        || left.systemId.localeCompare(right.systemId),
      )
      .map(({ systemId }) => systemId);
  }

  getNeighbors(systemId: string): NeighborEdge[] {
    return [...this.systems.values()]
      .filter((system) => system.id !== systemId)
      .map((system) => {
        const plan = this.getPlan(systemId, system.id);
        return {
          systemId: system.id,
          distance: plan.distance,
          totalDistance: plan.totalDistance,
          travelDays: plan.travelDays,
          heading: plan.heading,
          routeId: plan.firstRouteId,
          usesStarlane: plan.usesStarlane,
        };
      })
      .sort((left, right) =>
        left.travelDays - right.travelDays
        || left.distance - right.distance
        || left.totalDistance - right.totalDistance
        || left.systemId.localeCompare(right.systemId),
      );
  }

  private findBestPath(originId: string, destinationId: string): PathNode {
    const queue: PathNode[] = [{
      systemId: originId,
      timeCost: 0,
      saltCostDistance: 0,
      pathSystemIds: [originId],
      segments: [],
    }];
    const bestBySystem = new Map<string, PathNode>();

    while (queue.length > 0) {
      queue.sort(comparePathNode);
      const current = queue.shift()!;
      const known = bestBySystem.get(current.systemId);
      if (known && comparePathNode(known, current) <= 0) {
        continue;
      }
      bestBySystem.set(current.systemId, current);

      if (current.systemId === destinationId) {
        return current;
      }

      for (const nextNode of this.expandNode(current, destinationId)) {
        const existing = bestBySystem.get(nextNode.systemId);
        if (existing && comparePathNode(existing, nextNode) <= 0) {
          continue;
        }
        queue.push(nextNode);
      }
    }

    throw new Error(`Unable to find travel plan from ${originId} to ${destinationId}`);
  }

  private expandNode(node: PathNode, destinationId: string): PathNode[] {
    const current = this.requireSystem(node.systemId);
    const destination = this.requireSystem(destinationId);
    const nextNodes: PathNode[] = [];

    const directDistance = computeDistance(current, destination);
    nextNodes.push(this.extendPath(node, {
      fromSystemId: current.id,
      toSystemId: destination.id,
      distance: directDistance,
      timeCost: directDistance * DIRECT_TIME_MULTIPLIER,
      saltCostDistance: directDistance * DIRECT_SALT_MULTIPLIER,
      travelDays: computeTravelDays(directDistance, DIRECT_TIME_MULTIPLIER),
      mode: "direct",
      segmentId: formatDirectSegmentId(current.id, destination.id),
    }));

    for (const neighborId of this.starlanes.get(current.id) ?? []) {
      if (node.pathSystemIds.includes(neighborId)) {
        continue;
      }
      const neighbor = this.requireSystem(neighborId);
      const distance = computeDistance(current, neighbor);
      nextNodes.push(this.extendPath(node, {
        fromSystemId: current.id,
        toSystemId: neighbor.id,
        distance,
        timeCost: distance * STARLANE_TIME_MULTIPLIER,
        saltCostDistance: distance * STARLANE_SALT_MULTIPLIER,
        travelDays: computeTravelDays(distance, STARLANE_TIME_MULTIPLIER),
        mode: "starlane",
        segmentId: formatStarlaneSegmentId(current.id, neighbor.id),
      }));
    }

    return nextNodes;
  }

  private extendPath(node: PathNode, segment: PathSegment): PathNode {
    return {
      systemId: segment.toSystemId,
      timeCost: node.timeCost + segment.timeCost,
      saltCostDistance: node.saltCostDistance + segment.saltCostDistance,
      pathSystemIds: [...node.pathSystemIds, segment.toSystemId],
      segments: [...node.segments, segment],
    };
  }

  private requireSystem(systemId: string): PositionedSystem {
    const system = this.systems.get(systemId);
    if (!system) {
      throw new Error(`Unknown system ${systemId}`);
    }
    return system;
  }
}
