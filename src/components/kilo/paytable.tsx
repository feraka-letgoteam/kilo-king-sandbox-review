import { PAY, PAYLINES, SCATTER_PAY } from "@/lib/kilo/engine";
import { ART, ART_ROOT } from "./art-map";
import {
  CONTRABAND_ROOT,
  PACKAGE_META,
  SCATTER_KING,
  V8_ROOT,
  V8_META,
} from "./fish-art";

const symbols = [
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
  { id: "keys", name: "Fuel can", image: ART_ROOT + ART.keys },
  {
    id: "brick",
    name: "Cash package",
    image: CONTRABAND_ROOT + PACKAGE_META["package-small"].file,
  },
  ...(["A", "K", "Q", "J", "10"] as const).map((id) => ({
    id,
    name: id,
    image: ART_ROOT + ART[id],
  })),
];
export function Paytable({ stake }: { stake: number }) {
  return (
    <section className="kk-paytable">
      <h2>Line wins</h2>
      <p>
        10 fixed paylines. Matching symbols pay from the leftmost reel. Values
        below are multiples of the base bet.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">3</th>
            <th scope="col">4</th>
            <th scope="col">5</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((s) => (
            <tr key={s.id}>
              <th scope="row">
                <img src={s.image} alt="" />
                <span>{s.name}</span>
              </th>
              {PAY[s.id]!.map((pay, i) => (
                <td key={i}>{pay}×</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The fisherman substitutes for line symbols except KING scatters. A line
        of fishermen pays the tackle-case award.
      </p>
      <div className="kk-scatter-pay">
        <img src={CONTRABAND_ROOT + SCATTER_KING.file} alt="KING scatter" />
        <div>
          <h2>Scatter wins</h2>
          <p>
            {[2, 3, 4, 5]
              .map((n) => `${n} scatters: ${SCATTER_PAY[n]}×`)
              .join(" · ")}
          </p>
        </div>
      </div>
      <details>
        <summary>View the 10 paylines</summary>
        <div className="kk-paylines">
          {PAYLINES.map((rows, i) => (
            <figure key={i}>
              <svg
                viewBox="0 0 100 64"
                role="img"
                aria-label={`Payline ${i + 1}: rows ${rows.map((r) => r + 1).join(", ")}`}
              >
                {Array.from({ length: 15 }, (_, cell) => (
                  <rect
                    key={cell}
                    x={4 + Math.floor(cell / 3) * 19}
                    y={4 + (cell % 3) * 19}
                    width="15"
                    height="15"
                    rx="2"
                    fill="#29404a"
                  />
                ))}
                <polyline
                  points={rows
                    .map((row, col) => `${11.5 + col * 19},${11.5 + row * 19}`)
                    .join(" ")}
                  fill="none"
                  stroke="#e0be77"
                  strokeWidth="2.5"
                />
              </svg>
              <figcaption>{i + 1}</figcaption>
            </figure>
          ))}
        </div>
      </details>
      <p className="kk-muted">
        Base bet: {stake.toLocaleString("en-US")} LGC. Package line wins and
        package cash collections are separate awards.
      </p>
    </section>
  );
}
