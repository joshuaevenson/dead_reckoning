# Redshift

## Core Concept

This is a distributed, asynchronous, information-driven space strategy game where:

* The universe operates continuously, even when players are offline.
* Players interact on a (roughly) daily cadence (log in, issue orders, review intelligence).
* The fundamental resource is information. Territory and ships matter of course, but wars are won on information.
* All strategic decisions are constrained by:
    * light-speed travel (no FTL)
    * communication delay
    * logistical cost
    * incomplete information

The game is designed so that wars are often decided before combat occurs, through logistics, positioning, and intelligence rather than real-time execution.

⸻

## Design Pillars

2.1 Information is the primary resource

* Information is:
    * delayed -- due to the speed of light
    * costly -- the primary way to send interstellar data is via Pigeons, single-use courier craft defined in the explicit rules below
    * partial
    * sometimes outdated or misleading
* Players act on belief states, not truth states.

2.2 Time is physical and slow

* Ships travel at relativistic speeds (accelerating up to near-light speeds).
* All travel, communication, and trade have:
    * real delays (days → months → years scale in-game)
    * predictable schedules once launched

2.3 Orders are persistent commitments

* Players do not micromanage units.
* They issue mission orders that execute autonomously.
* Once launched, fleets:
    * cannot be instantly redirected
    * only respond to pre-defined conditional logic

2.4 The universe is partially observed

* Each player maintains a personal “known universe” graph:
    * with limited knowledge of what is in each star systems
    * based on incoming reports
    * delayed intelligence
* There is no single authoritative “current state” from a player perspective.

⸻

1. Core Gameplay Loop (Daily Interaction)

Players typically log in once per day:

Step 1 — Receive Updates

* Combat results from previous days
* Incoming intelligence reports
* Economic/trade/logistical updates
* Status of fleets in transit (which can be statically computed by the user)

Step 2 — Interpret Information

* Evaluate:
    * what is known
    * what is outdated
    * what is uncertain
* Infer enemy movements and intentions

Step 3 — Issue Orders

* Launch fleets with:
    * destinations
    * mission plans
    * conditional behaviors
* Allocate resources:
    * fuel
    * materials
    * personnel
    * information budget (see economy)
* Manage Trade with other systems (both within and outside of the user's control).

Step 4 — Strategic Adjustment

* Modify long-term doctrine:
    * defense posture
    * expansion plans
    * intelligence priorities

⸻

1. Universe Model

4.1 Star Systems

Each system contains:

* resources (variable types)
* population
* infrastructure
* ownership (faction-based)
* local fleets and defenses

4.2 Ownership

* Ownership is event-derived (not mutable state).
* On conquest:
    * the previous controlling faction enters government-in-exile
    * control transitions via deterministic resolution of events

4.3 Distance & Travel

* Space is a weighted graph of star systems (light-speed constrained)
* Travel:
    * takes real in-game time
    * is pre-scheduled and immutable unless conditional logic applies

⸻

5. Fleet System

5.1 Fleets as Autonomous Agents

Fleets are not directly controlled after launch, they are staffed by an "automated machine intelligence".

They carry:

* mission objective
* engagement rules
* retreat conditions
* logistics constraints
* optional heuristics (“doctrine scripts”)

Example Fleet Doctrine

* If enemy strength matches our expectations, engage
* If allied fleet arrives, combine forces
* If enemy fleet arrives, disengage
* If fuel < threshold, divert to nearest resupply system
* If system already conquered, hold orbit

5.2 Fleet Outcomes are Computed Offline

* Battles are resolved when simulation time reaches event time.
* No real-time combat interaction is required.
* Outcomes are deterministic given:
    * fleet composition
    * local conditions
    * known modifiers
    * a small level of randomness like real battles

⸻

1. Information System (Core Mechanic)

6.1 Types of Information

* Intelligence reports (scouting, sensors)
* Diplomatic messages
* Economic data
* Combat reports
* Fleet orders

6.2 Information Costs

Information is a constrained resource:

* Interstellar messages are carried by Pigeons
* Each Pigeon launch costs exactly `1 salt`
* A single Pigeon can carry multiple packets in one dispatch
* Information is limited by courier cost and travel time, not by interception risk

6.3 Communication Delays

* All information propagates with delay proportional to distance
* Players operate on:
    * stale intelligence
    * partial visibility
    * probabilistic inference

⸻

7. Economy & Logistics

7.1 Multi-resource system

Instead of a single currency:

* Salt
  * Colloquial name for the antimatter.
  * Used to move ships to near lightspeed.
  * Used to launch Pigeons carrying interstellar messages.
  * Availability in a system depends on the type of star (it can be generated from stars at a constant rate).
* Metals
  * Used for construction of defenses, ships, etc.
  * Availability depends on the star system.

7.2 Logistics as strategy

* Fleets require provisioning.
* Every fleet requires provisioning
* Supply chains matter over long distances
* Expansion is constrained by logistics capacity

7.3 Strategic chokepoints

* Resource-rich systems become critical hubs
* Communication relays and fuel depots create strategic geography

⸻

1. Exile & Persistence Mechanics

8.1 Government-in-exile

When a home system is captured:

* faction is not eliminated
* it transitions into exile state
* retains:
    * knowledge
    * surviving fleets
    * off-world assets

8.2 Home System Importance

* Home system defines:
    * primary logistics hub
    * communication center (for calculating time to receive information)
    * economic core
* Losing it causes:
    * loss of efficiency
    * increased communication cost
    * fragmentation of control

⸻

9. Combat Resolution Model

9.1 Deterministic Simulation

Combat outcomes are computed from:

* fleet composition
* arrival timing
* doctrine scripts
* system defenses
* known environmental modifiers

9.2 Multi-fleet convergence

If multiple fleets arrive:

* they are sorted by:
    * arrival time
    * deterministic tie-breakers
* resolved in a single simulation pass

⸻

10. Information Asymmetry (Core Gameplay Driver)

Each player maintains:

* Actual universe state (server-side event log)
* Perceived universe state (player knowledge graph)

These differ due to:

* communication delay
* destroyed scouts
* misinformation
* outdated reports

Strategic gameplay emerges from:

* acting on incomplete data
* anticipating enemy knowledge gaps
* exploiting information delay

⸻

11. Intended Player Experience

Players should feel:

* like an admiral in a pre-modern naval empire
* like a logistics planner managing centuries-long campaigns
* like intelligence operators interpreting delayed signals
* like strategists operating under uncertainty, not precision

Core emotional loop:

“I didn’t lose because I was weaker. I lost because I didn’t know in time.”

⸻

12. Overall System Philosophy

This game is not optimized for:

* real-time interaction
* perfect fairness
* instant feedback

It is optimized for:

* delayed consequence
* informational warfare
* logistics-driven strategy
* emergent narrative from asynchronous events

The underlying system is intentionally:

* eventually consistent
* event-driven
* heavily time-delayed
* low-frequency interaction (daily/weekly decisions)

⸻

13. Design Summary

If reduced to one sentence:

A distributed space civilization simulator where information delay, logistics, and uncertainty are the true battlefield, and all wars are decided long before fleets arrive.

⸻

14. Explicit Rules: Pigeons

14.1 Role

Pigeons are the default interstellar courier mechanism. They are small, single-use craft used to move information between star systems when communication delay matters.

14.2 Launch Rules

* A Pigeon may be launched from:
    * a friendly star system
    * a friendly station
    * a friendly fleet currently located in a star system
* Launching a Pigeon costs exactly `1 salt`
* A Pigeon is launched immediately when the player issues the send action
* A Pigeon cannot be redirected after launch

14.3 Destination Rules

* A Pigeon has exactly one destination
* Its destination must be a star system
* A Pigeon cannot target a fleet in transit
* A stationary fleet may receive orders or reports through the star system it is currently in

14.4 Travel and Reliability

* A Pigeon travels like any other physical craft in the setting and arrives after a computed travel time based on distance
* Pigeons are assumed to be reliable once launched
* Pigeons are too small to intercept realistically, so gameplay tension comes from delay and salt cost rather than message loss

14.5 Delivery Rules

* A Pigeon carries one dispatch
* A dispatch may contain multiple packets
* Each packet is delivered when the Pigeon arrives at its destination system
* If a packet is addressed to a fleet that has already departed that system, the packet is delivered to the local command authority and remains there until acted upon

14.6 Dispatch Structure

Each Pigeon carries a single dispatch with:

* `sender`
* `origin`
* `destination_system`
* `launch_time`
* `auth`
* `packets[]`

14.7 Packet Structure

Each packet is a self-contained message and includes:

* `packet_type`
* `created_at`
* `author`
* `recipient`
* `entries[]`

Suggested packet types:

* `intel`
* `orders`
* `diplomatic`
* `logistics`

14.8 Entry Structure

Each packet entry records a specific claim, observation, or instruction and includes:

* `entry_type`
* `observed_at`
* `source`
* `confidence`
* `content`

This distinction matters:

* `launch_time` is when the Pigeon departed
* `created_at` is when a packet was assembled
* `observed_at` is when the underlying event actually happened
