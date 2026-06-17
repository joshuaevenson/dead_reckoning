# Redshift

## Local UI

The repo now includes a browser command table for driving the simulator against the real worker API.

* Run `npm run dev`
* Open `http://localhost:8787`
* Choose a bundled scenario, edit the JSON if needed, and run the simulation

This local server uses the compiled worker for `/api/*` routes and serves the static UI from [`public/`](/Users/joshuaevenson/Documents/GitHub/dead_reckoning/public). For Cloudflare deployment, [`wrangler.jsonc`](/Users/joshuaevenson/Documents/GitHub/dead_reckoning/wrangler.jsonc) is configured to serve the same static assets.

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
    * sometimes outdated or misleading because observations are incomplete
* Players act on belief states, not truth states.

2.2 Time is physical and slow

* Ships travel at relativistic speeds (accelerating up to near-light speeds).
* All travel, communication, and trade have:
    * real delays (days → months → years scale in-game)
    * predictable schedules once launched

2.3 Orders are persistent commitments

* Players do not micromanage units.
* They issue mission orders plus simple explicit rules that execute autonomously.
* Once launched, fleets:
    * cannot be instantly redirected
    * only respond to pre-defined conditional logic described in the explicit rules below

2.4 The universe is partially observed

* Each player maintains a personal “known universe” graph:
    * with limited knowledge of what is in each star systems
    * based on incoming reports
    * based on telescope observations of system burns
    * based on probe sightings
    * delayed intelligence
* There is no single authoritative “current state” from a player perspective.

⸻

1. Core Gameplay Loop (Daily Interaction)

Players typically log in once per day:

Step 1 — Receive Updates

* Combat results from previous days
* Incoming intelligence reports
* New telescope and survey observations
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

* star type
* salt output
* metal richness
* salt stockpile
* metal stockpile
* population
* infrastructure
* ownership (faction-based)
* local fleets and defenses

4.2 Ownership

* Ownership is event-derived (not mutable state).
* On conquest:
    * the previous controlling faction enters government-in-exile
    * control transitions via deterministic resolution of events described in the explicit rules below

4.3 Distance & Travel

* Space is a weighted graph of star systems (light-speed constrained)
* Travel:
    * takes real in-game time
    * is pre-scheduled and immutable unless conditional logic applies

⸻

5. Fleet System

5.1 Fleets as Autonomous Agents

Fleets are not directly controlled after launch. They follow a standing mission and a small set of explicit rules.

They carry:

* a destination system
* a mission
* an ordered list of rules

Rules are written using exposed state variables and simple actions rather than hidden AI behavior.

Example Fleet Rules

* If `system.enemy_ships > fleet.ships`, `retreat`
* If `system.enemy_ships == 0`, `hold`
* Otherwise, `engage`

5.2 Fleet Outcomes are Computed Offline

* Battles are resolved when simulation time reaches event time.
* No real-time combat interaction is required.
* Battles occur at star systems rather than in open space.
* The main pre-battle contest is reconnaissance, inference, and reaction timing.
* Outcomes are deterministic given:
    * fleet composition
    * local conditions
    * fleet rules
    * known modifiers
    * a small level of randomness like real battles

⸻

1. Information System (Core Mechanic)

6.1 Types of Information

* Intelligence reports (scouting, sensors)
* Telescope observations of fleet burns
* Telescope observations of nearby star properties
* Probe reports
* Ship survey reports
* Diplomatic messages
* Economic data
* Combat reports
* Fleet orders

6.2 Information Costs

Information is a constrained resource:

* Interstellar messages are carried by Pigeons
* Each Pigeon launch costs exactly `1 salt`
* A single Pigeon can carry multiple packets in one dispatch
* `1 salt` is the baseline logistics unit that the wider movement economy is built around
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
  * Used to move fleets and launch Pigeons.
  * Produced by stars over time.
  * Production depends on the type of star and is defined by explicit equations below.
* Metals
  * Used for construction of defenses, ships, etc.
  * Can be transported by fleets as cargo.
  * Produced over time based on the star system's metal richness.
  * Availability depends on the star system.

7.2 Logistics as strategy

* Fleets require enough salt to begin a journey.
* Salt cost is driven primarily by distance and carried mass.
* Fleets may transport surplus salt and metals between systems.
* Supply chains matter over long distances.
* The economy is calibrated from the cost of a single Pigeon launch upward.
* Expansion is constrained by logistics capacity.

7.3 Strategic chokepoints

* Salt-rich systems become critical hubs.
* Communication relays and fuel depots create strategic geography.
* Control of productive stars is one of the main reasons to take and hold territory.

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

Home system capture follows the same conquest rules as any other system, but the consequences are much larger.

⸻

9. Combat Resolution Model

9.1 Deterministic Simulation

Combat outcomes are computed from:

* fleet composition
* arrival timing
* explicit fleet rules
* system defenses
* known environmental modifiers

Battles are only resolved when opposing forces meet at a star system. Open-space maneuver matters because it changes who arrives where, when, and with what level of surprise.

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
* ambiguous observations
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
* like Napoleonic commanders winning before battle by scouting well, hiding intent, and concentrating force at the decisive point

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

A distributed space civilization simulator where information delay, reconnaissance, logistics, and uncertainty are the true battlefield, and all wars are decided long before fleets arrive.

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

⸻

15. Explicit Rules: Fleets

15.1 Role

Fleets are groups of ships that travel and act under one standing order set.

15.2 Core Behavior

* A fleet is launched with:
    * a `destination_system`
    * a `mission`
    * an ordered list of `rules[]`
* Once launched, a fleet acts autonomously according to those rules
* A fleet cannot be retargeted in transit
* New orders can only affect a fleet when they physically arrive at the star system the fleet is currently in

15.3 Missions

Initial missions are:

* `attack`
* `reinforce`
* `resupply`
* `trade`

15.4 Rule Model

* Each rule is a simple condition and action pair
* Rules are evaluated in order
* The first matching rule wins
* If no rule matches, the fleet defaults to its mission behavior

15.5 Exposed State Variables

Initial fleet rule evaluation may reference:

* `fleet.ships`
* `fleet.salt`
* `fleet.cargo_salt`
* `fleet.metals`
* `fleet.system`
* `system.owner`
* `system.enemy_ships`
* `system.friendly_ships`
* `system.defense`
* `system.salt_stockpile`
* `system.metal_stockpile`

15.6 Actions

Initial rule actions are:

* `engage`
* `hold`
* `retreat`
* `resupply`

15.7 Evaluation Timing

Fleet rules are evaluated when:

* the fleet arrives in a star system
* a combat tick ends in the system the fleet is currently in
* the fleet enters a new local state that requires a decision

15.8 Example Orders

Example `attack` order:

* `destination_system`: `New Carthage`
* `mission`: `attack`
* `rules[]`:
    * if `system.enemy_ships > fleet.ships` -> `retreat`
    * if `system.enemy_ships == 0` -> `hold`
    * otherwise -> `engage`

Example `reinforce` order:

* `destination_system`: `New Carthage`
* `mission`: `reinforce`
* `rules[]`:
    * if `system.owner != friendly` -> `hold`
    * if `system.enemy_ships > 0` -> `engage`
    * otherwise -> `hold`

Example `resupply` order:

* `destination_system`: `Tau Ceti`
* `mission`: `resupply`
* `rules[]`:
    * if `fleet.salt <= 0` -> `hold`
    * if `system.owner != friendly` -> `retreat`
    * otherwise -> `resupply`

⸻

16. Explicit Rules: Conquest

16.1 Role

Conquest determines when ownership of a star system changes hands. Ownership does not change when an attacker merely arrives. It changes only when the attacker establishes control and holds it for long enough.

16.2 Defenses

* Each system may have `system.defense`
* Defense is stationary
* Defense is more expensive than a ship
* Each point of `system.defense` counts as more combat power than a ship
* Defense contributes to holding a system the same way ships do

16.3 Holding a System

* A system is held by a faction if that faction has at least one remaining ship or defense in the system
* If a faction has no ships and no defense remaining, it is no longer holding the system
* Fleets alone do not transfer ownership immediately

16.4 Control Requirement

* Conquest progress only begins when the attacker has sole meaningful control of the system
* Sole meaningful control means:
    * the attacker has ships or defense present
    * the defender does not have enough remaining force to contest control
* A token force is not enough to delay conquest indefinitely
* The exact contest threshold is defined in section `21.5 Meaningful Control`

16.5 Capture Duration

Ownership changes only after `capture_progress >= capture_duration`

Where:

* `capture_duration = 7 days + infrastructure_time + tenure_time`
* `infrastructure_time` increases with how built out the system is
* `tenure_time` increases with how long the current owner has controlled it

This allows recently lost systems to be taken back quickly while long-held core systems take longer to flip.

16.6 Capture Progress

* If the attacker has sole meaningful control, `capture_progress` increases over time
* If the defender regains meaningful control before the timer completes, conquest is interrupted
* If the defender fully restores control before the timer completes, ownership never changes
* A brief or insignificant enemy presence should not reset the timer by itself

16.7 Minimal State Variables

Initial conquest evaluation may reference:

* `system.owner`
* `system.defense`
* `system.infrastructure`
* `system.control_age_days`
* `system.capture_progress`
* `system.attacker_power`
* `system.defender_power`

16.8 Example Resolution Rule

```text
if attacker_power > contest_threshold and defender_power <= contest_threshold:
  capture_progress += 1 day
else if defender_power > contest_threshold:
  capture_progress = 0
```

This keeps conquest simple:

* clear the defenders
* maintain meaningful control
* wait out the timer

⸻

17. Explicit Rules: Salt and Logistics

17.1 Role

Salt is the main strategic fuel resource. It is consumed by interstellar movement and by launching Pigeons.

17.2 Salt Consumption

Use `1 salt = 1 Pigeon launch` as the baseline unit for the whole logistics model.

* Launching one Pigeon costs exactly `1 salt`
* All other movement costs should feel expensive relative to routine communication
* The purpose of the economy is:
    * players can afford regular messages
    * players cannot afford unlimited messages
    * moving fleets is much more expensive than sending information

17.3 Fleet Mass and Movement Cost

For the first implementation, separate route timing from salt cost.

Each route has:

* `route_distance`
* `route_travel_time_days`

`route_distance` determines salt cost. `route_travel_time_days` determines arrival time.

To avoid recursive fuel-mass math in the first implementation:

* ships always contribute mass
* metals always contribute mass
* extra salt being carried as cargo contributes mass
* burn salt reserved for propulsion does not contribute additional mass

Define:

```text
ship_mass = 5
metal_mass = fleet.metals
cargo_salt_mass = ceil(fleet.cargo_salt / 4)

fleet_dry_mass = fleet.ships * ship_mass
fleet_cargo_mass = metal_mass + cargo_salt_mass
effective_mass = fleet_dry_mass + fleet_cargo_mass

required_burn_salt = ceil(route_distance * effective_mass)
travel_time_days = route_travel_time_days
```

Where:

* `route_distance` is the path length in normalized interstellar travel units
* `route_travel_time_days` is the precomputed travel time of the path
* each ship contributes `5` mass
* each `1 metal` contributes `1` mass
* each `4 salt` carried contributes `1` mass

This creates a useful baseline:

* `1` ship moving `1` distance costs `5 salt`
* `4` ships moving `2` distance costs `40 salt`
* carrying extra salt forward makes future movement easier but current movement more expensive

17.4 Launch Requirement

* A fleet must reserve enough burn salt to reach its declared destination before it can begin interstellar travel
* The game should not allow a fleet to start a trip it cannot complete
* A fleet that somehow runs out of salt in transit is considered lost, but normal order validation should make this impossible

In equation form:

```text
total_departure_salt = required_burn_salt + fleet.cargo_salt
travel_allowed = origin_system.salt_stockpile >= total_departure_salt
```

17.5 Fleet Cargo

* Fleets may carry extra `cargo_salt`
* Fleets may carry extra `metals`
* Cargo increases movement cost because it increases total carried mass
* Salt and metals carried by a fleet may be deposited into a controlled system on arrival
* Burn salt is consumed by movement
* Cargo salt is preserved on arrival unless traded, unloaded, or spent later on a course change

17.6 Course Changes

Fleets may alter course in transit by spending additional salt.

Define:

```text
remaining_burn_salt = ceil(remaining_route_distance * effective_mass)
course_change_penalty = max(2, ceil(0.25 * remaining_burn_salt))
turn_allowed = fleet.burn_salt_remaining >= remaining_burn_salt + course_change_penalty
```

When a fleet turns:

* `course_change_penalty` is consumed immediately
* a new `remaining_burn_salt` is computed from the new route
* telescope observers do not automatically see the turn
* only probes or later arrival burns reveal the new path

17.7 Resupply

* Fleets resupply by drawing salt from the system they are currently in
* A fleet may only harvest salt locally if its faction owns the system
* If a fleet runs out of salt while inside a star system, it must wait there until it can harvest or receive more salt

17.8 System Production

Systems generate salt and metals for their current owner while that owner remains in control.

Baseline daily salt output by star type:

```text
red_dwarf_output = 2 salt/day
yellow_star_output = 4 salt/day
white_blue_star_output = 6 salt/day
giant_or_exotic_output = 8 salt/day
```

Baseline daily metal output by metal richness:

```text
poor_metal_output = 1 metal/day
standard_metal_output = 2 metal/day
rich_metal_output = 4 metal/day
exceptional_metal_output = 6 metal/day
```

Actual daily output:

```text
daily_salt_output = round(base_star_output * salt_fluctuation)
daily_metal_output = round(base_metal_output * metal_fluctuation)
salt_fluctuation = random value between 0.90 and 1.10
metal_fluctuation = random value between 0.95 and 1.05
```

This means:

* a small star can support occasional fleet movement and a few routine messages
* an average star can support regular communication and bank fuel for military use
* a strong star becomes a major logistics hub worth fighting over

17.9 Operational Baseline

These equations are meant to produce the following gameplay feel:

* `1` average yellow star produces about `4 salt/day`, or about `4` Pigeon launches per day
* a faction with `3` average systems produces about `12 salt/day`, enough for regular internal communication without making messages free
* a `4`-ship claim fleet moving `2` distance costs about `40 salt`, or roughly `10` days of output from one average yellow star
* large offensives require stockpiling salt ahead of time

17.10 Strategic Implications

* Salt-producing systems are strategically valuable even before considering population or industry
* Long-distance campaigns depend on fuel supply, not just fleet size
* Transporting fuel forward is itself a logistical commitment because fuel cargo makes fleets heavier

17.11 Minimal State Variables

Initial logistics evaluation may reference:

* `fleet.salt`
* `fleet.burn_salt_remaining`
* `fleet.cargo_salt`
* `fleet.metals`
* `fleet.effective_mass`
* `fleet.distance_to_destination`
* `system.owner`
* `system.salt_stockpile`
* `system.metal_stockpile`
* `system.salt_output`
* `system.metal_output`
* `system.star_type`
* `route.distance`
* `route.travel_time_days`

17.12 Example Travel Rule

```text
ship_mass = 5
metal_mass = fleet.metals
cargo_salt_mass = ceil(fleet.cargo_salt / 4)
fleet_dry_mass = fleet.ships * ship_mass
fleet_cargo_mass = metal_mass + cargo_salt_mass
effective_mass = fleet_dry_mass + fleet_cargo_mass
required_burn_salt = ceil(route.distance * effective_mass)
total_departure_salt = required_burn_salt + fleet.cargo_salt

if origin_system.salt_stockpile >= total_departure_salt:
  travel_allowed = true
  fleet.burn_salt_remaining = required_burn_salt
else:
  travel_allowed = false
```

⸻

18. Explicit Rules: Recon, Probes, and Observation

18.1 Role

The main contest before battle is the contest over information. Players should succeed using the same broad tactics that made pre-modern and Napoleonic commanders effective:

* scout actively
* conceal final intent
* threaten multiple plausible objectives
* force the enemy to spread out
* concentrate force at the decisive point

18.2 Telescope Observation

Star systems automatically observe major burns at other star systems after normal light-delay.

These free observations include:

* departure burns from a star system
* arrival or deceleration burns at a star system

This gives players news across long distances without spending salt, but only in coarse form and only after a physical delay.

18.3 Telescope Report Contents

A telescope observation creates a dated report containing:

* `observed_at`
* `source_system`
* `burn_type`
* `estimated_fleet_mass`
* `initial_heading`
* `possible_destinations[]`

These reports update the player's map automatically when received.

18.4 Telescope Limits

Telescopes do not provide full open-space tracking.

They do not reveal:

* turns made in deep space
* exact current position of a fleet in transit
* exact destination if multiple destinations fit the observed burn

This means players usually know that a fleet has launched long before they know exactly where it will end up.

18.5 Probes

Probes are dedicated scout assets placed into specific routes, regions, or approach corridors.

Probes are used to:

* detect fleets passing nearby
* narrow `possible_destinations[]`
* refresh stale information about a fleet already seen leaving a system
* create a deeper warning screen around important territory

18.6 Probe Deployment

For the first implementation:

* a probe costs `2 salt` and `2 metals` to build and deploy
* a probe is launched from a friendly system
* a probe is assigned exactly one `watched_route` or `watched_system_approach`
* a probe also records one `report_destination_system`
* a probe may store an integer `report_salt_reserve`

Probe travel uses the same route timing model as a Pigeon.

18.7 Probe Observation

When a fleet passes the watched location of a probe:

* the probe automatically detects the fleet
* the probe generates a sighting report
* if `probe.report_salt_reserve >= 1`, the probe immediately launches a Pigeon carrying the report
* if `probe.report_salt_reserve == 0`, the report remains stored locally until recovered

Initial probe reports contain:

* `observed_at`
* `probe_location`
* `estimated_fleet_mass`
* `heading`
* `possible_destinations[]`

18.8 Probe Survival

Probes are intentionally fragile but deterministic.

Define:

```text
probe.durability = 2
```

Each hostile fleet sighting reduces durability by `1`.

When:

```text
probe.durability <= 0
```

the probe is destroyed.

This creates a meaningful scout war without requiring a separate interception mini-game.

18.9 Course Changes

Fleets may spend additional salt to alter course in transit.

* Course changes make fleet movement more expensive
* Course changes widen uncertainty for hostile observers
* Telescope observers do not automatically see these turns
* Probe networks are the main way to detect that a course correction actually happened

This allows a player to threaten multiple targets, force enemy dispersion, and then commit late.

18.10 Battles Happen At Systems

For the first version of the game, battles happen only when fleets meet at a star system.

That means:

* probes and scouting decide who understands the approach
* fleet movement and course changes decide who threatens which system
* battle resolution decides what happens once forces finally meet at the destination

18.11 Minimal State Variables

Initial recon evaluation may reference:

* `report.observed_at`
* `report.source_system`
* `report.burn_type`
* `report.estimated_fleet_mass`
* `report.initial_heading`
* `report.possible_destinations[]`
* `probe.location`
* `probe.status`
* `probe.watched_route`
* `probe.report_destination_system`
* `probe.report_salt_reserve`
* `probe.durability`

18.12 Example Frontier Fork

```text
1. Home system telescope sees a departure burn from enemy system A
2. Report implies the fleet could reach Frontier East or Frontier West
3. Defender spreads forces because both are plausible targets
4. Attacker spends extra salt to turn late toward Frontier West
5. A surviving forward probe would reveal the turn; without it, the defender reacts too late
```

This is the intended pattern:

* the attacker wins by creating uncertainty
* the defender wins by building enough reconnaissance depth to collapse that uncertainty in time

⸻

19. System Mode: Autonomous Command

19.1 Role

The simulation should support an autonomous command mode in which an LLM can operate a faction using the same information, delays, and rules as a human player.

19.2 Uses

Autonomous command is useful for:

* NPC factions
* filling out frontier and buffer space
* running hands-off simulations to observe emergent behavior
* testing economic and military balance without requiring human players

19.3 Constraints

An autonomous faction should not receive hidden privileges.

It should act through the same surfaces as a human player:

* read reports
* inspect the known map
* issue fleet orders
* send Pigeons
* react to incomplete and delayed information

19.4 Design Value

This mode helps answer important design questions early:

* Do players expand naturally into nearby open systems?
* Do reconnaissance and course changes create real ambiguity?
* Are defenses and fleet costs balanced well enough to prevent obvious degenerate strategies?
* Does the game reward the intended Napoleonic style of scouting, concentration, and misdirection?

⸻

20. Explicit Rules: Exploration and First Expansion

20.1 Role

The first expansion loop should be simple and legible:

* identify nearby promising systems
* learn which ones are open and worth taking
* send a small fleet
* hold long enough to establish control

For a new faction, the normal path to a second system is expansion into nearby open frontier systems rather than immediate war against another player's home system.

20.2 Starting Frontier

New factions should begin with a buffer of nearby open systems between them and other player home systems.

This serves two purposes:

* it gives each new faction room to expand before direct peer conflict
* it makes the early game about scouting, claiming, and logistics instead of instant rushing

Player home systems should also begin with substantial built-in defenses so they are not efficient early targets.

20.3 What Astronomy Reveals For Free

Owned systems passively learn basic facts about nearby star systems through astronomy after the normal observation delay.

This free information includes:

* `system.star_type`
* `system.distance`
* `system.metal_richness`

This is enough to tell whether a nearby system is strategically interesting before committing ships.

20.4 What Astronomy Does Not Reveal

Astronomy alone does not reveal the current tactical state of a system.

It does not tell the player:

* exact ship count in orbit
* exact defense level
* current salt stockpile
* whether a rival fleet has recently arrived unless a visible burn was observed

That information requires active reconnaissance.

20.5 Recon Levels

The exploration model should stay simple and use two levels of recon:

* telescope knowledge for strategic value
* close recon for tactical state

Initial close recon sources are:

* probes, which can report traffic and recent activity
* ships physically entering the system, which produce a direct survey

20.6 Survey Reports

When a friendly ship enters a system, it generates a survey report containing the current local state.

Initial survey fields are:

* `system.owner`
* `system.ships`
* `system.defense`
* `system.salt_output`
* `system.metal_richness`

Survey reports are local until carried home by Pigeon or by a returning fleet. This keeps exploration tied to communication delay rather than giving instant global knowledge.

20.7 Open Systems

An open system is a system with no current owner.

For the early game, nearby open systems should usually have:

* no standing faction owner
* little or no fixed defense
* useful differences in star quality and metal richness

This creates a real choice between:

* taking a safer low-value system quickly
* waiting longer to reach a richer system

20.8 Claiming An Open System

Claiming an open system uses the same general control idea as conquest, but with a shorter timer.

The exact claim timer is defined in section `21.6 Capture And Claim Timers`.

Claim progress begins when:

* `system.owner == none`
* the claimant has meaningful force in the system
* no rival has meaningful force contesting it

Ownership changes only after:

```text
claim_progress >= claim_duration
```

Open-system claiming should be intentionally faster than capturing a developed enemy system.

20.9 Claim Interruption

If another faction arrives before the claim completes:

* claim progress pauses while control is contested
* claim progress resumes only when one side regains sole meaningful control

If the claimant loses all local force before completion, the claim fails and ownership does not change.

20.10 Why The Second System Matters

A second system is valuable immediately because it can:

* add daily salt production
* add metal supply
* act as a forward staging point for later fleets
* receive `trade` and `resupply` missions

This makes early expansion a logistics decision, not just a land grab.

20.11 Minimal State Variables

Initial exploration and expansion rules may reference:

* `system.owner`
* `system.star_type`
* `system.distance`
* `system.metal_richness`
* `system.ships`
* `system.defense`
* `system.salt_output`
* `system.claim_progress`
* `system.claim_duration`

20.12 Example: Getting Your Second System

```text
1. Your home system identifies three nearby open stars
2. Astronomy shows that one is salt-poor, one is metal-rich, and one is balanced
3. You stockpile enough salt for a small claim fleet
4. A scout ship enters the balanced system and finds it open and lightly defended
5. The claim fleet arrives, holds the system, and waits out the claim timer
6. Once control flips, the new system begins producing salt for you and can support further expansion
```

⸻

21. Explicit Rules: Combat and Control

21.1 Role

Combat should feel Napoleonic in the sense that:

* bigger force usually wins
* concentrated force wins more often than dispersed force
* defenders with prepared positions are hard to dislodge
* information and timing matter because they determine who actually arrives in strength

The combat model should reward winning the campaign before the battle, not only clicking better during the battle.

21.2 Core Combat Power

For the first implementation, use a small number of explicit factors:

```text
ship_power = 1
defense_power = 3
hold_bonus = 0.15
```

Define:

```text
attacker_base_power = attacker_ships * ship_power
defender_base_power = (defender_ships * ship_power) + (system.defense * defense_power)

if system.owner == defender_faction:
  defender_effective_power = defender_base_power * (1 + hold_bonus)
else:
  defender_effective_power = defender_base_power

attacker_effective_power = attacker_base_power
```

This keeps the model simple while making fixed defenses matter and giving the current holder a modest advantage.

21.3 Combat Ticks

Combat resolves in daily ticks while hostile forces coexist in a system.

For each combat tick:

```text
attacker_roll = attacker_effective_power * random value between 0.90 and 1.10
defender_roll = defender_effective_power * random value between 0.90 and 1.10

attacker_loss_fraction = clamp(0.15, 0.85, defender_roll / (attacker_roll + defender_roll))
defender_loss_fraction = clamp(0.15, 0.85, attacker_roll / (attacker_roll + defender_roll))

attacker_ship_losses = ceil(attacker_ships * attacker_loss_fraction * 0.50)
defender_ship_losses = ceil(defender_ships * defender_loss_fraction * 0.50)
defense_losses = ceil(system.defense * defender_loss_fraction * 0.35)
```

This means:

* even a stronger side usually takes some losses
* even a weaker side can inflict damage before collapsing
* battles usually last several days instead of disappearing in one instant roll

21.4 Post-Tick Decisions

After each combat tick:

* ship counts and defense values are updated
* fleet rules are re-evaluated
* a fleet may continue to `engage`
* a fleet may `retreat` if its rules now demand it

This is where information and pre-written rules matter. A player who arrived with the larger force but the wrong standing order can still lose the campaign.

21.5 Meaningful Control

Control should be based on combat power, not token presence.

Define:

```text
contest_threshold = 3

faction_control_power = faction_ships + (faction_defense * 3)
meaningful_force = faction_control_power >= contest_threshold
sole_meaningful_control = own_control_power >= contest_threshold and enemy_control_power < contest_threshold
```

This creates the intended behavior:

* `1` ship cannot indefinitely stall a capture
* a battered remnant can still matter if it remains above the contest threshold
* defenses count heavily toward control

21.6 Capture And Claim Timers

Use explicit day counts for control transfer.

For enemy-owned systems:

```text
base_capture_days = 7
infrastructure_time = ceil(system.infrastructure / 5)
tenure_time = min(21, floor(system.control_age_days / 30))

capture_duration = base_capture_days + infrastructure_time + tenure_time
```

For open systems:

```text
claim_duration = 3 + ceil(system.infrastructure / 10)
```

21.7 Control Progress

At the end of each day:

```text
if attacker has sole_meaningful_control of an enemy-owned system:
  capture_progress += 1
else if defender has sole_meaningful_control:
  capture_progress = 0
else:
  capture_progress does not change
```

For open systems, replace `capture_progress` with `claim_progress` using the same logic.

21.8 Minimal State Variables

Initial combat and control evaluation may reference:

* `system.owner`
* `system.defense`
* `system.infrastructure`
* `system.control_age_days`
* `system.capture_progress`
* `system.claim_progress`
* `attacker_ships`
* `defender_ships`
* `attacker_effective_power`
* `defender_effective_power`

21.9 Example: Prepared Defense

```text
1. Attacker arrives with 12 ships
2. Defender holds with 8 ships and 4 defense
3. Defender base power is 8 + (4 * 3) = 20
4. Hold bonus raises defender effective power to 23
5. Attacker has the larger field fleet in isolation, but not the larger concentrated power at the system
6. The attacker either commits reinforcements or loses the battle of position
```

⸻

22. Explicit Rules: Construction and Trade

22.1 Scope

For the first implementation, keep the economy intentionally narrow:

* `salt` is the movement resource
* `metals` are the construction resource
* no third core transported resource is required yet
* population and infrastructure matter as modifiers, not as cargo

22.2 Construction Costs

Initial construction costs:

```text
ship_build_cost = 10 metals + 5 salt
ship_build_time = 2 days

defense_build_cost = 25 metals + 10 salt
defense_build_time = 5 days

probe_build_cost = 2 metals + 2 salt
probe_build_time = 1 day
```

Pigeons do not need a separate construction queue. Their `1 salt` launch cost is the full gameplay cost.

22.3 Trade Mission Structure

A `trade` mission is a cargo mission with optional repetition.

Initial fields:

* `origin_system`
* `destination_system`
* `cargo_salt`
* `cargo_metals`
* `repeat_interval_days`
* `return_to_origin` boolean

22.4 Internal Trade

If the destination is friendly:

* delivered `cargo_salt` is added to `system.salt_stockpile`
* delivered `cargo_metals` is added to `system.metal_stockpile`
* no market conversion occurs

Internal trade is how a faction feeds frontier systems, forward defenses, and invasion staging areas.

22.5 External Trade

If the destination is an independent or treaty system, the cargo may be exchanged using the local market profile.

Each tradeable system exposes:

* `system.trade_focus`
* `system.trade_rate`
* `system.trade_capacity`

Initial trade focuses are:

* `buys_metals_pays_salt`
* `buys_salt_pays_metals`

Initial exchange rules:

```text
if system.trade_focus == buys_metals_pays_salt:
  traded_metals = min(fleet.metals, system.trade_capacity)
  salt_received = floor(traded_metals * system.trade_rate)

if system.trade_focus == buys_salt_pays_metals:
  traded_salt = min(fleet.cargo_salt, system.trade_capacity)
  metals_received = floor(traded_salt * system.trade_rate)
```

After trade:

```text
system.trade_capacity -= traded_amount
```

and daily market refresh restores capacity over time.

22.6 Recurring Trade

If `repeat_interval_days` is set:

* the fleet waits until the interval expires
* reloads at its current origin if cargo is available
* repeats the same route and trade order

If the origin lacks enough cargo, the fleet waits instead of partially improvising a different mission.

22.7 Why Trade Matters

Trade should matter for three reasons:

* it lets a salt-rich system support a metal-poor frontier
* it lets a metal-rich system fund defense and shipbuilding elsewhere
* it creates another reason to scout, protect routes, and fight over productive stars

22.8 Minimal State Variables

Initial construction and trade evaluation may reference:

* `system.salt_stockpile`
* `system.metal_stockpile`
* `system.trade_focus`
* `system.trade_rate`
* `system.trade_capacity`
* `fleet.cargo_salt`
* `fleet.metals`

⸻

23. Explicit Rules: Starting Conditions

23.1 Role

Starting conditions should create a stable opening:

* enough room for expansion
* enough defenses to prevent immediate collapse
* enough stockpile to launch an early claim fleet after some planning

23.2 Starting Home System

A new player begins with one home system configured approximately as:

```text
star_type = yellow_star
salt_stockpile = 60
metal_stockpile = 80
ships = 6
defense = 6
infrastructure = 10
```

This gives the player:

* routine communication capacity immediately
* a meaningful defended home world
* enough stored resources to build and launch an early expansion force without making that choice free

23.3 Nearby Frontier

Each new player should begin with:

* `3` to `5` nearby open systems within route distance `1` to `3`
* at least one `salt-rich` option
* at least one `metal-rich` option
* at least one balanced option

Initial open systems should usually have:

```text
owner = none
defense = 0 to 1
infrastructure = 0 to 3
```

23.4 Peer Separation

Nearest peer home systems should be far enough away that early war is a choice, not the default opener.

For the first implementation:

* at least `2` open frontier systems should separate a new player's home system from the nearest peer home system
* peer home systems should be less efficient early targets than open frontier systems

23.5 Design Intention

The intended opening is:

```text
1. Survey nearby stars
2. Choose which frontier system to take first
3. Build or launch a small claim fleet
4. Secure the second system
5. Decide whether to fortify, trade, scout deeper, or expand again
```
```
