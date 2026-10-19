import { connectionAnchor } from "./connection-win";
import {
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import type { Cargo, FeatureEvent } from "@/lib/kilo/feature-math";
import type { SplashCell } from "@/lib/kilo/engine";
import type { SpinSpeed } from "./control-model";

type Geometry = { gx: number; gy: number; cell: number; gap: number };
type Adapter = {
  host: HTMLElement;
  world: Container;
  geom: () => Geometry;
  cell: (cell: SplashCell, size: number) => Container;
  stake: () => number;
  pace: () => { speed: SpinSpeed; reduced: boolean };
  tween: (ms: number, frame: (t: number) => void) => Promise<void>;
  hold: (ms: number) => Promise<void>;
  live: () => boolean;
  readout: (label: string, value: string) => void;
  screen: (x: number, y: number) => { x: number; y: number };
  landing: (height: number) => { x: number; y: number } | null;
  bankCue: (value: number, capped: boolean) => void;
};
const money = (value: number) => Math.round(value).toLocaleString("en-US");
const gold = 0xf3d28b,
  teal = 0x83ede3,
  white = 0xfff7e5;
const ease = (t: number) => 1 - (1 - t) ** 3;

/** The overlay consumes immutable recorded events. It owns no payout state. */
export function createFeatureEffects(a: Adapter) {
  const held = new Container(),
    effects = new Container();
  a.world.addChild(held, effects);
  let event: FeatureEvent | null = null,
    phase: "before" | "after" = "after";
  let disposed = false,
    epoch = 0,
    repaint: () => void = () => {};
  let frames: Texture[] = [],
    caseSprites: Sprite[] = [],
    caseLabels: Text[] = [];
  let poses = [0, 0, 0],
    caseValues = [0, 0, 0];
  void Assets.load<Texture>("/kilo-v79/symbols/case-reaction.webp")
    .then((sheet) => {
      if (disposed) return;
      frames = Array.from(
        { length: 6 },
        (_, i) =>
          new Texture({
            source: sheet.source,
            frame: new Rectangle(
              (i % 3) * 512,
              Math.floor(i / 3) * 512,
              512,
              512,
            ),
          }),
      );
      // Assets become visible only at the next event boundary.
    })
    .catch(() => {});
  const point = (reel: number, row: number) => {
    const g = a.geom();
    return {
      x: g.gx + (reel + 0.5) * g.cell + reel * g.gap,
      y: g.gy + (row + 0.5) * g.cell,
    };
  };
  const casePoint=(index:number)=>{const g=a.geom();return{x:g.gx+(g.cell*5+g.gap*4)*(index+.5)/3,y:g.gy+g.cell*1.5};};
  const text = (value: string, size: number, color = white) => {
    const t = new Text({
      text: value,
      style: {
        fontFamily: "Source Sans 3",
        fontWeight: "800",
        fontSize: size,
        fill: color,
        stroke: { color: 0x021018, width: Math.max(3, size * 0.13) },
        align: "center",
      },
    });
    t.anchor.set(0.5);
    return t;
  };
  const clear = (c: Container) =>
    c.removeChildren().forEach((child) => child.destroy({ children: true }));
  const pace = (ms: number) =>
    a.pace().reduced
      ? 0
      : ms * { normal: 1, turbo: 0.48, super: 0.28 }[a.pace().speed];
  const cargoView = (p: Cargo, size: number) =>
    a.cell({ s: "brick", v: p.value / a.stake(), id: p.id, w: 1, h: 1 }, size);
  function paintHeld() {
    if (disposed) return;
    clear(held);
    caseSprites = [];
    caseLabels = [];
    if (!event) return;
    const g = a.geom(),
      w = g.cell * 5 + g.gap * 4;
    const parcels = phase === "before" ? event.heldBefore : event.heldAfter;
    if (event.kind === "getaway") {
      held.addChild(
        new Graphics()
          .rect(g.gx, g.gy, w, g.cell * 3)
          .fill({ color: 0x030f19, alpha: 0.94 }),
      );
      const route = new Graphics();
      route
        .moveTo(g.gx + g.cell * 0.5, g.gy + g.cell * 0.48)
        .lineTo(g.gx + w - g.cell * 0.5, g.gy + g.cell * 0.48)
        .stroke({ color: 0x44646a, width: 2 });
      for (let i = 0; i < 3; i++) {
        const x = g.gx + (w * (i + 1)) / 4,
          y = g.gy + g.cell * 0.48;
        route
          .circle(x, y, Math.max(5, g.cell * 0.055))
          .fill({
            color:
              i <
              event.checkpoint -
                (phase === "before" && event.action === "checkpoint" ? 1 : 0)
                ? teal
                : 0x263d47,
          })
          .stroke({ color: gold, width: 1 });
      }
      held.addChild(route);
      for (let i = 0; i < 3; i++) {
        const p = casePoint(i),
          bodyWidth = g.cell * 1.12;
        if (frames.length) {
          const sprite = new Sprite(frames[poses[i] ?? 0]);
          sprite.anchor.set(0.5, 410 / 512);
          sprite.scale.set(bodyWidth / 404);
          sprite.position.set(p.x, p.y + g.cell * 0.25);
          held.addChild(sprite);
          caseSprites.push(sprite);
        } else {
          const fallback = a.cell({ s: "duffel" }, g.cell);
          fallback.position.set(p.x - g.cell / 2, p.y - g.cell / 2);
          held.addChild(fallback);
        }
        const label = text(
          caseValues[i] ? money(caseValues[i]!) : "—",
          Math.max(16, g.cell * 0.19),
        );
        label.position.set(p.x, p.y + g.cell * 0.62);
        held.addChild(label);
        caseLabels.push(label);
        const name = text(`CASE ${i + 1}`, Math.max(10, g.cell * 0.105), gold);
        name.position.set(p.x, p.y + g.cell * 0.9);
        held.addChild(name);
      }
      return;
    }
    for (const parcel of parcels) {
      const p = point(parcel.reel, parcel.row),
        x = p.x - g.cell / 2,
        y = p.y - g.cell / 2;
      held.addChild(
        new Graphics()
          .rect(x + 1, y + 1, g.cell - 2, g.cell - 2)
          .fill(0x041720),
      );
      const art = cargoView(parcel, g.cell);
      art.position.set(x, y);
      held.addChild(art);
      held.addChild(
        new Graphics()
          .roundRect(x + 3, y + 3, g.cell - 6, g.cell - 6, 5)
          .stroke({ width: 2, color: teal, alpha: 0.9 }),
      );
      const tag = text(
        event.kind === "dock" ? "1 SPIN" : "LOCKED",
        Math.max(9, g.cell * 0.095),
        teal,
      );
      tag.position.set(p.x, y + g.cell * 0.1);
      held.addChild(tag);
    }
    if (event.kind === "route") {
      const column = phase === "before" ? event.route : event.nextRoute,
        x = g.gx + column * (g.cell + g.gap);
      held.addChild(
        new Graphics()
          .rect(x + 2, g.gy + 2, g.cell - 4, g.cell * 3 - 4)
          .stroke({ color: teal, width: 2, alpha: 0.75 }),
      );
      const tag = text(
        `PICKUP ${column + 1}/5`,
        Math.max(10, g.cell * 0.105),
        teal,
      );
      tag.position.set(x + g.cell / 2, g.gy + g.cell * 0.11);
      held.addChild(tag);
    }
  }
  function set(
    next: FeatureEvent | null,
    nextPhase: "before" | "after" = "after",
  ) {
    event = next;
    phase = nextPhase;
    if (next?.kind === "getaway") {
      caseValues = [
        ...(nextPhase === "before" ? next.casesBefore : next.casesAfter),
      ];
      poses = [0, 0, 0];
      if (nextPhase === "after" && next.action === "extract") poses = [4, 4, 4];
    }
    paintHeld();
  }
  const relayout = () => {
    paintHeld();
    repaint();
  };
  a.host.addEventListener("kilo-relayout", relayout);
  const cancel = () => {
    epoch++;
    repaint = () => {};
    clear(effects);
  };
  async function step(e: FeatureEvent) {
    cancel();
    const mine = epoch;
    const live = () => !disposed && mine === epoch && a.live();
    const g = a.geom();
    const local = text("", Math.max(19, g.cell * 0.28));
    effects.addChild(local);
    let value = 0,
      sub = "",
      progress = 0,
      active: Cargo | null = null;
    const beam = new Graphics();
    effects.addChildAt(beam, 0);
    const caption = text("", Math.max(11, g.cell * 0.12), teal);
    effects.addChild(caption);
    const draw = () => {
      if (!live() || local.destroyed) return;
      const geom = a.geom();
      local.style.fontSize = Math.max(19, geom.cell * 0.28);
      caption.style.fontSize = Math.max(11, geom.cell * 0.12);
      local.text = money(value);
      caption.text = sub;
      const pos = connectionAnchor(
        active ? [active] : [{ reel: 2, row: 1 }],
        geom,
        Math.max(local.width, caption.width),
        local.height + caption.height,
      );
      if(e.kind==='getaway'&&active)pos.x=casePoint(active.reel/2).x;
      local.position.set(pos.x, pos.y);
      caption.position.set(pos.x, pos.y + geom.cell * 0.33);
      beam.clear();
      if (e.kind === "route") {
        const x = point(e.route, 0).x,
          end = active
            ? point(active.reel, active.row).y
            : geom.gy + geom.cell * 0.7;
        beam
          .moveTo(x, geom.gy)
          .lineTo(x, geom.gy + (end - geom.gy) * progress)
          .stroke({ width: Math.max(2, geom.cell * 0.018), color: gold });
        const head = geom.gy + (end - geom.gy) * progress;
        beam
          .poly([
            x - geom.cell * 0.06,
            head - geom.cell * 0.08,
            x,
            head,
            x + geom.cell * 0.06,
            head - geom.cell * 0.08,
          ])
          .stroke({ width: 3, color: gold });
      }
    };
    repaint = draw;
    const tally = async (from: number, to: number, label: string) => {
      sub = label;
      await a.tween(pace(420), (t) => {
        if (!live()) return;
        value = Math.round(from + (to - from) * ease(t));
        draw();
      });
    };
    try {
      if (e.kind === "getaway") {
        local.visible = false;
        caption.visible = false;
        const targets = e.targetCase == null ? [0, 1, 2] : [e.targetCase];
        for (const index of targets) {
          if (!live()) return;
          await a.tween(pace(650), (t) => {
            if (!live()) return;
            poses[index] = Math.min(4, Math.floor(t * 5));
            const sprite = caseSprites[index];
            if (sprite && frames.length)
              sprite.texture = frames[poses[index]!]!;
            const from = e.casesBefore[index] ?? 0,
              to = e.casesAfter[index] ?? 0;
            caseValues[index] = Math.round(from + (to - from) * ease(t));
            if (caseLabels[index])
              caseLabels[index]!.text = money(caseValues[index]!);
            const p = casePoint(index);
            beam
              .clear()
              .ellipse(
                p.x,
                p.y + a.geom().cell * 0.3,
                a.geom().cell * 0.58,
                a.geom().cell * 0.13,
              )
              .stroke({ width: 2, color: teal, alpha: 1 - t * 0.4 });
          });
          if (e.action === "checkpoint") {
            active = e.sources[0] ?? null;
            local.visible = true;
            caption.visible = true;
            value = e.casesAfter[index]!;
            sub = "CHECKPOINT ×2";
            draw();
            await a.hold(650);
            local.visible = false;
            caption.visible = false;
          }
        }
        if (e.action !== "extract") {
          a.readout(
            e.action === "load"
              ? "Cargo loaded"
              : `Checkpoint ${e.checkpoint}/3`,
            money(e.pendingAfter),
          );
          await a.hold(650);
          return;
        }
        active = null;
        local.visible = true;
        caption.visible = true;
        await tally(
          e.pendingBefore,
          e.beforeCap,
          `EXTRACTION ×${e.multiplier}`,
        );
      } else if (
        e.action === "carry" ||
        e.action === "expire" ||
        e.action === "hold"
      ) {
        local.visible = false;
        caption.visible = false;
        if(e.kind==='dock'){
          // A held package is a board change, not another detached award.
          // Latch the actual package once, then let its quiet one-spin marker
          // carry the persistent state into the next reel movement.
          set(e,'after');
          const parcels=e.heldAfter.length?e.heldAfter:e.heldBefore;
          const retaining=e.heldAfter.length>0;
          let t=0;
          const latch=()=>{
            if(!live())return;
            const g=a.geom();beam.clear();
            for(const p of parcels){
              const center=point(p.reel,p.row),s=g.cell;
              const reach=s*.20,edge=s*(.43+(retaining?.06*(1-ease(t)):.06*t));
              for(const[x,y]of [[-1,-1],[1,-1],[-1,1],[1,1]]){
                const cx=center.x+x*edge,cy=center.y+y*edge;
                beam.moveTo(cx-x*reach,cy).lineTo(cx,cy).lineTo(cx,cy-y*reach)
                  .stroke({color:retaining?teal:0x809a9b,width:Math.max(2,s*.035),alpha:retaining?1:1-t});
              }
            }
          };
          repaint=latch;
          await a.tween(pace(retaining?380:210),progress=>{t=progress;latch();});
          a.host.setAttribute('aria-label',retaining?'Highest eligible package held for one more spin':'Marked package expired');
          return;
        }
        for (const parcel of e.sources) {
          if (!live()) return;
          active = parcel;
          await a.tween(pace(230), (t) => {
            if (!live()) return;
            const p = point(parcel.reel, parcel.row),
              s = a.geom().cell;
            beam
              .clear()
              .roundRect(p.x - s * 0.46, p.y - s * 0.46, s * 0.92, s * 0.92, 5)
              .stroke({ color: teal, width: 2 + 2 * (1 - t), alpha: 1 });
          });
        }
        set(e, "after");
        a.readout(
          `${e.heldAfter.length}/12 holds`,
          money(e.pendingAfter),
        );
        await a.hold(500);
        return;
      } else {
        let subtotal = e.kind === "route" ? e.pendingBefore : 0;
        for (const parcel of e.sources) {
          if (!live()) return;
          active = parcel;
          progress = 0;
          if (e.kind === "route")
            await a.tween(pace(180), (t) => {
              progress = t;
              draw();
            });
          await tally(
            subtotal,
            subtotal + parcel.value,
            e.kind === "route" ? "CARGO SECURED" : "SHIPMENT",
          );
          subtotal += parcel.value;
          const sourceCell = a.geom().cell,
            art = cargoView(parcel, sourceCell * 0.7);
          effects.addChild(art);
          await a.tween(pace(390), (t) => {
            if (!live() || art.destroyed) return;
            const geom = a.geom(),
              p = point(parcel.reel, parcel.row),
              dest =
                e.kind === "route"
                  ? { x: p.x, y: geom.gy }
                  : { x: point(4, 1).x, y: point(4, 1).y };
            art.scale.set(geom.cell / sourceCell);
            art.position.set(
              p.x + (dest.x - p.x) * ease(t) - geom.cell * 0.35,
              p.y +
                (dest.y - p.y) * ease(t) -
                geom.cell * 0.35 -
                Math.sin(t * Math.PI) * geom.cell * 0.23,
            );
            art.alpha = 1 - t * 0.85;
          });
          if (!art.destroyed) art.destroy({ children: true });
        }
        active = null;
        if (e.action === "pickup") {
          sub = e.sources.length ? `ROUTE ×${e.multiplier}` : "NO PICKUP";
          value = e.pendingAfter;
          draw();
          a.readout(sub, money(value));
          await a.hold(650);
          return;
        }
        await tally(
          subtotal,
          e.beforeCap,
          e.kind === "route" ? `DELIVERY ×${e.multiplier}` : "CARGO DISPATCHED",
        );
      }
      if (!live()) return;
      // Raw cargo and the amount allowed by the round cap remain separate.
      const capped = e.credited < e.beforeCap;
      value = e.credited;
      sub = capped ? "ROUND CAP · CREDITED" : "BONUS WIN";
      draw();
      a.readout(sub, money(e.credited));
      await a.hold(850);
      if (!live() || e.credited <= 0) return;
      local.visible = false;
      caption.visible = false;
      const flyer = document.createElement("div");
      flyer.className = "kk-feature-transfer";
      flyer.textContent = `+${money(e.credited)}`;
      flyer.setAttribute("aria-hidden", "true");
      document.body.appendChild(flyer);
      try {
        await a.tween(pace(480), (t) => {
          if (!live()) return;
          const geom = a.geom(),
            from = a.screen(
              geom.gx + (geom.cell * 5 + geom.gap * 4) / 2,
              geom.gy + geom.cell * 1.5,
            ),
            to = a.landing(flyer.offsetHeight) ?? from;
          flyer.style.left = `${from.x + (to.x - from.x) * ease(t)}px`;
          flyer.style.top = `${from.y + (to.y - from.y) * ease(t)}px`;
          flyer.style.opacity = String(
            t < 0.65 ? 1 : Math.max(0, (1 - t) / 0.35),
          );
        });
      } finally {
        flyer.remove();
      }
      if (live()) a.bankCue(e.credited, capped);
    } finally {
      if (mine === epoch) {
        repaint = () => {};
        clear(effects);
        set(e, "after");
      }
    }
  }
  return {
    set,
    step,
    cancel,
    destroy() {
      disposed = true;
      cancel();
      a.host.removeEventListener("kilo-relayout", relayout);
      held.destroy({ children: true });
      effects.destroy({ children: true });
      frames.forEach((t) => t.destroy(false));
    },
  };
}
