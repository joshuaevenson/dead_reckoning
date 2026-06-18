import type { ScenarioDefinition } from "../types.js";

export const scenarioCatalog: Record<string, ScenarioDefinition> = {
  "economy_frontier_claim": {
    "name": "economy_frontier_claim",
    "seed": 7,
    "startDate": "2240-01-01",
    "durationDays": 10,
    "factions": [
      {
        "id": "blue",
        "name": "Blue League",
        "homeSystemId": "home"
      }
    ],
    "systems": [
      {
        "id": "home",
        "name": "Home",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "blue",
        "saltStockpile": 60,
        "metalStockpile": 80,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 120,
        "garrisonShips": {
          "blue": 6
        }
      },
      {
        "id": "frontier",
        "name": "Frontier",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      }
    ],
    "routes": [
      {
        "id": "home-frontier",
        "a": "home",
        "b": "frontier",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "frontier",
        "headingFromB": "homeward"
      }
    ],
    "commands": [
      {
        "type": "launch_fleet",
        "at": "2240-01-01",
        "factionId": "blue",
        "originSystemId": "home",
        "destinationSystemId": "frontier",
        "ships": 4,
        "mission": "attack",
        "cargoSalt": 0,
        "metals": 0,
        "retreatSystemId": "home",
        "name": "Claim Fleet"
      }
    ],
    "expectations": [
      {
        "at": "2240-01-01",
        "path": "systems.home.saltStockpile",
        "op": "lte",
        "value": 24
      },
      {
        "at": "2240-01-06",
        "path": "systems.frontier.ownerId",
        "op": "eq",
        "value": "blue"
      },
      {
        "at": "2240-01-10",
        "path": "systems.frontier.saltStockpile",
        "op": "gte",
        "value": 4
      }
    ]
  },
  "economy_sparse_full_scale": {
    "name": "economy_sparse_full_scale",
    "seed": 43,
    "startDate": "2240-07-01",
    "durationDays": 90,
    "commanderProfiles": [
      {
        "id": "disciplined",
        "kind": "frontier_expander",
        "options": {
          "preferredSystems": 5,
          "claimFleetShips": 4,
          "homeReserveShips": 3,
          "frontierDefenseTarget": 1,
          "maxExpansionDistance": 6
        }
      },
      {
        "id": "chatty",
        "kind": "chatty_frontier",
        "options": {
          "preferredSystems": 5,
          "claimFleetShips": 4,
          "homeReserveShips": 3,
          "frontierDefenseTarget": 1,
          "maxExpansionDistance": 6
        }
      }
    ],
    "factions": [
      {
        "id": "disc",
        "name": "Aster Crown",
        "homeSystemId": "disc_home",
        "commanderProfileId": "disciplined"
      },
      {
        "id": "chat",
        "name": "Verdant Wake",
        "homeSystemId": "chat_home",
        "commanderProfileId": "chatty"
      }
    ],
    "systems": [
      {
        "id": "disc_home",
        "name": "Sol",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "major",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "disc_gate"
        ],
        "ownerId": "disc",
        "saltStockpile": 180,
        "metalStockpile": 160,
        "probeStockpile": 2,
        "infrastructure": 10,
        "defense": 8,
        "controlAgeDays": 400,
        "garrisonShips": {
          "disc": 8
        }
      },
      {
        "id": "disc_gate",
        "name": "Barnard's Star",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "disc_home",
          "disc_basin",
          "disc_outpost"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "disc_outpost",
        "name": "Ross 154",
        "position": {
          "x": 2,
          "y": 2
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "rich",
        "starlaneLinks": [
          "disc_gate"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "disc_basin",
        "name": "Lalande 21185",
        "position": {
          "x": 4,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "standard",
        "starlaneLinks": [
          "disc_gate",
          "center_screen",
          "disc_ore"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "disc_ore",
        "name": "Sirius",
        "position": {
          "x": 4,
          "y": 2
        },
        "starType": "white_blue_star",
        "saltProfile": "none",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "disc_basin"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "center_screen",
        "name": "Procyon",
        "position": {
          "x": 6,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "poor",
        "starlaneLinks": [
          "disc_basin",
          "salt_crown",
          "center_north",
          "center_south"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "center_north",
        "name": "Vega",
        "position": {
          "x": 6,
          "y": 2
        },
        "starType": "white_blue_star",
        "saltProfile": "none",
        "metalRichness": "rich",
        "starlaneLinks": [
          "center_screen"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "center_south",
        "name": "Fomalhaut",
        "position": {
          "x": 6,
          "y": -2
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "center_screen"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "salt_crown",
        "name": "Epsilon Eridani",
        "position": {
          "x": 8,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "rich",
        "starlaneLinks": [
          "center_screen",
          "chat_basin"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "chat_basin",
        "name": "61 Cygni",
        "position": {
          "x": 10,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "standard",
        "starlaneLinks": [
          "salt_crown",
          "chat_gate",
          "chat_ore"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "chat_ore",
        "name": "Altair",
        "position": {
          "x": 10,
          "y": -2
        },
        "starType": "white_blue_star",
        "saltProfile": "none",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "chat_basin"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "chat_gate",
        "name": "Wolf 359",
        "position": {
          "x": 12,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "chat_basin",
          "chat_home",
          "chat_outpost"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "chat_outpost",
        "name": "Groombridge 34",
        "position": {
          "x": 12,
          "y": -2
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "rich",
        "starlaneLinks": [
          "chat_gate"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "chat_home",
        "name": "Tau Ceti",
        "position": {
          "x": 14,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "major",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "chat_gate"
        ],
        "ownerId": "chat",
        "saltStockpile": 180,
        "metalStockpile": 160,
        "probeStockpile": 2,
        "infrastructure": 10,
        "defense": 8,
        "controlAgeDays": 400,
        "garrisonShips": {
          "chat": 8
        }
      }
    ],
    "routes": [
      {
        "id": "disc-home-gate",
        "a": "disc_home",
        "b": "disc_gate",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "frontier",
        "headingFromB": "homeward"
      },
      {
        "id": "disc-gate-basin",
        "a": "disc_gate",
        "b": "disc_basin",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "basin",
        "headingFromB": "gate"
      },
      {
        "id": "disc-gate-outpost",
        "a": "disc_gate",
        "b": "disc_outpost",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "outpost",
        "headingFromB": "gate"
      },
      {
        "id": "disc-basin-ore",
        "a": "disc_basin",
        "b": "disc_ore",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "ore",
        "headingFromB": "basin"
      },
      {
        "id": "disc-basin-screen",
        "a": "disc_basin",
        "b": "center_screen",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "screen",
        "headingFromB": "basin"
      },
      {
        "id": "screen-north",
        "a": "center_screen",
        "b": "center_north",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "north",
        "headingFromB": "screen"
      },
      {
        "id": "screen-south",
        "a": "center_screen",
        "b": "center_south",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "south",
        "headingFromB": "screen"
      },
      {
        "id": "screen-crown",
        "a": "center_screen",
        "b": "salt_crown",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "crown",
        "headingFromB": "screen"
      },
      {
        "id": "crown-chat-basin",
        "a": "salt_crown",
        "b": "chat_basin",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "chat",
        "headingFromB": "crown"
      },
      {
        "id": "chat-basin-ore",
        "a": "chat_basin",
        "b": "chat_ore",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "ore",
        "headingFromB": "basin"
      },
      {
        "id": "chat-basin-gate",
        "a": "chat_basin",
        "b": "chat_gate",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "gate",
        "headingFromB": "basin"
      },
      {
        "id": "chat-gate-home",
        "a": "chat_gate",
        "b": "chat_home",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "homeward",
        "headingFromB": "frontier"
      },
      {
        "id": "chat-gate-outpost",
        "a": "chat_gate",
        "b": "chat_outpost",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "outpost",
        "headingFromB": "gate"
      }
    ],
    "expectations": [
      {
        "at": "2240-09-28",
        "path": "factions.disc.ownedSystems",
        "op": "gte",
        "value": 3
      },
      {
        "at": "2240-09-28",
        "path": "factions.chat.ownedSystems",
        "op": "gte",
        "value": 2
      },
      {
        "at": "2240-09-28",
        "path": "factions.chat.reportCount",
        "op": "gte",
        "value": 20
      },
      {
        "at": "2240-09-28",
        "path": "systems.disc_ore.saltStockpile",
        "op": "eq",
        "value": 0
      },
      {
        "at": "2240-09-28",
        "path": "systems.disc_ore.metalStockpile",
        "op": "gte",
        "value": 0
      }
    ]
  },
  "information_probe_warning": {
    "name": "information_probe_warning",
    "seed": 11,
    "startDate": "2240-02-01",
    "durationDays": 8,
    "factions": [
      {
        "id": "blue",
        "name": "Aster Crown",
        "homeSystemId": "home"
      },
      {
        "id": "red",
        "name": "Crimson Wake",
        "homeSystemId": "enemy_home"
      }
    ],
    "systems": [
      {
        "id": "home",
        "name": "Sol",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "starlaneLinks": [
          "watch",
          "frontier_west",
          "frontier_east"
        ],
        "ownerId": "blue",
        "saltStockpile": 50,
        "metalStockpile": 50,
        "probeStockpile": 3,
        "infrastructure": 8,
        "defense": 5,
        "controlAgeDays": 200,
        "garrisonShips": {
          "blue": 6
        }
      },
      {
        "id": "frontier_west",
        "name": "Barnard's Star",
        "position": {
          "x": 2,
          "y": 2
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "starlaneLinks": [
          "home",
          "watch"
        ],
        "ownerId": "blue",
        "saltStockpile": 20,
        "metalStockpile": 20,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 30,
        "garrisonShips": {
          "blue": 3
        }
      },
      {
        "id": "frontier_east",
        "name": "Sirius",
        "position": {
          "x": 2,
          "y": -2
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "starlaneLinks": [
          "home",
          "watch"
        ],
        "ownerId": "blue",
        "saltStockpile": 20,
        "metalStockpile": 20,
        "probeStockpile": 1,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 30,
        "garrisonShips": {
          "blue": 3
        }
      },
      {
        "id": "enemy_home",
        "name": "Tau Ceti",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "starlaneLinks": [
          "watch"
        ],
        "ownerId": "red",
        "saltStockpile": 120,
        "metalStockpile": 80,
        "probeStockpile": 2,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "red": 10
        }
      },
      {
        "id": "watch",
        "name": "Ross 154",
        "position": {
          "x": 1,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "poor",
        "starlaneLinks": [
          "home",
          "frontier_west",
          "frontier_east",
          "enemy_home"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 0,
        "defense": 0,
        "controlAgeDays": 0
      }
    ],
    "routes": [
      {
        "id": "home-west",
        "a": "home",
        "b": "frontier_west",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "west",
        "headingFromB": "core"
      },
      {
        "id": "home-east",
        "a": "home",
        "b": "frontier_east",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "east",
        "headingFromB": "core"
      },
      {
        "id": "enemy-watch",
        "a": "enemy_home",
        "b": "watch",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "frontier",
        "headingFromB": "enemy"
      },
      {
        "id": "watch-west",
        "a": "watch",
        "b": "frontier_west",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "west",
        "headingFromB": "watch"
      },
      {
        "id": "watch-east",
        "a": "watch",
        "b": "frontier_east",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "east",
        "headingFromB": "watch"
      },
      {
        "id": "home-watch",
        "a": "home",
        "b": "watch",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "screen",
        "headingFromB": "homeward"
      }
    ],
    "commands": [
      {
        "type": "deploy_probe",
        "at": "2240-02-01",
        "factionId": "blue",
        "originSystemId": "home",
        "anchorSystemId": "watch",
        "reportDestinationSystemId": "home",
        "watchedSystemApproachId": "frontier_west",
        "reportSaltReserve": 1
      },
      {
        "type": "launch_fleet",
        "at": "2240-02-02",
        "factionId": "red",
        "originSystemId": "enemy_home",
        "destinationSystemId": "frontier_west",
        "ships": 6,
        "mission": "attack",
        "cargoSalt": 0,
        "metals": 0,
        "retreatSystemId": "enemy_home",
        "name": "Raiding Fleet"
      }
    ],
    "expectations": [
      {
        "at": "2240-02-04",
        "path": "factions.blue.reportCount",
        "op": "gte",
        "value": 2
      }
    ]
  },
  "long_horizon_information_campaign": {
    "name": "long_horizon_information_campaign",
    "seed": 59,
    "startDate": "2241-01-01",
    "durationDays": 110,
    "commanderProfiles": [
      {
        "id": "napoleon",
        "kind": "napoleonic",
        "options": {
          "homeReserveShips": 5,
          "minimumAttackShips": 7,
          "preferredSystems": 3,
          "blockadeShips": 3
        }
      },
      {
        "id": "bad",
        "kind": "bad_commander",
        "options": {
          "borderShipTarget": 6,
          "homeDefenseTarget": 8,
          "panicPigeonThreshold": 1
        }
      }
    ],
    "factions": [
      {
        "id": "napoleon",
        "name": "Aster Crown",
        "homeSystemId": "n_home",
        "commanderProfileId": "napoleon"
      },
      {
        "id": "bad",
        "name": "Crimson Wake",
        "homeSystemId": "b_home",
        "commanderProfileId": "bad"
      }
    ],
    "initialReports": [
      {
        "factionId": "napoleon",
        "type": "intel",
        "observedAt": "2241-01-01",
        "sourceSystemId": "n_home",
        "content": {
          "systemId": "b_basin",
          "ownerId": "bad",
          "ships": 4,
          "defense": 1
        }
      },
      {
        "factionId": "napoleon",
        "type": "intel",
        "observedAt": "2241-01-01",
        "sourceSystemId": "n_home",
        "content": {
          "systemId": "crown",
          "ownerId": "bad",
          "ships": 2,
          "defense": 0
        }
      }
    ],
    "systems": [
      {
        "id": "n_home",
        "name": "Sol",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "major",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "n_gate"
        ],
        "ownerId": "napoleon",
        "saltStockpile": 220,
        "metalStockpile": 180,
        "probeStockpile": 2,
        "infrastructure": 10,
        "defense": 8,
        "controlAgeDays": 500,
        "garrisonShips": {
          "napoleon": 16
        }
      },
      {
        "id": "n_gate",
        "name": "Barnard's Star",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "n_home",
          "n_basin"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "n_basin",
        "name": "Lalande 21185",
        "position": {
          "x": 4,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "standard",
        "starlaneLinks": [
          "n_gate",
          "screen",
          "n_ore"
        ],
        "ownerId": "napoleon",
        "saltStockpile": 35,
        "metalStockpile": 26,
        "probeStockpile": 0,
        "infrastructure": 3,
        "defense": 1,
        "controlAgeDays": 120,
        "garrisonShips": {
          "napoleon": 4
        }
      },
      {
        "id": "n_ore",
        "name": "Sirius",
        "position": {
          "x": 4,
          "y": 2
        },
        "starType": "white_blue_star",
        "saltProfile": "none",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "n_basin"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "screen",
        "name": "Procyon",
        "position": {
          "x": 6,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "poor",
        "starlaneLinks": [
          "n_basin",
          "crown"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "crown",
        "name": "Epsilon Eridani",
        "position": {
          "x": 8,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "rich",
        "starlaneLinks": [
          "screen",
          "b_basin"
        ],
        "ownerId": "bad",
        "saltStockpile": 18,
        "metalStockpile": 18,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 80,
        "garrisonShips": {
          "bad": 2
        }
      },
      {
        "id": "b_basin",
        "name": "61 Cygni",
        "position": {
          "x": 10,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "standard",
        "starlaneLinks": [
          "crown",
          "b_gate",
          "b_ore"
        ],
        "ownerId": "bad",
        "saltStockpile": 35,
        "metalStockpile": 26,
        "probeStockpile": 0,
        "infrastructure": 3,
        "defense": 1,
        "controlAgeDays": 120,
        "garrisonShips": {
          "bad": 4
        }
      },
      {
        "id": "b_ore",
        "name": "Altair",
        "position": {
          "x": 10,
          "y": -2
        },
        "starType": "white_blue_star",
        "saltProfile": "none",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "b_basin"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "b_gate",
        "name": "Wolf 359",
        "position": {
          "x": 12,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "b_basin",
          "b_home"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "b_home",
        "name": "Tau Ceti",
        "position": {
          "x": 14,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "major",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "b_gate"
        ],
        "ownerId": "bad",
        "saltStockpile": 240,
        "metalStockpile": 180,
        "probeStockpile": 1,
        "infrastructure": 10,
        "defense": 8,
        "controlAgeDays": 500,
        "garrisonShips": {
          "bad": 12
        }
      }
    ],
    "routes": [
      {
        "id": "n-home-gate",
        "a": "n_home",
        "b": "n_gate",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "frontier",
        "headingFromB": "homeward"
      },
      {
        "id": "n-gate-basin",
        "a": "n_gate",
        "b": "n_basin",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "basin",
        "headingFromB": "gate"
      },
      {
        "id": "n-basin-ore",
        "a": "n_basin",
        "b": "n_ore",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "ore",
        "headingFromB": "basin"
      },
      {
        "id": "n-basin-screen",
        "a": "n_basin",
        "b": "screen",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "screen",
        "headingFromB": "basin"
      },
      {
        "id": "screen-crown",
        "a": "screen",
        "b": "crown",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "crown",
        "headingFromB": "screen"
      },
      {
        "id": "crown-basin",
        "a": "crown",
        "b": "b_basin",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "bad",
        "headingFromB": "crown"
      },
      {
        "id": "b-basin-ore",
        "a": "b_basin",
        "b": "b_ore",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "ore",
        "headingFromB": "basin"
      },
      {
        "id": "b-basin-gate",
        "a": "b_basin",
        "b": "b_gate",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "gate",
        "headingFromB": "basin"
      },
      {
        "id": "b-gate-home",
        "a": "b_gate",
        "b": "b_home",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "homeward",
        "headingFromB": "frontier"
      }
    ],
    "commands": [
      {
        "type": "launch_fleet",
        "at": "2241-01-02",
        "factionId": "bad",
        "originSystemId": "b_home",
        "destinationSystemId": "crown",
        "ships": 4,
        "mission": "reinforce",
        "cargoSalt": 0,
        "metals": 0,
        "retreatSystemId": "b_home",
        "name": "Crown Relief"
      }
    ],
    "expectations": [
      {
        "at": "2241-04-20",
        "path": "systems.crown.ownerId",
        "op": "eq",
        "value": "bad"
      },
      {
        "at": "2241-04-20",
        "path": "systems.b_gate.ownerId",
        "op": "eq",
        "value": "napoleon"
      },
      {
        "at": "2241-04-20",
        "path": "factions.bad.reportCount",
        "op": "gte",
        "value": 30
      }
    ]
  },
  "napoleon_beats_bad_commander": {
    "name": "napoleonic_pressure_reveals_defender_advantage",
    "seed": 19,
    "startDate": "2240-03-01",
    "durationDays": 20,
    "commanderProfiles": [
      {
        "id": "napoleon",
        "kind": "napoleonic",
        "options": {
          "homeReserveShips": 4,
          "minimumAttackShips": 6,
          "preferredSystems": 2
        }
      },
      {
        "id": "bad",
        "kind": "bad_commander",
        "options": {
          "borderShipTarget": 5,
          "homeDefenseTarget": 7
        }
      }
    ],
    "factions": [
      {
        "id": "napoleon",
        "name": "Napoleonic League",
        "homeSystemId": "n_home",
        "commanderProfileId": "napoleon"
      },
      {
        "id": "bad",
        "name": "Bad Admiralty",
        "homeSystemId": "b_home",
        "commanderProfileId": "bad"
      }
    ],
    "initialReports": [
      {
        "factionId": "napoleon",
        "type": "intel",
        "observedAt": "2240-03-01",
        "sourceSystemId": "n_home",
        "content": {
          "systemId": "west",
          "ownerId": "bad",
          "ships": 3,
          "defense": 1
        }
      },
      {
        "factionId": "napoleon",
        "type": "intel",
        "observedAt": "2240-03-01",
        "sourceSystemId": "n_home",
        "content": {
          "systemId": "east",
          "ownerId": "bad",
          "ships": 3,
          "defense": 1
        }
      }
    ],
    "systems": [
      {
        "id": "n_home",
        "name": "Napoleon Home",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "napoleon",
        "saltStockpile": 140,
        "metalStockpile": 90,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 300,
        "garrisonShips": {
          "napoleon": 14
        }
      },
      {
        "id": "b_home",
        "name": "Bad Home",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "bad",
        "saltStockpile": 120,
        "metalStockpile": 90,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 300,
        "garrisonShips": {
          "bad": 10
        }
      },
      {
        "id": "fork",
        "name": "Fork",
        "position": {
          "x": 1,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "poor",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 0,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "west",
        "name": "West Gate",
        "position": {
          "x": 2,
          "y": 1.5
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "ownerId": "bad",
        "saltStockpile": 18,
        "metalStockpile": 18,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 45,
        "garrisonShips": {
          "bad": 3
        }
      },
      {
        "id": "east",
        "name": "East Gate",
        "position": {
          "x": 2,
          "y": -1.5
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "bad",
        "saltStockpile": 18,
        "metalStockpile": 18,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 45,
        "garrisonShips": {
          "bad": 3
        }
      }
    ],
    "routes": [
      {
        "id": "n-fork",
        "a": "n_home",
        "b": "fork",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "frontier",
        "headingFromB": "napoleon"
      },
      {
        "id": "b-fork",
        "a": "b_home",
        "b": "fork",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "frontier",
        "headingFromB": "bad"
      },
      {
        "id": "fork-west",
        "a": "fork",
        "b": "west",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "west",
        "headingFromB": "fork"
      },
      {
        "id": "fork-east",
        "a": "fork",
        "b": "east",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "east",
        "headingFromB": "fork"
      }
    ],
    "expectations": [
      {
        "at": "2240-03-20",
        "path": "systems.west.ownerId",
        "op": "eq",
        "value": "bad"
      },
      {
        "at": "2240-03-20",
        "path": "systems.east.ownerId",
        "op": "eq",
        "value": "bad"
      },
      {
        "at": "2240-03-20",
        "path": "factions.bad.ownedSystems",
        "op": "eq",
        "value": 3
      },
      {
        "at": "2240-03-20",
        "path": "factions.napoleon.totalSaltStockpile",
        "op": "lt",
        "value": 100
      }
    ]
  },
  "napoleon_beats_bad_commander_with_extra_salt": {
    "name": "extra_salt_still_needs_better_maneuver",
    "seed": 19,
    "startDate": "2240-03-01",
    "durationDays": 26,
    "commanderProfiles": [
      {
        "id": "napoleon",
        "kind": "napoleonic",
        "options": {
          "homeReserveShips": 4,
          "minimumAttackShips": 6,
          "preferredSystems": 2
        }
      },
      {
        "id": "bad",
        "kind": "bad_commander",
        "options": {
          "borderShipTarget": 5,
          "homeDefenseTarget": 7
        }
      }
    ],
    "factions": [
      {
        "id": "napoleon",
        "name": "Napoleonic League",
        "homeSystemId": "n_home",
        "commanderProfileId": "napoleon"
      },
      {
        "id": "bad",
        "name": "Bad Admiralty",
        "homeSystemId": "b_home",
        "commanderProfileId": "bad"
      }
    ],
    "initialReports": [
      {
        "factionId": "napoleon",
        "type": "intel",
        "observedAt": "2240-03-01",
        "sourceSystemId": "n_home",
        "content": {
          "systemId": "west",
          "ownerId": "bad",
          "ships": 3,
          "defense": 1
        }
      },
      {
        "factionId": "napoleon",
        "type": "intel",
        "observedAt": "2240-03-01",
        "sourceSystemId": "n_home",
        "content": {
          "systemId": "east",
          "ownerId": "bad",
          "ships": 3,
          "defense": 1
        }
      }
    ],
    "systems": [
      {
        "id": "n_home",
        "name": "Napoleon Home",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "napoleon",
        "saltStockpile": 260,
        "metalStockpile": 90,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 300,
        "garrisonShips": {
          "napoleon": 14
        }
      },
      {
        "id": "b_home",
        "name": "Bad Home",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "bad",
        "saltStockpile": 100,
        "metalStockpile": 90,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 300,
        "garrisonShips": {
          "bad": 10
        }
      },
      {
        "id": "fork",
        "name": "Fork",
        "position": {
          "x": 1,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "poor",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 0,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "west",
        "name": "West Gate",
        "position": {
          "x": 2,
          "y": 1.5
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "ownerId": "bad",
        "saltStockpile": 18,
        "metalStockpile": 18,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 45,
        "garrisonShips": {
          "bad": 3
        }
      },
      {
        "id": "east",
        "name": "East Gate",
        "position": {
          "x": 2,
          "y": -1.5
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "bad",
        "saltStockpile": 18,
        "metalStockpile": 18,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 45,
        "garrisonShips": {
          "bad": 3
        }
      }
    ],
    "routes": [
      {
        "id": "n-fork",
        "a": "n_home",
        "b": "fork",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "frontier",
        "headingFromB": "napoleon"
      },
      {
        "id": "b-fork",
        "a": "b_home",
        "b": "fork",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "frontier",
        "headingFromB": "bad"
      },
      {
        "id": "fork-west",
        "a": "fork",
        "b": "west",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "west",
        "headingFromB": "fork"
      },
      {
        "id": "fork-east",
        "a": "fork",
        "b": "east",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "east",
        "headingFromB": "fork"
      }
    ],
    "expectations": [
      {
        "at": "2240-03-26",
        "path": "systems.west.ownerId",
        "op": "eq",
        "value": "bad"
      },
      {
        "at": "2240-03-26",
        "path": "systems.east.ownerId",
        "op": "eq",
        "value": "bad"
      },
      {
        "at": "2240-03-26",
        "path": "factions.napoleon.ownedSystems",
        "op": "gte",
        "value": 1
      }
    ]
  },
  "probe_origin_choice": {
    "name": "probe_origin_choice",
    "seed": 19,
    "startDate": "2240-05-01",
    "durationDays": 2,
    "factions": [
      {
        "id": "blue",
        "name": "Aster Crown",
        "homeSystemId": "blue_home"
      },
      {
        "id": "green",
        "name": "Verdant Bastion",
        "homeSystemId": "green_home"
      }
    ],
    "systems": [
      {
        "id": "blue_home",
        "name": "Sol",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "none",
        "metalRichness": "poor",
        "starlaneLinks": [
          "blue_frontier"
        ],
        "ownerId": "blue",
        "saltStockpile": 20,
        "metalStockpile": 20,
        "probeStockpile": 3,
        "infrastructure": 8,
        "defense": 4,
        "controlAgeDays": 150,
        "garrisonShips": {
          "blue": 5
        }
      },
      {
        "id": "blue_frontier",
        "name": "Barnard's Star",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "poor",
        "starlaneLinks": [
          "blue_home",
          "green_target"
        ],
        "ownerId": "blue",
        "saltStockpile": 1,
        "metalStockpile": 1,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 40,
        "garrisonShips": {
          "blue": 2
        }
      },
      {
        "id": "green_target",
        "name": "Wolf 359",
        "position": {
          "x": 5,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "none",
        "metalRichness": "rich",
        "starlaneLinks": [
          "blue_frontier",
          "green_home"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "green_home",
        "name": "Tau Ceti",
        "position": {
          "x": 8,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "none",
        "metalRichness": "poor",
        "starlaneLinks": [
          "green_target"
        ],
        "ownerId": "green",
        "saltStockpile": 20,
        "metalStockpile": 20,
        "probeStockpile": 2,
        "infrastructure": 8,
        "defense": 4,
        "controlAgeDays": 150,
        "garrisonShips": {
          "green": 5
        }
      }
    ],
    "expectations": [
      {
        "at": "2240-05-02",
        "path": "systems.blue_frontier.ownerId",
        "op": "eq",
        "value": "blue"
      }
    ]
  },
  "profile_comms_discipline": {
    "name": "profile_comms_discipline",
    "seed": 37,
    "startDate": "2240-05-01",
    "durationDays": 20,
    "commanderProfiles": [
      {
        "id": "disciplined",
        "kind": "frontier_expander",
        "options": {
          "preferredSystems": 3,
          "claimFleetShips": 4,
          "homeReserveShips": 2,
          "frontierDefenseTarget": 1,
          "maxExpansionDistance": 3
        }
      },
      {
        "id": "chatty",
        "kind": "chatty_frontier",
        "options": {
          "preferredSystems": 3,
          "claimFleetShips": 4,
          "homeReserveShips": 2,
          "frontierDefenseTarget": 1,
          "maxExpansionDistance": 3
        }
      }
    ],
    "factions": [
      {
        "id": "disc",
        "name": "Disciplined League",
        "homeSystemId": "disc_home",
        "commanderProfileId": "disciplined"
      },
      {
        "id": "chat",
        "name": "Chatty League",
        "homeSystemId": "chat_home",
        "commanderProfileId": "chatty"
      }
    ],
    "systems": [
      {
        "id": "disc_home",
        "name": "Disc Home",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "disc",
        "saltStockpile": 60,
        "metalStockpile": 80,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "disc": 6
        }
      },
      {
        "id": "disc_frontier_a",
        "name": "Disc Frontier A",
        "position": {
          "x": 1,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "disc_frontier_b",
        "name": "Disc Frontier B",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "white_blue_star",
        "metalRichness": "poor",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "chat_home",
        "name": "Chat Home",
        "position": {
          "x": 6,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "chat",
        "saltStockpile": 60,
        "metalStockpile": 80,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "chat": 6
        }
      },
      {
        "id": "chat_frontier_a",
        "name": "Chat Frontier A",
        "position": {
          "x": 7,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "chat_frontier_b",
        "name": "Chat Frontier B",
        "position": {
          "x": 8,
          "y": 0
        },
        "starType": "white_blue_star",
        "metalRichness": "poor",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      }
    ],
    "routes": [
      {
        "id": "disc-a",
        "a": "disc_home",
        "b": "disc_frontier_a",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "a",
        "headingFromB": "home"
      },
      {
        "id": "disc-b",
        "a": "disc_home",
        "b": "disc_frontier_b",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "b",
        "headingFromB": "home"
      },
      {
        "id": "chat-a",
        "a": "chat_home",
        "b": "chat_frontier_a",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "a",
        "headingFromB": "home"
      },
      {
        "id": "chat-b",
        "a": "chat_home",
        "b": "chat_frontier_b",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "b",
        "headingFromB": "home"
      }
    ],
    "expectations": [
      {
        "at": "2240-05-20",
        "path": "factions.disc.totalSaltStockpile",
        "op": "gte",
        "value": 30
      },
      {
        "at": "2240-05-20",
        "path": "factions.chat.totalSaltStockpile",
        "op": "lte",
        "value": 120
      },
      {
        "at": "2240-05-20",
        "path": "factions.disc.ownedSystems",
        "op": "gte",
        "value": 2
      },
      {
        "at": "2240-05-20",
        "path": "factions.chat.reportCount",
        "op": "gte",
        "value": 8
      }
    ]
  },
  "profile_frontier_vs_turtle": {
    "name": "profile_frontier_vs_turtle",
    "seed": 31,
    "startDate": "2240-04-01",
    "durationDays": 20,
    "commanderProfiles": [
      {
        "id": "expander",
        "kind": "frontier_expander",
        "options": {
          "preferredSystems": 3,
          "claimFleetShips": 4,
          "homeReserveShips": 2,
          "frontierDefenseTarget": 1,
          "maxExpansionDistance": 3
        }
      },
      {
        "id": "turtle",
        "kind": "turtle",
        "options": {
          "homeDefenseTarget": 8,
          "frontierDefenseTarget": 3
        }
      }
    ],
    "factions": [
      {
        "id": "blue",
        "name": "Aster Crown",
        "homeSystemId": "blue_home",
        "commanderProfileId": "expander"
      },
      {
        "id": "green",
        "name": "Verdant Bastion",
        "homeSystemId": "green_home",
        "commanderProfileId": "turtle"
      }
    ],
    "systems": [
      {
        "id": "blue_home",
        "name": "Sol",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "starlaneLinks": [
          "blue_frontier_a"
        ],
        "ownerId": "blue",
        "saltStockpile": 60,
        "metalStockpile": 80,
        "probeStockpile": 3,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "blue": 6
        }
      },
      {
        "id": "blue_frontier_a",
        "name": "Barnard's Star",
        "position": {
          "x": 1,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "starlaneLinks": [
          "blue_home",
          "blue_frontier_b"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "blue_frontier_b",
        "name": "Wolf 359",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "blue_frontier_a"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "green_home",
        "name": "Tau Ceti",
        "position": {
          "x": 6,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "starlaneLinks": [
          "green_frontier_a"
        ],
        "ownerId": "green",
        "saltStockpile": 60,
        "metalStockpile": 80,
        "probeStockpile": 3,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "green": 6
        }
      },
      {
        "id": "green_frontier_a",
        "name": "Epsilon Eridani",
        "position": {
          "x": 7,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "starlaneLinks": [
          "green_home",
          "green_frontier_b"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "green_frontier_b",
        "name": "40 Eridani",
        "position": {
          "x": 8,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "green_frontier_a"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      }
    ],
    "routes": [
      {
        "id": "blue-a",
        "a": "blue_home",
        "b": "blue_frontier_a",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "a",
        "headingFromB": "home"
      },
      {
        "id": "blue-b",
        "a": "blue_home",
        "b": "blue_frontier_b",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "b",
        "headingFromB": "home"
      },
      {
        "id": "green-a",
        "a": "green_home",
        "b": "green_frontier_a",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "a",
        "headingFromB": "home"
      },
      {
        "id": "green-b",
        "a": "green_home",
        "b": "green_frontier_b",
        "distance": 2,
        "travelDays": 2,
        "headingFromA": "b",
        "headingFromB": "home"
      }
    ],
    "expectations": [
      {
        "at": "2240-04-20",
        "path": "factions.blue.ownedSystems",
        "op": "gte",
        "value": 2
      },
      {
        "at": "2240-04-20",
        "path": "factions.green.ownedSystems",
        "op": "eq",
        "value": 1
      },
      {
        "at": "2240-04-20",
        "path": "systems.blue_frontier_a.ownerId",
        "op": "eq",
        "value": "blue"
      }
    ]
  },
  "profile_requires_intel": {
    "name": "profile_requires_intel",
    "seed": 41,
    "startDate": "2240-06-01",
    "durationDays": 6,
    "commanderProfiles": [
      {
        "id": "napoleon",
        "kind": "napoleonic",
        "options": {
          "homeReserveShips": 4,
          "minimumAttackShips": 6
        }
      }
    ],
    "factions": [
      {
        "id": "napoleon",
        "name": "Napoleonic League",
        "homeSystemId": "n_home",
        "commanderProfileId": "napoleon"
      },
      {
        "id": "red",
        "name": "Red Compact",
        "homeSystemId": "r_home"
      }
    ],
    "systems": [
      {
        "id": "n_home",
        "name": "Napoleon Home",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "napoleon",
        "saltStockpile": 140,
        "metalStockpile": 90,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 300,
        "garrisonShips": {
          "napoleon": 14
        }
      },
      {
        "id": "r_home",
        "name": "Red Home",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "red",
        "saltStockpile": 120,
        "metalStockpile": 90,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 300,
        "garrisonShips": {
          "red": 10
        }
      },
      {
        "id": "fork",
        "name": "Fork",
        "position": {
          "x": 1,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "poor",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 0,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "west",
        "name": "West Gate",
        "position": {
          "x": 2,
          "y": 1.5
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "ownerId": "red",
        "saltStockpile": 18,
        "metalStockpile": 18,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 45,
        "garrisonShips": {
          "red": 3
        }
      }
    ],
    "routes": [
      {
        "id": "n-fork",
        "a": "n_home",
        "b": "fork",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "frontier",
        "headingFromB": "napoleon"
      },
      {
        "id": "r-fork",
        "a": "r_home",
        "b": "fork",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "frontier",
        "headingFromB": "red"
      },
      {
        "id": "fork-west",
        "a": "fork",
        "b": "west",
        "distance": 1,
        "travelDays": 1,
        "headingFromA": "west",
        "headingFromB": "fork"
      }
    ],
    "expectations": [
      {
        "at": "2240-06-06",
        "path": "systems.west.ownerId",
        "op": "eq",
        "value": "red"
      },
      {
        "at": "2240-06-06",
        "path": "systems.west.captureProgress",
        "op": "eq",
        "value": 0
      },
      {
        "at": "2240-06-06",
        "path": "factions.napoleon.ownedSystems",
        "op": "eq",
        "value": 2
      }
    ]
  },
  "starlane_blockade_interception": {
    "name": "starlane_blockade_interception",
    "seed": 47,
    "startDate": "2240-06-01",
    "durationDays": 7,
    "factions": [
      {
        "id": "blue",
        "name": "Blue League",
        "homeSystemId": "blue_home"
      },
      {
        "id": "red",
        "name": "Red Compact",
        "homeSystemId": "screen"
      }
    ],
    "systems": [
      {
        "id": "blue_home",
        "name": "Blue Home",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "screen"
        ],
        "ownerId": "blue",
        "saltStockpile": 150,
        "metalStockpile": 60,
        "infrastructure": 8,
        "defense": 3,
        "controlAgeDays": 180,
        "garrisonShips": {
          "blue": 8
        }
      },
      {
        "id": "screen",
        "name": "Screen",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "poor",
        "starlaneLinks": [
          "blue_home",
          "target"
        ],
        "ownerId": "red",
        "saltStockpile": 20,
        "metalStockpile": 10,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 80,
        "garrisonShips": {
          "red": 3
        }
      },
      {
        "id": "target",
        "name": "Target",
        "position": {
          "x": 4,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "none",
        "metalRichness": "rich",
        "starlaneLinks": [
          "screen"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0,
        "garrisonShips": {
          "red": 5
        }
      }
    ],
    "fleets": [
      {
        "id": "red-screen-blockade",
        "name": "Red Screen Blockade",
        "factionId": "red",
        "currentSystemId": "screen",
        "ships": 3,
        "mission": "blockade"
      }
    ],
    "commands": [
      {
        "type": "launch_fleet",
        "at": "2240-06-01",
        "factionId": "blue",
        "originSystemId": "blue_home",
        "destinationSystemId": "target",
        "ships": 7,
        "mission": "attack",
        "cargoSalt": 0,
        "metals": 0,
        "retreatSystemId": "blue_home",
        "name": "Blue Main Body"
      }
    ],
    "expectations": [
      {
        "at": "2240-06-01",
        "path": "fleets.fleet-1.usesStarlane",
        "op": "eq",
        "value": true
      },
      {
        "at": "2240-06-01",
        "path": "fleets.fleet-1.interceptedCombatDaysRemaining",
        "op": "eq",
        "value": 3
      },
      {
        "at": "2240-06-01",
        "path": "fleets.fleet-1.interceptedByFactionId",
        "op": "eq",
        "value": "red"
      },
      {
        "at": "2240-06-07",
        "path": "systems.target.ownerId",
        "op": "neq",
        "value": "blue"
      }
    ]
  },
  "starlane_logistics_discount": {
    "name": "starlane_logistics_discount",
    "seed": 31,
    "startDate": "2240-05-01",
    "durationDays": 6,
    "factions": [
      {
        "id": "blue",
        "name": "Blue League",
        "homeSystemId": "home"
      }
    ],
    "systems": [
      {
        "id": "home",
        "name": "Home",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "lane_mid"
        ],
        "ownerId": "blue",
        "saltStockpile": 100,
        "metalStockpile": 40,
        "infrastructure": 6,
        "defense": 2,
        "controlAgeDays": 120,
        "garrisonShips": {
          "blue": 6
        }
      },
      {
        "id": "lane_mid",
        "name": "Lane Mid",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "poor",
        "starlaneLinks": [
          "home",
          "target"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 0,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "target",
        "name": "Target",
        "position": {
          "x": 4,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "rich",
        "starlaneLinks": [
          "lane_mid"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 0,
        "defense": 0,
        "controlAgeDays": 0
      }
    ],
    "commands": [
      {
        "type": "launch_fleet",
        "at": "2240-05-01",
        "factionId": "blue",
        "originSystemId": "home",
        "destinationSystemId": "target",
        "ships": 4,
        "mission": "attack",
        "cargoSalt": 0,
        "metals": 0,
        "retreatSystemId": "home",
        "name": "Lane Spearhead"
      }
    ],
    "expectations": [
      {
        "at": "2240-05-01",
        "path": "systems.home.saltStockpile",
        "op": "eq",
        "value": 23
      },
      {
        "at": "2240-05-01",
        "path": "fleets.fleet-1.usesStarlane",
        "op": "eq",
        "value": true
      },
      {
        "at": "2240-05-04",
        "path": "fleets.fleet-1.currentSystemId",
        "op": "eq",
        "value": "target"
      },
      {
        "at": "2240-05-06",
        "path": "systems.target.ownerId",
        "op": "eq",
        "value": "blue"
      }
    ]
  },
  "starter_constellation": {
    "name": "starter_constellation",
    "seed": 19,
    "startDate": "2240-05-05",
    "durationDays": 7,
    "factions": [
      {
        "id": "blue",
        "name": "Aster Crown",
        "homeSystemId": "sol"
      },
      {
        "id": "green",
        "name": "Verdant Bastion",
        "homeSystemId": "tau_ceti"
      }
    ],
    "systems": [
      {
        "id": "sol",
        "name": "Sol",
        "position": {
          "x": 0,
          "y": 0
        },
        "starType": "yellow_star",
        "saltProfile": "major",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "barnards_star",
          "sirius"
        ],
        "ownerId": "blue",
        "saltStockpile": 180,
        "metalStockpile": 140,
        "probeStockpile": 3,
        "infrastructure": 10,
        "defense": 8,
        "controlAgeDays": 480,
        "garrisonShips": {
          "blue": 8
        }
      },
      {
        "id": "barnards_star",
        "name": "Barnard's Star",
        "position": {
          "x": 1.4,
          "y": 1.1
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "sol",
          "wolf_359",
          "lalande_21185"
        ],
        "ownerId": "blue",
        "saltStockpile": 18,
        "metalStockpile": 10,
        "probeStockpile": 1,
        "infrastructure": 4,
        "defense": 2,
        "controlAgeDays": 60,
        "garrisonShips": {
          "blue": 3
        }
      },
      {
        "id": "wolf_359",
        "name": "Wolf 359",
        "position": {
          "x": 2.5,
          "y": 2.2
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "barnards_star"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "sirius",
        "name": "Sirius",
        "position": {
          "x": 2.2,
          "y": -0.8
        },
        "starType": "white_blue_star",
        "saltProfile": "productive",
        "metalRichness": "rich",
        "starlaneLinks": [
          "sol",
          "procyon",
          "proxima_centauri"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "lalande_21185",
        "name": "Lalande 21185",
        "position": {
          "x": 3.6,
          "y": 0.9
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "standard",
        "starlaneLinks": [
          "barnards_star",
          "procyon",
          "altair"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "procyon",
        "name": "Procyon",
        "position": {
          "x": 4.8,
          "y": 0.1
        },
        "starType": "white_blue_star",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "sirius",
          "lalande_21185",
          "altair"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 0
      },
      {
        "id": "proxima_centauri",
        "name": "Proxima Centauri",
        "position": {
          "x": 4.1,
          "y": -1.7
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "rich",
        "starlaneLinks": [
          "sirius",
          "altair"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "altair",
        "name": "Altair",
        "position": {
          "x": 6.4,
          "y": 0.2
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "rich",
        "starlaneLinks": [
          "lalande_21185",
          "procyon",
          "proxima_centauri",
          "epsilon_eridani",
          "groombridge_34"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 3,
        "defense": 2,
        "controlAgeDays": 0
      },
      {
        "id": "epsilon_eridani",
        "name": "Epsilon Eridani",
        "position": {
          "x": 8.2,
          "y": 1.1
        },
        "starType": "yellow_star",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "altair",
          "sixty_one_cygni",
          "tau_ceti"
        ],
        "ownerId": "green",
        "saltStockpile": 16,
        "metalStockpile": 12,
        "probeStockpile": 1,
        "infrastructure": 4,
        "defense": 2,
        "controlAgeDays": 60,
        "garrisonShips": {
          "green": 3
        }
      },
      {
        "id": "sixty_one_cygni",
        "name": "61 Cygni",
        "position": {
          "x": 9.7,
          "y": 2.2
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "rich",
        "starlaneLinks": [
          "epsilon_eridani",
          "tau_ceti"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "groombridge_34",
        "name": "Groombridge 34",
        "position": {
          "x": 10,
          "y": -0.8
        },
        "starType": "red_dwarf",
        "saltProfile": "none",
        "metalRichness": "standard",
        "starlaneLinks": [
          "altair",
          "tau_ceti",
          "delta_pavonis"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "tau_ceti",
        "name": "Tau Ceti",
        "position": {
          "x": 11.3,
          "y": 0.1
        },
        "starType": "yellow_star",
        "saltProfile": "major",
        "metalRichness": "exceptional",
        "starlaneLinks": [
          "epsilon_eridani",
          "sixty_one_cygni",
          "groombridge_34"
        ],
        "ownerId": "green",
        "saltStockpile": 178,
        "metalStockpile": 138,
        "probeStockpile": 3,
        "infrastructure": 10,
        "defense": 8,
        "controlAgeDays": 480,
        "garrisonShips": {
          "green": 8
        }
      },
      {
        "id": "delta_pavonis",
        "name": "Delta Pavonis",
        "position": {
          "x": 12.6,
          "y": -1.4
        },
        "starType": "yellow_star",
        "saltProfile": "productive",
        "metalRichness": "standard",
        "starlaneLinks": [
          "groombridge_34"
        ],
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "probeStockpile": 0,
        "infrastructure": 2,
        "defense": 0,
        "controlAgeDays": 0
      }
    ],
    "commands": [
      {
        "type": "launch_fleet",
        "at": "2240-05-06",
        "factionId": "blue",
        "originSystemId": "barnards_star",
        "destinationSystemId": "wolf_359",
        "ships": 2,
        "mission": "attack",
        "name": "North Screen"
      },
      {
        "type": "deploy_probe",
        "at": "2240-05-07",
        "factionId": "blue",
        "originSystemId": "sol",
        "anchorSystemId": "lalande_21185",
        "reportDestinationSystemId": "sol"
      },
      {
        "type": "launch_fleet",
        "at": "2240-05-10",
        "factionId": "green",
        "originSystemId": "tau_ceti",
        "destinationSystemId": "lalande_21185",
        "ships": 4,
        "mission": "blockade",
        "name": "Forward Screen"
      }
    ],
    "expectations": [
      {
        "at": "2240-05-11",
        "path": "factions.blue.ownedSystems",
        "op": "gte",
        "value": 2
      },
      {
        "at": "2240-05-11",
        "path": "factions.green.ownedSystems",
        "op": "gte",
        "value": 2
      }
    ]
  }
};
