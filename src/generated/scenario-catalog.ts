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
        "value": 12
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
        "name": "Blue League",
        "homeSystemId": "home"
      },
      {
        "id": "red",
        "name": "Red Compact",
        "homeSystemId": "enemy_home"
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
        "saltStockpile": 50,
        "metalStockpile": 50,
        "infrastructure": 8,
        "defense": 5,
        "controlAgeDays": 200,
        "garrisonShips": {
          "blue": 6
        }
      },
      {
        "id": "frontier_west",
        "name": "Frontier West",
        "position": {
          "x": 2,
          "y": 2
        },
        "starType": "yellow_star",
        "metalRichness": "rich",
        "ownerId": "blue",
        "saltStockpile": 20,
        "metalStockpile": 20,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 30,
        "garrisonShips": {
          "blue": 3
        }
      },
      {
        "id": "frontier_east",
        "name": "Frontier East",
        "position": {
          "x": 2,
          "y": -2
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "blue",
        "saltStockpile": 20,
        "metalStockpile": 20,
        "infrastructure": 2,
        "defense": 1,
        "controlAgeDays": 30,
        "garrisonShips": {
          "blue": 3
        }
      },
      {
        "id": "enemy_home",
        "name": "Enemy Home",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "red",
        "saltStockpile": 120,
        "metalStockpile": 80,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "red": 10
        }
      },
      {
        "id": "watch",
        "name": "Watchpoint",
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
    "name": "napoleon_beats_bad_commander_with_extra_salt",
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
        "value": "napoleon"
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
        "value": 2
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
        "value": 110
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
        "value": 10
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
        "name": "Blue League",
        "homeSystemId": "blue_home",
        "commanderProfileId": "expander"
      },
      {
        "id": "green",
        "name": "Green Bastion",
        "homeSystemId": "green_home",
        "commanderProfileId": "turtle"
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
        "metalRichness": "standard",
        "ownerId": "blue",
        "saltStockpile": 60,
        "metalStockpile": 80,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "blue": 6
        }
      },
      {
        "id": "blue_frontier_a",
        "name": "Blue Frontier A",
        "position": {
          "x": 1,
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
      },
      {
        "id": "blue_frontier_b",
        "name": "Blue Frontier B",
        "position": {
          "x": 2,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "exceptional",
        "ownerId": null,
        "saltStockpile": 0,
        "metalStockpile": 0,
        "infrastructure": 1,
        "defense": 0,
        "controlAgeDays": 0
      },
      {
        "id": "green_home",
        "name": "Green Home",
        "position": {
          "x": 6,
          "y": 0
        },
        "starType": "yellow_star",
        "metalRichness": "standard",
        "ownerId": "green",
        "saltStockpile": 60,
        "metalStockpile": 80,
        "infrastructure": 10,
        "defense": 6,
        "controlAgeDays": 200,
        "garrisonShips": {
          "green": 6
        }
      },
      {
        "id": "green_frontier_a",
        "name": "Green Frontier A",
        "position": {
          "x": 7,
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
      },
      {
        "id": "green_frontier_b",
        "name": "Green Frontier B",
        "position": {
          "x": 8,
          "y": 0
        },
        "starType": "red_dwarf",
        "metalRichness": "exceptional",
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
        "saltStockpile": 120,
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
        "value": 2
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
        "value": 36
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
  }
};
