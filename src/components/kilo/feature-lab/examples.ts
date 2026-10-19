import type { Mode, Step } from "./model";
export const concepts: Record<
  Mode,
  {
    tag: string;
    title: string;
    rule: string;
    distinction: string;
    scene: string;
    steps: Step[];
  }
> = {
  base: {
    tag: "BASE GAME",
    title: "Dockside Deal",
    scene: "base",
    rule: "Occasional collector lands with cargo and collects it once, inside the same spin.",
    distinction:
      "A short meaningful event between bonus triggers. No persistent meter or routine celebration.",
    steps: [
      {
        id: "b1",
        title: "Ordinary landing: no collection",
        cash: [{ id: "b-a", cell: 2, value: 200 }],
      },
      {
        id: "b2",
        title: "Collector + cargo",
        cash: [
          { id: "b-b", cell: 1, value: 200 },
          { id: "b-c", cell: 8, value: 1000 },
        ],
        collectors: [12],
        finish: true,
      },
    ],
  },
  dock: {
    tag: "3 SCATTERS",
    title: "Dockside Catch",
    scene: "scatter-3",
    rule: "Familiar collect-all free spins. One marked package gets one extra spin to be caught.",
    distinction:
      "10 starting spins. Every four collectors retrigger +10 spins; multiplier ladder ×1 / ×2 / ×3 / ×10. This transcript is an excerpt, not a full bonus.",
    steps: [
      {
        id: "d1",
        title: "A marked package lands without a collector",
        cash: [{ id: "d-a", cell: 6, value: 1000 }],
        mark: "d-a",
      },
      {
        id: "d2",
        title: "The held package joins the new cargo",
        cash: [{ id: "d-b", cell: 3, value: 200 }],
        collectors: [0, 14],
      },
      {
        id: "d3",
        title: "Two collectors complete the portrait row",
        cash: [{ id: "d-c", cell: 7, value: 500 }],
        collectors: [1, 13],
      },
      {
        id: "d4",
        title: "Next collect uses the earned multiplier",
        cash: [
          { id: "d-d", cell: 3, value: 1000 },
          { id: "d-e", cell: 11, value: 200 },
        ],
        collectors: [8],
        finish: true,
      },
    ],
  },
  yacht: {
    tag: "4 SCATTERS",
    title: "Yacht Stash",
    scene: "scatter-4",
    rule: "Cargo locks in twelve holds. A captain on the fifth reel ships the entire load once.",
    distinction:
      "Every two shipments raise the minimum value of future cargo. The final spin ships all remaining cargo automatically.",
    steps: [
      {
        id: "y1",
        title: "Load the first holds",
        cash: [
          { id: "y-a", cell: 0, value: 100 },
          { id: "y-b", cell: 7, value: 500 },
        ],
      },
      {
        id: "y2",
        title: "New cargo joins the locked load",
        cash: [{ id: "y-c", cell: 11, value: 200 }],
      },
      { id: "y3", title: "First shipment", collectors: [4] },
      {
        id: "y4",
        title: "Second shipment raises cargo quality",
        cash: [{ id: "y-d", cell: 6, value: 100 }],
        collectors: [9, 14],
      },
      {
        id: "y5",
        title: "A 100 package enters at the new 200 floor",
        cash: [{ id: "y-e", cell: 2, value: 100 }],
      },
      { id: "y6", title: "Automatic final shipment", finish: true },
    ],
  },
  airbridge: {
    tag: "5 SCATTERS",
    title: "Chopper Route",
    scene: "scatter-5",
    rule: "The chopper visits columns left to right. Only cargo under the active column is picked up.",
    distinction:
      "Each successful stop raises the route multiplier, capped at ×5. Column five delivers the load; a new route resets.",
    steps: [
      {
        id: "a1",
        title: "Pickup column 1",
        cash: [
          { id: "a-a", cell: 0, value: 200 },
          { id: "a-b", cell: 8, value: 1000 },
        ],
      },
      {
        id: "a2",
        title: "Pickup column 2",
        cash: [{ id: "a-c", cell: 6, value: 500 }],
      },
      {
        id: "a3",
        title: "Empty column 3: route advances without a multiplier increase",
        cash: [{ id: "a-d", cell: 4, value: 1000 }],
      },
      {
        id: "a4",
        title: "Pickup column 4",
        cash: [{ id: "a-e", cell: 13, value: 200 }],
      },
      {
        id: "a5",
        title: "Column 5 completes the route",
        cash: [{ id: "a-f", cell: 9, value: 1000 }],
      },
      {
        id: "a6",
        title: "Final partial route is delivered",
        cash: [{ id: "a-g", cell: 10, value: 100 }],
        finish: true,
      },
    ],
  },
  getaway: {
    tag: "GOD MODE · BUY CONCEPT",
    title: "The Getaway",
    scene: "god-mode",
    rule: "Load three cases, clear three recorded checkpoints, then extract the entire haul.",
    distinction:
      "A finite heist, not another free-spin multiplier skin. Each checkpoint doubles one case. Chance at the cap, never a promised max win.",
    steps: [
      {
        id: "g1",
        title: "Load three cases",
        cash: [
          { id: "g-a", cell: 2, value: 1000 },
          { id: "g-b", cell: 7, value: 2000 },
          { id: "g-c", cell: 12, value: 5000 },
        ],
      },
      { id: "g2", title: "Clear the marina checkpoint", checkpoint: 0 },
      { id: "g3", title: "Clear the causeway checkpoint", checkpoint: 2 },
      { id: "g4", title: "Clear the air corridor", checkpoint: 2 },
      {
        id: "g5",
        title: "Extract at the recorded ×8",
        extract: 8,
        finish: true,
      },
    ],
  },
};
