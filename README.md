# Redshift

## Local UI

The repo now includes a browser command table for driving the simulator against the real worker API.

* Run `npm run dev`
* Open `http://localhost:8787`
* Choose a bundled test scenario, edit the JSON if needed, and run the simulation

This local server uses the compiled worker for `/api/*` routes and serves the static UI from [`public/`](/Users/joshuaevenson/Documents/GitHub/dead_reckoning/public). For Cloudflare deployment, [`wrangler.jsonc`](/Users/joshuaevenson/Documents/GitHub/dead_reckoning/wrangler.jsonc) is configured to serve the same static assets.

## Locked State Schema

This section defines the canonical game state shape for the real game. Any change to this schema should be discussed before implementation.

### Non-state

These are not persisted game state:

* Test scenarios. These exist only for simulation and balance testing.
* Star catalog data such as star names, coordinates, star type, salt profile, metal richness, and optional starlane links.
* Travel formulas, salt-cost formulas, and time-conversion rules.
* Browser UI state such as selected system, open panel, draft order, or local clock display.
* Rendered text such as feed summaries, ETA strings, and top-bar labels.

### Static Universe Catalog

The game uses a fixed catalog of nearby real star systems. This catalog is static data, not mutable world state.

Each system in the catalog provides:

* `id`
* `name`
* `position`
* `star_type`
* `salt_profile`
* `metal_richness`
* optional `starlane_links[]`

From this static data we derive:

* direct distance between systems
* optional starlane-assisted travel plans
* fleet travel time
* pigeon travel time
* salt movement cost

There are no persisted route records. Direct travel and optional starlane travel are both derived from the static catalog.

### Canonical Persisted World State

There is one shared world for everyone. The persisted state is only the mutable world:

* `players`
* `systems`
* `fleets`
* `probes`
* `pigeons`
* `reports`

#### Players

Each player stores:

* `id`
* `name`
* `home_system_id`

#### Systems

Each system stores only mutable control and resource state:

* `system_id`
* `owner_id`
* `defense`
* `salt`
* `metals`
* `control_since_ms`
* `updated_at_ms`
* optional active `capture`

The important rule is that stars themselves are static, while ownership and stored resources are dynamic.

#### Fleets

Each fleet stores:

* `id`
* `owner_id`
* `origin_system_id`
* `destination_system_id`
* `launched_at_ms`
* `arrival_at_ms`
* `ships`
* `cargo_salt`
* `cargo_metals`
* `mission`

#### Probes

Each probe stores:

* `id`
* `owner_id`
* `origin_system_id`
* `target_system_id`
* `launched_at_ms`
* `arrival_at_ms`
* `status`

#### Pigeons

Each pigeon stores:

* `id`
* `owner_id`
* `origin_system_id`
* `destination_system_id`
* `launched_at_ms`
* `arrival_at_ms`
* `packets`

#### Reports

Reports are the canonical player-intelligence record.

Each report stores:

* `id`
* `recipient_player_id`
* `created_at_ms`
* `delivered_at_ms`
* `kind`
* optional `system_id`
* optional `fleet_id`
* `payload`

### Derived, Not Stored

These must be derived from canonical state rather than persisted directly:

* `Launch Probe`
* `Probe arrives in X years Y months`
* top summary metrics
* feed cards
* fleet ETA text
* salt output projections
* player-visible knowledge summaries
* whether a system is currently under siege
* whether a system is currently blockading nearby starlanes
* whether a side currently has a flank advantage in an active battle

### Knowledge Rule

The game stores world truth and delivered reports. Player-facing knowledge is derived from:

* owned systems
* delivered reports
* active probes
* visible telescope events

The UI should not invent a separate long-lived truth model when the underlying world state and delivered reports already define what the player knows.

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

2.5 The game should teach through consequences

* The player should usually learn from outcomes rather than from abstract tutorial text alone.
* Reports, advisor notes, and after-action summaries should explain why something happened:
    * which blockade cut a route
    * which delayed probe left a frontier blind
    * which pinned fleet created a losing battle
* The game should help the player discover durable play styles such as:
    * frontier expansion
    * lane denial
    * cautious turtling
    * feint and turn
    * probe-heavy screening

2.6 The opening should function as an apprenticeship arc

* Early play should happen in a legible local pocket where the player can make meaningful choices without immediate contact from powerful distant players.
* The player should still receive delayed news from the wider galaxy so the broader world feels real and continuous.
* The early game should emphasize:
    * choosing first expansion targets
    * deciding when to probe versus when to claim
    * learning the value of starlanes, blockades, and information delay
* The wider galaxy should become a direct operational concern only after the player has enough local strength and understanding to engage with it.

2.7 Strategy should be explicit and legible

* The player should be able to mark systems and regions with strategic intent so later advice and reports have context.
* Initial strategic markings may include:
    * `explore`
    * `expand`
    * `threat`
    * `screen`
    * `economic_priority`
    * `future_link`
* Advisor suggestions, diplomacy summaries, and report analysis should reference these markings directly.

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

### Daily Brief Contract

For the slow daily cadence to stay engaging, each real-world check-in should try to present:

* one opportunity
* one threat
* one lesson

Where possible:

* the opportunity should tempt expansion, trade, reconnaissance, diplomacy, or a timing window
* the threat should demand interpretation rather than merely announce damage
* the lesson should connect a recent outcome to a clear cause

In the single-player or AI-heavy opening, the game should deliberately aim to supply this pattern every day. In the long-run shared multiplayer world, this pattern may be less controllable, but the UI should still try to frame the player's current situation in these terms.

### Council Advisors

The player should not receive only one authoritative recommendation stream.

Instead, the command layer should eventually support a small council of named advisors with different biases, such as:

* military caution
* aggressive expansion
* intelligence and screening
* logistical and economic discipline
* diplomacy and signaling

Important design rules:

* advisors should explain consequences, not merely say what to click
* advisors should often disagree in good faith
* advisor reliability should vary by topic and circumstance
* learning when to trust which advisor is itself a minor skill the player develops

Conflicting advice is a feature, not a defect, as long as each advisor can explain the reasoning behind the recommendation.

### Strategic Markings

The player should be able to annotate the map with strategic priorities.

These markings are not world truth. They are player intent and planning context.

Initial uses:

* mark a star as the next expansion objective
* identify a dangerous frontier
* flag a system as a screening anchor for probes or blockades
* designate an economic backbone system
* identify a future inter-cluster connection point

These markings should improve later messaging. For example:

* an advisor can say a marked `expand` target is now riskier because a rival can blockade the fast lane
* a report can say a marked `threat` system just received reinforcements
* a logistics note can say a marked `future_link` system is now the best outward starlane candidate

### Diplomatic Pigeons

Diplomatic messages from AI factions should be a regular part of the daily information flow.

These messages may be:

* friendly
* threatening
* deceptive
* transactional
* informative by accident

Their purpose is not only flavor. They should also teach strategic patterns by surfacing:

* blockade threats
* frontier pressure
* resource shortages
* likely expansion routes
* rival personality and doctrine

⸻

1. Universe Model

4.1 Star Systems

Each system contains:

* star type
* salt potential, which may be zero
* metal richness
* salt stockpile
* metal stockpile
* population
* infrastructure
* ownership (faction-based)
* local fleets and defenses
* optional strategic position on one or more starlanes

4.2 Ownership

* Ownership is event-derived (not mutable state).
* On conquest:
    * the previous controlling faction enters government-in-exile
    * control transitions via deterministic resolution of events described in the explicit rules below

4.3 Distance & Travel

* Space is open: fleets may always travel directly from one known system to another
* Optional starlanes connect some systems
* Starlane travel is faster and cheaper than direct travel
* Because starlanes pass through intermediate systems, they create natural waypoint, blockade, and interception objectives
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
* The exact contest threshold is defined in section `21.7 Meaningful Control`

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

17.3 Fleet Mass and Travel Plans

For the first implementation, separate travel geometry from salt cost.

Each fleet uses a derived travel plan made of one or more segments.

Each segment has:

* `segment_distance`
* `segment_mode`

Where:

* `segment_mode = direct` means open-space travel between any two systems
* `segment_mode = starlane` means travel along a static lane link between two connected systems

Direct travel is always allowed. Starlanes are optional but strategically attractive because they are faster and cheaper.

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

direct_time_multiplier = 1.00
direct_salt_multiplier = 1.00
starlane_time_multiplier = 0.70
starlane_salt_multiplier = 0.80

fleet_dry_mass = fleet.ships * ship_mass
fleet_cargo_mass = metal_mass + cargo_salt_mass
effective_mass = fleet_dry_mass + fleet_cargo_mass

segment_burn_salt = ceil(segment_distance * effective_mass * segment_salt_multiplier)
segment_travel_time_days = ceil(segment_distance * segment_time_multiplier)

required_burn_salt = sum(segment_burn_salt for all segments)
travel_time_days = sum(segment_travel_time_days for all segments)
```

Where:

* `segment_distance` is the segment length in normalized interstellar travel units
* `segment_time_multiplier` is determined by `segment_mode`
* `segment_salt_multiplier` is determined by `segment_mode`
* each ship contributes `5` mass
* each `1 metal` contributes `1` mass
* each `4 salt` carried contributes `1` mass

This creates a useful baseline:

* `1` ship moving `1` distance costs `5 salt`
* `4` ships moving `2` distance costs `40 salt`
* carrying extra salt forward makes future movement easier but current movement more expensive
* a starlane route is usually preferred when speed and fuel efficiency matter
* a direct route is usually preferred when secrecy or lane avoidance matters

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
remaining_burn_salt = sum(remaining_segment_burn_salt)
course_change_penalty = max(2, ceil(0.25 * remaining_burn_salt))
turn_allowed = fleet.burn_salt_remaining >= remaining_burn_salt + course_change_penalty
```

When a fleet turns:

* `course_change_penalty` is consumed immediately
* a new `remaining_burn_salt` is computed from the new travel plan
* telescope observers do not automatically see the turn
* only probes or later arrival burns reveal the new path

17.7 Starlane Control and Blockade

Starlanes are optional, but they become natural campaign objectives because they are efficient and observable.

For the first implementation:

* a fleet stationed in a system may take a `blockade` mission against one or more connected starlane segments
* enemy fleets may still avoid the blockade by going off-lane, but doing so is slower and more expensive
* a blockading fleet creates a strong threat of interception against fleets that try to continue through the watched lane
* this makes intermediate systems valuable even when they are not rich in salt or metals

This is the intended strategic pattern:

* hold a waypoint system
* fortify it
* blockade the fast lane through it
* force the enemy to choose between delay, extra salt burn, or a contested passage

17.8 Resupply

* Fleets resupply by drawing salt from the system they are currently in
* A fleet may only harvest salt locally if its faction owns the system
* If a fleet runs out of salt while inside a star system, it must wait there until it can harvest or receive more salt

17.9 System Production

Systems generate salt and metals for their current owner while that owner remains in control.

Salt is intentionally not universal.

Most systems produce no salt at all. Salt-bearing systems are rarer, and they are usually the best long-term colony worlds.

Baseline daily salt output by salt profile:

```text
salt_none_output = 0 salt/day
salt_trace_output = 1 salt/day
salt_productive_output = 3 salt/day
salt_major_output = 6 salt/day
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
daily_salt_output = round(base_salt_output * salt_fluctuation)
daily_metal_output = round(base_metal_output * metal_fluctuation)
salt_fluctuation = random value between 0.90 and 1.10
metal_fluctuation = random value between 0.95 and 1.05
```

This means:

* many systems are worth holding for position even though they cannot fuel themselves
* a productive salt world can support routine communication and slow stockpiling
* a major salt world becomes a true logistics hub worth fighting over
* metal worlds and waypoint systems still matter because fleets can carry cargo salt forward

17.10 Operational Baseline

These equations are meant to produce the following gameplay feel:

* `1` productive salt world produces about `3 salt/day`, enough for regular messages and slow military preparation
* a faction with `1` productive salt world and `1` metal world can expand, but cannot launch major offensives casually
* a `4`-ship claim fleet moving `2` direct distance costs about `40 salt`, or roughly `13` days of output from one productive salt world
* starlanes reduce that cost and time enough to make them central campaign objectives
* large offensives require stockpiling salt ahead of time

17.11 Strategic Implications

* Salt-producing systems are strategically valuable even before considering population or industry
* Metal-rich systems may be worth holding even when they produce no salt
* Low-output frontier systems may still matter because they anchor probes, lane blockades, and relief operations
* Long-distance campaigns depend on fuel supply, not just fleet size
* Transporting fuel forward is itself a logistical commitment because fuel cargo makes fleets heavier

17.12 Minimal State Variables

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
* `system.salt_profile`
* `travel_plan.total_distance`
* `travel_plan.travel_time_days`
* `travel_plan.uses_starlane`

17.13 Example Travel Rule

```text
ship_mass = 5
metal_mass = fleet.metals
cargo_salt_mass = ceil(fleet.cargo_salt / 4)
fleet_dry_mass = fleet.ships * ship_mass
fleet_cargo_mass = metal_mass + cargo_salt_mass
effective_mass = fleet_dry_mass + fleet_cargo_mass
required_burn_salt = sum(segment_distance * effective_mass * segment_salt_multiplier for each segment)
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

Probes are dedicated scout assets placed into specific starlanes, regions, or approach corridors.

Probes are used to:

* detect fleets passing nearby
* narrow `possible_destinations[]`
* refresh stale information about a fleet already seen leaving a system
* create a deeper warning screen around important territory

18.6 Probe Deployment

For the first implementation:

* a probe costs `2 salt` and `2 metals` to build and deploy
* a probe is launched from a friendly system
* a probe is assigned exactly one `watched_starlane`, `watched_corridor`, or `watched_system_approach`
* a probe also records one `report_destination_system`
* a probe may store an integer `report_salt_reserve`

Probe travel uses the same travel timing model as a Pigeon.

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

18.10 Deep-Space Interception

Most battles still happen at star systems, but good reconnaissance may allow a fleet to intercept another fleet in deep space.

For the first implementation:

* interception requires enough information to predict a target corridor or starlane segment
* a blockaded starlane is the easiest place to force interception
* off-lane fleets are harder to find, but more vulnerable if caught

An interception battle represents catching a fleet while it is still strung out on the march.

Use a simple first-pass rule:

```text
intercepted_deployment_penalty = 0.25
intercepted_penalty_duration = 2 days
```

If a fleet is intercepted:

* the intercepted side suffers the deployment penalty for the first `2` combat days
* this represents a column being surprised before it fully concentrates
* if the fleet survives and reaches a star system later, normal system combat rules resume there

18.11 Battles Usually Happen At Systems

System battles remain the default and most common battle type.

That means:

* probes and scouting decide who understands the approach
* fleet movement and course changes decide who threatens which system
* starlanes decide where blockades and easy interceptions are likely
* battle resolution decides what happens once forces finally meet

18.12 Minimal State Variables

Initial recon evaluation may reference:

* `report.observed_at`
* `report.source_system`
* `report.burn_type`
* `report.estimated_fleet_mass`
* `report.initial_heading`
* `report.possible_destinations[]`
* `probe.location`
* `probe.status`
* `probe.watched_starlane`
* `probe.watched_corridor`
* `probe.report_destination_system`
* `probe.report_salt_reserve`
* `probe.durability`

18.13 Example Frontier Fork

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
* `system.salt_profile`
* `system.metal_richness`
* whether the system sits on a visible starlane junction

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
* useful differences in salt potential, metal richness, and strategic position

This creates a real choice between:

* taking a safer low-value waypoint quickly
* waiting longer to reach a richer salt or metal world

20.8 Claiming An Open System

Claiming an open system uses the same general control idea as conquest, but with a shorter timer.

The exact claim timer is defined in section `21.8 Capture And Claim Timers`.

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

* add daily salt production if it is a salt-bearing world
* add metal supply
* act as a forward staging point for later fleets
* become a fortified waypoint even if it produces little salt
* receive `trade` and `resupply` missions

This makes early expansion a logistics decision, not just a land grab.

20.11 Minimal State Variables

Initial exploration and expansion rules may reference:

* `system.owner`
* `system.star_type`
* `system.distance`
* `system.salt_profile`
* `system.metal_richness`
* `system.ships`
* `system.defense`
* `system.salt_output`
* `system.claim_progress`
* `system.claim_duration`

20.12 Example: Getting Your Second System

```text
1. Your home system identifies three nearby open stars
2. Astronomy shows that one is a barren waypoint, one is metal-rich, and one is a productive salt world
3. You stockpile enough salt for a small claim fleet
4. A scout ship enters the productive salt world and finds it open and lightly defended
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
* sieges buy time for relief forces
* flanking matters when one force pins and another arrives later
* information and timing matter because they determine who actually arrives in strength

The combat model should reward winning the campaign before the battle, not only clicking better during the battle.

21.2 Core Combat Power

For the first implementation, use a small number of explicit factors:

```text
ship_power = 1
defense_power = 3
hold_bonus = 0.15
siege_drag = 0.20
flank_bonus = 0.20
flank_duration_days = 3
cut_support_penalty = 0.10
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

if system.defense > 0:
  attacker_effective_power = attacker_effective_power * (1 - siege_drag)

if attacker_received_reinforcement_after_battle_start:
  attacker_effective_power = attacker_effective_power * (1 + flank_bonus)

if defender_received_reinforcement_after_battle_start:
  defender_effective_power = defender_effective_power * (1 + flank_bonus)

if attacker_support_system_is_blockaded:
  attacker_effective_power = attacker_effective_power * (1 - cut_support_penalty)

if defender_support_system_is_blockaded:
  defender_effective_power = defender_effective_power * (1 - cut_support_penalty)
```

This keeps the model simple while making fixed defenses matter, giving the current holder a modest advantage, and rewarding the classic pin-and-flank pattern.

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
* defended systems naturally behave more like sieges than open battles

21.4 Siege and Pinning

Prepared defenses should buy time, not just raw combat strength.

For the first implementation:

* if `system.defense > 0`, the battle is treated as a siege-like engagement
* siege-like engagements last longer because the attacker suffers `siege_drag`
* this gives nearby relief fleets time to matter

Pinning does not mean the defender is physically unable to retreat anywhere in space.

It means:

* leaving early abandons the defended objective
* leaving during an active siege risks defeat in detail
* leaving while a nearby support system is threatened may lose the wider campaign even if the local fleet escapes

21.5 Post-Tick Decisions

After each combat tick:

* ship counts and defense values are updated
* fleet rules are re-evaluated
* a fleet may continue to `engage`
* a fleet may `retreat` if its rules now demand it

This is where information and pre-written rules matter. A player who arrived with the larger force but the wrong standing order can still lose the campaign.

21.6 Flanking and Relief Arrival

Flanking should be operational rather than geometric.

For the first implementation:

* if a second fleet arrives after a battle has already started, that side gains `flank_bonus`
* `flank_bonus` lasts for `3` combat days after the reinforcing arrival
* if the enemy's nearest friendly support system is currently blockaded, that enemy also suffers `cut_support_penalty`

This rewards:

* pinning one enemy force in place
* arriving with a second force later
* using a captured or fortified waypoint system to threaten the rear

21.7 Meaningful Control

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

21.8 Capture And Claim Timers

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

21.9 Control Progress

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

21.10 Minimal State Variables

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
* `battle.days_since_start`
* `battle.last_reinforcement_day`
* `attacker_support_system_is_blockaded`
* `defender_support_system_is_blockaded`

21.11 Example: Prepared Defense

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
* repeats the same path and trade order

If the origin lacks enough cargo, the fleet waits instead of partially improvising a different mission.

22.7 Why Trade Matters

Trade should matter for three reasons:

* it lets a salt-bearing system support a metal-poor frontier
* it lets a metal-rich system fund defense and shipbuilding elsewhere
* it creates another reason to scout, protect starlanes, and fight over productive stars

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
salt_profile = productive
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

* `3` to `5` nearby open systems within direct distance `1` to `3`
* at least one `salt-bearing` option
* at least one `metal-rich` option
* at least one strategically useful waypoint or balanced option

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

23.6 Frontier Pocket Start

For the single-player or AI-first opening, a new player should usually begin inside a partially disconnected local cluster.

This cluster should have:

* enough nearby open systems to support several early decisions
* enough AI neighbors to produce diplomacy, pressure, and play-style discovery
* no immediate fast starlane path for a distant major power to overwhelm the player

The design goal is not full isolation. The player should still exist inside the same galaxy and receive delayed information about distant wars, expansions, and diplomatic shifts. The pocket is meant to protect the learning arc, not to create a separate tutorial map.

23.7 Home System Ramp

Home systems may begin strong and continue to grow into their role as strategic anchors.

One useful opening model is:

* home stars begin with meaningful but not overwhelming salt output
* home salt output ramps upward over time
* this makes early expansion valuable without making the first few days feel starved
* it also gives the player a natural sense that their civilization is maturing into a wider role

If this model is used, the ramp should be predictable and legible so players can plan around it rather than discovering it by accident.

23.8 Connecting To The Wider Galaxy

The player's local cluster should eventually be able to connect more directly to broader galactic traffic.

One intended midgame transition is:

* identify a strategic outward-facing system
* invest in a major starlane construction project
* decide when the benefits of faster travel and trade outweigh the exposure to stronger rivals

This connection moment should feel like graduation from local frontier politics into interstellar power politics.

It is especially valuable because it lets the player:

* learn early systems in a controlled environment
* remain part of the living galaxy the entire time
* choose when to invite greater danger in exchange for greater opportunity

## Future LLM Ideas

LLMs could make the game feel much more personal and alive, but they should usually sit on top of deterministic simulation rather than replace it. The model should add identity, interpretation, and believable behavior while staying grounded in actual world state, player knowledge, and explicit faction goals.

### Top Priority Directions

The most promising near- to mid-term LLM directions appear to be:

* empire DNA and faction identity generation
* advisor-mediated natural-language orders
* internal politics inside the player's empire
* NPC belief models rather than omniscient AI behavior
* intelligence and counterintelligence with manageable scope
* personalized reports, recaps, memory, and world-building

### Empire DNA And Faction Identity

Empire identity should be an onboarding conversation, not a single text box.

One useful flow is:

* prompt the player with starting identity frames such as `House`, `Corporation`, `Republic`, `Cult`, `Dynasty`, or `League`
* let the player talk with an AI until the identity feels right
* compile that conversation into a structured faction profile that drives the rest of the experience

The structured profile could include:

* government form
* core values
* taboos
* public tone
* elite tone
* military style
* economic ethos
* naming patterns
* symbols
* founding myth

That profile can then drive:

* faction names
* ship classes
* probe names
* ceremonial language
* diplomatic phrasing
* propaganda style
* advisor voice
* recap tone
* historical mythmaking

### Doctrines As Soft Pressure

Doctrine should create coherence and pressure, but not hard restrictions.

The AI can help propose or refine doctrines such as:

* never cede the frontier
* protect trade before honor
* avoid open war without intelligence superiority
* punish betrayal decisively

These doctrines should:

* influence how advisors frame choices
* shape praise, warnings, and criticism
* give the empire a recognizable worldview
* never block the player from choosing a different course

### Advisor-Mediated Orders

The advisor panel should support natural-language intent as a complement to the manual UI.

For example, the player could type:

```text
I want to scout the Povonis system.
```

The advisors should respond with:

* what they think the player means
* one or more concrete plans
* the risks and tradeoffs of each plan
* a structured action package the player can approve

This could reduce UI pressure without removing player control. The manual interface should remain available and canonical, while the LLM layer helps translate player intent into explicit game actions.

Important guardrails:

* freeform text should never execute directly without plan review
* plans should expose key assumptions
* the player should be able to approve, reject, or edit a plan before it becomes orders

### Internal Politics

Internal politics is one of the strongest ways to make the player's empire feel inhabited rather than abstract.

A manageable first version would introduce a small set of recurring internal blocs such as:

* military hawks
* trade guilds
* frontier governors
* intelligence bureau
* state cult or civic ideology

Each bloc should have:

* concrete material interests
* a distinct tone
* a recognizable theory of how the empire survives and wins

This gives advisors a reason to disagree in ways the player can learn and predict. The result should feel like governing a coalition of actors, not just receiving generic hints from a neutral helper.

### NPC Belief Models

NPCs should not merely be stronger optimizers. They should act on beliefs shaped by delayed reports, missing information, prejudice, doctrine, and recent shocks.

Key principles:

* NPCs should make decisions based on what they think is true, not perfect world truth
* their personalities should influence how they interpret uncertainty
* outsiders should infer those tendencies through observation rather than reading explicit labels

This helps the world feel more realistic and gives players the chance to learn an opponent's habits over time.

### Intelligence And Counterintelligence

This is especially promising, but it should begin with a tightly scoped ruleset.

A manageable starting set of deception actions could be:

* conceal intent
* plant rumor
* forge or distort message
* stage misleading fleet posture
* leak selected truth

The deterministic layer should decide:

* what information exists
* which messages are true, false, or mixed
* who receives them
* how confident recipients should be

The LLM layer should help with:

* writing the message itself
* expressing suspicion or confidence in reports
* generating rival interpretations when evidence is incomplete

This preserves clarity while still making intelligence warfare feel authored and alive.

### Personalized Reports And World Memory

Some of the highest-value uses of LLMs may simply be in how the world is narrated back to the player.

Strong opportunities include:

* intelligence briefings that explain what changed and why it matters
* multiple reporting styles such as military, political, logistics, or narrative chronicle
* "what happened while you were away?" recaps for asynchronous play
* after-action summaries that connect outcomes to causes
* historical memory that remembers betrayals, famous defenses, humiliating retreats, and decisive discoveries
* emergent admirals, governors, scouts, and envoys whose reputations come from actual events
* faction-specific diplomatic messages, propaganda, memorials, and intercepted chatter
* mythmaking that gradually turns a save file into a lived imperial history

### Lower-Priority Or More Complex Ideas

Some ideas are compelling but likely belong later:

* cultural drift across frontier systems
* more complex internal social simulation
* broader generative world texture beyond what players can meaningfully notice

These may become valuable once the core identity, advisor, politics, and intelligence systems are working.

### Realism Guardrails

* LLM output should never invent hidden world facts; it should only speak from actual state, delivered reports, or clearly marked inference.
* Strategic decisions and outcomes should still resolve through explicit game rules so players can learn, predict, and outplay the system rather than feeling like results are arbitrary.
* The most effective architecture is likely layered: deterministic simulation for truth, small models for advisor interaction and NPC intent, and stronger models only where higher-quality writing materially improves the player experience.

## TODO

This section is meant to capture open implementation work so future coding agents can pick up where design discussion left off. Assume these items are still open even if parts of the system already resemble them.

### Current Advisor Baseline

These pieces are now implemented in the local command table and should be treated as the starting point rather than aspirational design only:

* the default landing page is now the `Advisors` pane rather than the galactic map
* the daily loop is framed as one opportunity, one threat, and one lesson
* the daily brief is surfaced as a distinct morning council brief
* the live signal queue is now presented as advisor interpretations rather than raw generic feed items
* report items carry named advisor attribution and consequence-oriented analysis
* the notebook includes a strategy board and council readout
* the player can mark systems with strategic intent such as `explore`, `expand`, `threat`, `screen`, `economic_priority`, and `future_link`
* advisor suggestions already react to those strategic markings
* reports can be triaged into archive and notebook follow-up queues

### Near-Term Advisor And Opening TODO

These are the remaining pieces most directly adjacent to the current implementation and should likely be tackled before broader LLM or political systems:

* add first-class diplomatic pigeons to the advisor pane instead of only implying diplomatic pressure through stance summaries
* generate distinct faction voices for pigeons such as threatening, conciliatory, opportunistic, or deceptive messages
* let advisors disagree explicitly about how to interpret the same pigeon or report
* make more consequence explanations cite concrete causes such as a pinned fleet, a blockade on a specific lane, a late probe, or a stripped reserve
* connect strategic markings more deeply into reports so advisors can say things like "your marked threat world just received reinforcements"
* add stronger after-action explanation flows for battles, lost control, failed expansion, and successful screening
* build the early-game frontier pocket/apprenticeship setup where the player begins in a partially isolated AI neighborhood
* implement the home-system salt ramp and outward starlane progression that eventually links the local pocket to the wider galaxy
* ensure the single-player or AI-heavy opening reliably produces at least one opportunity, one threat, and one lesson each day
* decide whether advisor reliability should become an explicit mechanic now or stay implicit until more advisor disagreement exists

### Core Product Decisions

* define the first playable scope for LLM-driven features and decide what belongs in phase 1 versus later phases
* define which model tiers are needed for which jobs such as advisor interaction, summarization, NPC intent generation, and high-quality narrative writing
* define a hard contract between deterministic simulation truth and generated interpretation so all AI features stay grounded
* define what data each AI-facing subsystem is allowed to see, especially for player knowledge versus hidden world truth

### Empire DNA Onboarding

* design a conversational empire-creation flow that starts from frames like `House`, `Corporation`, `Republic`, `Cult`, `Dynasty`, or `League`
* define the structured faction profile produced by that conversation
* decide which parts of the profile are player-editable after creation and which are historical record
* generate naming, tone, ceremony, slogans, and mythic language from the structured profile
* persist the faction profile in a format that can be reused by advisors, reports, diplomacy, and recap systems

### Doctrine System

* define how doctrines are proposed, accepted, revised, or ignored by the player
* define how doctrines influence advisor tone and recommendations without creating hard gameplay locks
* decide whether doctrines are explicit player choices, AI-suggested defaults, or both
* define how NPC doctrines are represented internally and how players might infer them from behavior

### Advisor-Mediated Orders

* add an advisor input box where the player can express intent in natural language
* define the pipeline that turns player intent into one or more structured candidate plans
* define the approval UX so no freeform request executes without review
* expose assumptions, risks, and tradeoffs for each candidate plan before approval
* allow the player to edit, reject, or manually recreate a suggested plan in the canonical UI
* define how advisors explain ambiguity when the player's request is underspecified
* create example intents such as scouting a system, reinforcing a frontier, launching a probe, fortifying a world, or preparing a diplomatic message

### Internal Politics

* define the first set of internal political blocs such as military hawks, trade guilds, frontier governors, intelligence bureau, and state cult or civic ideology
* define what each bloc cares about materially and ideologically
* define how those blocs surface through specific advisors, reports, and disagreements
* define whether bloc influence changes over time based on victories, losses, expansion, shortages, or scandals
* create a first-pass system for advisor disagreement so the player feels like they are governing competing interests rather than receiving generic helper text

### NPC Belief Models

* define the hidden belief state each NPC maintains about rival strength, intent, territory, logistics, and credibility
* define how delayed reports, rumors, doctrine, and personality update those beliefs
* define compact personality dimensions for rulers such as caution, pride, paranoia, opportunism, and revenge
* ensure NPCs act on believed world state rather than perfect truth
* define how players can infer NPC tendencies indirectly through actions, timing, and diplomatic language

### Intelligence And Counterintelligence

* define the first small set of deception and intelligence actions such as conceal intent, plant rumor, forge message, stage posture, and leak selected truth
* define what makes a deception attempt plausible, what evidence it leaves behind, and how confidence is represented
* define who receives deceptive information and how it propagates through reports and diplomacy
* define how player-facing reports communicate uncertainty without becoming vague or useless
* build example intelligence scenarios that test misinformation, partial truth, and conflicting interpretations

### Reports, Recaps, And Memory

* design report-generation prompts or templates for military, political, logistics, and narrative briefing styles
* create a "what happened while you were away?" recap flow for asynchronous return sessions
* define after-action summary generation that explains outcomes in terms of real causes from simulation history
* define how world memory stores betrayals, famous defenses, humiliating retreats, decisive discoveries, and named characters
* generate persistent mythic or historical language that reflects each empire's DNA and remembered events

### Emergent Characters And Diplomacy

* define how admirals, governors, scouts, envoys, or intelligence chiefs emerge from actual game events
* define what character traits and reputations are worth persisting
* create diplomatic message generation that reflects faction identity, current leverage, and remembered history
* create propaganda, memorial, and intercepted-message writing flows grounded in real events

### UI, Safety, And Validation

* define the validation layer for all AI-generated plans and messages before they affect gameplay state
* define fallback behavior when the AI is uncertain, unavailable, or produces an invalid plan
* ensure every AI-generated action can be inspected in structured form by the player
* define logging and debugging tools so future developers can inspect prompts, inputs, outputs, and validation failures
* define test fixtures and replay scenarios for advisor plans, recap generation, doctrine tone, and NPC belief updates

### Open Questions

* should advisors primarily feel like interface helpers, political actors inside the empire, or a hybrid of both
* how much of internal politics should be simulation versus presentation in the first implementation
* how visible should doctrine be to the player and how hidden should doctrine remain for NPCs
* how much ambiguity in intelligence reports is fun before it becomes frustrating
* when should the game use a small fast model versus a stronger slower model
