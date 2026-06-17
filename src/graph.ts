import type { RouteDefinition } from "./types.js";

export interface RoutePlan {
  distance: number;
  travelDays: number;
  firstHopSystemId: string;
  heading?: string;
  firstRouteId: string;
}

interface Edge {
  to: string;
  distance: number;
  travelDays: number;
  heading?: string;
  routeId: string;
}

export interface NeighborEdge {
  systemId: string;
  distance: number;
  travelDays: number;
  heading?: string;
  routeId: string;
}

export class RouteGraph {
  private adjacency: Map<string, Edge[]> = new Map();

  constructor(private readonly routes: RouteDefinition[]) {
    for (const route of routes) {
      this.pushEdge(route.a, {
        to: route.b,
        distance: route.distance,
        travelDays: route.travelDays,
        heading: route.headingFromA,
        routeId: route.id,
      });
      this.pushEdge(route.b, {
        to: route.a,
        distance: route.distance,
        travelDays: route.travelDays,
        heading: route.headingFromB,
        routeId: route.id,
      });
    }
  }

  getPlan(origin: string, destination: string): RoutePlan {
    if (origin === destination) {
      return {
        distance: 0,
        travelDays: 0,
        firstHopSystemId: destination,
        firstRouteId: "local",
      };
    }

    const visited = new Set<string>();
    const distances = new Map<string, number>([[origin, 0]]);
    const travelTimes = new Map<string, number>([[origin, 0]]);
    const previous = new Map<string, { node: string; routeId: string; heading?: string }>();

    while (true) {
      let current: string | undefined;
      let bestTravel = Number.POSITIVE_INFINITY;

      for (const [node, totalTravel] of travelTimes.entries()) {
        if (!visited.has(node) && totalTravel < bestTravel) {
          current = node;
          bestTravel = totalTravel;
        }
      }

      if (!current) {
        throw new Error(`No route from ${origin} to ${destination}`);
      }

      if (current === destination) {
        break;
      }

      visited.add(current);

      for (const edge of this.adjacency.get(current) ?? []) {
        const nextTravel = (travelTimes.get(current) ?? 0) + edge.travelDays;
        const currentBest = travelTimes.get(edge.to);

        if (currentBest === undefined || nextTravel < currentBest) {
          travelTimes.set(edge.to, nextTravel);
          distances.set(edge.to, (distances.get(current) ?? 0) + edge.distance);
          previous.set(edge.to, {
            node: current,
            routeId: edge.routeId,
            heading: edge.heading,
          });
        }
      }
    }

    const path: string[] = [destination];
    let walker = destination;
    let firstRouteId = "";
    let heading: string | undefined;

    while (walker !== origin) {
      const step = previous.get(walker);
      if (!step) {
        throw new Error(`Unable to reconstruct route from ${origin} to ${destination}`);
      }
      path.push(step.node);
      if (step.node === origin) {
        firstRouteId = step.routeId;
        heading = step.heading;
      }
      walker = step.node;
    }

    path.reverse();

    return {
      distance: distances.get(destination) ?? 0,
      travelDays: travelTimes.get(destination) ?? 0,
      firstHopSystemId: path[1] ?? destination,
      heading,
      firstRouteId,
    };
  }

  getTravelDays(origin: string, destination: string): number {
    return this.getPlan(origin, destination).travelDays;
  }

  getPossibleDestinationsFromHeading(origin: string, heading?: string): string[] {
    if (!heading) {
      return [];
    }

    return (this.adjacency.get(origin) ?? [])
      .filter((edge) => edge.heading === heading)
      .map((edge) => edge.to)
      .sort();
  }

  getNeighbors(systemId: string): NeighborEdge[] {
    return (this.adjacency.get(systemId) ?? []).map((edge) => ({
      systemId: edge.to,
      distance: edge.distance,
      travelDays: edge.travelDays,
      heading: edge.heading,
      routeId: edge.routeId,
    }));
  }

  private pushEdge(from: string, edge: Edge): void {
    const current = this.adjacency.get(from) ?? [];
    current.push(edge);
    this.adjacency.set(from, current);
  }
}
