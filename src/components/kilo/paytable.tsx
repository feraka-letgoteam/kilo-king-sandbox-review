import { PAY, PAYLINES } from "@/lib/kilo/engine";
import { ART, ART_ROOT } from "./art-map";
import { CONTRABAND_ROOT, PACKAGE_META, V8_ROOT, V8_META } from "./fish-art";

export const PAY_SYMBOLS = [
  {
    id: "duffel",
    name: "Tackle case",
    image: V8_ROOT + V8_META["sym-case-v8"].file,
  },
  {
    id: "lamp",
    name: "Gold reel",
    image: V8_ROOT + V8_META["sym-reel-v8"].file,
  },
  { id: "cuffs", name: "Bobber", image: ART_ROOT + ART.cuffs },
  { id: "keys", name: "Cash roll", image: ART_ROOT + ART.keys },
  {
    id: "brick",
    name: "Dime bags & kilos",
    image: CONTRABAND_ROOT + PACKAGE_META["package-small"].file,
  },
  ...(["A", "K", "Q", "J", "10"] as const).map((id) => ({
    id,
    name: id,
    image: ART_ROOT + ART[id],
  })),
];

/** The real paytable, presented as unboxed artwork like the reference. */
export function Paytable({ stake }: { stake: number }) {
  return (
    <section
      className="kk-info-section"
      aria-labelledby="kk-info-paytable-title"
    >
      <h2 id="kk-info-paytable-title">Pay table</h2>
      <p className="kk-info-intro">
        All wins below are multiples of the base bet. Current base bet:{" "}
        <strong>{stake.toLocaleString("en-US")}</strong>.
      </p>
      <div className="kk-info-symbols">
        {PAY_SYMBOLS.map((symbol) => (
          <figure
            className="kk-info-symbol"
            key={symbol.id}
            data-symbol={symbol.id}
          >
            <img
              src={symbol.image}
              alt=""
              width="188"
              height="188"
              decoding="async"
            />
            <figcaption>{symbol.name}</figcaption>
            <dl className="kk-info-pays" aria-label={`${symbol.name} payouts`}>
              {([5, 4, 3] as const).map((count) => (
                <div key={count} data-match={count}>
                  <dt>
                    <span className="kk-info-match-count">{count}</span>
                    <span className="kk-info-sr"> matching symbols</span>
                  </dt>
                  <dd>{PAY[symbol.id]![count - 3].toLocaleString("en-US")}×</dd>
                </div>
              ))}
            </dl>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function Paylines() {
  return (
    <section
      className="kk-info-section"
      aria-labelledby="kk-info-paylines-title"
    >
      <h2 id="kk-info-paylines-title">Paylines</h2>
      <div className="kk-info-paylines">
        {PAYLINES.map((rows, line) => (
          <figure key={line}>
            <svg
              viewBox="0 0 112 64"
              role="img"
              aria-label={`Payline ${line + 1}: rows ${rows.map((row) => row + 1).join(", ")}`}
            >
              {Array.from({ length: 15 }, (_, cell) => {
                const column = Math.floor(cell / 3);
                const row = cell % 3;
                return (
                  <rect
                    key={cell}
                    x={column * 23}
                    y={row * 22}
                    width="20"
                    height="19"
                    rx="1"
                    fill={rows[column] === row ? "#ddb868" : "#ece7dc"}
                    data-active={rows[column] === row ? "1" : "0"}
                  />
                );
              })}
            </svg>
            <figcaption>{line + 1}</figcaption>
          </figure>
        ))}
      </div>
      <div className="kk-info-centered">
        <p>
          Kilo King has 5 reels, 3 rows and 10 fixed paylines. All paylines are
          active on every spin.
        </p>
        <p>
          Three or more matching symbols pay on consecutive reels, starting from
          the leftmost reel. Only the longest matching combination pays on each
          line. Wins on different lines are added together.
        </p>
        <p>
          Line wins and scatter wins are separate. Package line wins and
          cash collections are also separate awards. Collection multipliers do
          not multiply line wins.
        </p>
      </div>
    </section>
  );
}
