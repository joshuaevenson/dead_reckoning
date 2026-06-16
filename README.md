# Dead Reckoning — High-Level Spec

Interstellar Logistics & Information Strategy Game

1. Core Concept

This is a distributed, asynchronous, information-driven space strategy game where:

* The universe operates continuously, even when players are offline.
* Players interact on a ~daily cadence (log in, issue orders, review intelligence).
* The fundamental resource is information, not territory or ships.
* All strategic decisions are constrained by:
    * light-speed travel (no FTL)
    * communication delay
    * logistical cost
    * incomplete information

The game is designed so that wars are often decided before combat occurs, through logistics, positioning, and intelligence rather than real-time execution.

⸻

2. Design Pillars

2.1 Information is the primary resource

* Information is:
    * delayed
    * costly
    * partial
    * sometimes outdated or misleading
* Players act on belief states, not truth states.

2.2 Time is physical and slow

* Ships travel at relativistic speeds (sub-light).
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
    * based on incoming reports
    * delayed intelligence
    * sensor coverage
* There is no single authoritative “current state” from a player perspective.

⸻

3. Core Gameplay Loop (Daily Interaction)

Players typically log in once per day:

Step 1 — Receive Updates

* Combat results from previous days
* Incoming intelligence reports
* Economic/logistical updates
* Status of fleets in transit

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

Step 4 — Strategic Adjustment

* Modify long-term doctrine:
    * defense posture
    * expansion plans
    * intelligence priorities

⸻

4. Universe Model

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

Fleets are not directly controlled after launch.

They carry:

* mission objective
* engagement rules
* retreat conditions
* logistics constraints
* optional heuristics (“doctrine scripts”)

Example Fleet Doctrine

* If enemy strength < 50%, engage
* If allied fleet arrives, combine forces
* If fuel < threshold, divert to nearest resupply system
* If system already conquered, hold orbit

5.2 Fleet Outcomes are Computed Offline

* Battles are resolved when simulation time reaches event time.
* No real-time combat interaction is required.
* Outcomes are deterministic given:
    * fleet composition
    * local conditions
    * arrival ordering
    * known modifiers

⸻

6. Information System (Core Mechanic)

6.1 Types of Information

* Intelligence reports (scouting, sensors)
* Diplomatic messages
* Economic data
* Combat reports

6.2 Information Costs

Information is a constrained resource:

* Sending messages costs:
    * credits + energy + time delay
* Faster communication is more expensive
* Long-range communication requires infrastructure

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

* Fuel (movement)
* Materials (construction)
* Personnel (fleet operations)
* Energy (infrastructure & communication)
* Information bandwidth (communication capacity)

7.2 Logistics as strategy

* Every fleet requires provisioning
* Supply chains matter over long distances
* Expansion is constrained by logistics capacity

7.3 Strategic chokepoints

* Resource-rich systems become critical hubs
* Communication relays and fuel depots create strategic geography

⸻

8. Exile & Persistence Mechanics

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
    * communication center
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