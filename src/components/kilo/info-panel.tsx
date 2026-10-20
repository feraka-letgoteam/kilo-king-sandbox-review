import { useContext, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  Menu,
  RotateCw,
  RefreshCw,
  Settings2,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import {
  LEVEL_MULT,
  MONEY_LADDER,
  SCATTER_PAY,
  SPLASH_COST_MAX,
  SPLASH_MAX_MULT,
  SPLASH_MODE_MAX_MULT,
  splashCost,
  splashRoundCap,
  type SplashMode,
} from "@/lib/kilo/engine";
import { ART, ART_ROOT, TOOL_PIVOTS } from "./art-map";
import { CONTRABAND_ROOT, PACKAGE_META, SCATTER_KING } from "./fish-art";
import { PanelDismissContext } from "./control-panels";
import { FEATURES } from "./feature-catalog";

import { Paytable, Paylines } from "./paytable";
import { FeatureMark } from "./StageSurround";
import "./info-panel.css";

const amount = (value: number) => value.toLocaleString("en-US");
const MODES: { id: SplashMode; title: string; description: string }[] = [
  {
    id: "spin",
    title: "Base game",
    description:
      "One spin on all 10 paylines. Three, four or five KING scatters trigger free spins.",
  },
  {
    id: "ante",
    title: "Ante bet",
    description:
      "One spin with increased scatter frequency. Turn Ante On or Off on the Features page. Payouts still use the base bet.",
  },
  {
    id: "buy",
    title: "Dockside Catch buy",
    description:
      "Direct entry with 10 free spins, starting at ×1. No base-game line or scatter award is paid on entry.",
  },
  {id:"yacht",title:"Yacht Stash buy",description:"15 free spins. Every VS becomes a sticky wild reel. Its duel multiplier remains through the final spin. Wins use paylines only."},
  {id:"mystery",title:"Mystery Bonus buy",description:"One purchase randomly awards Dockside Catch, Yacht Stash or Super Yacht Stash. Selection odds appear in the confirmation. Super Yacht opens with a guaranteed winning ×25 VS on reel one in spin one."},
  {id:"getaway",title:"Max spins · The Getaway",description:"Activate the mode at no charge, then press Spin for each paid attempt. Each spin costs 1,000× the base bet and returns exactly 25,000× or zero. The giant speedboat advances left to right across five positions, pausing at each reached position. A partial boat pays zero and stays in place until the next spin; a full boat pays the max win. No free spins or partial prize. Exit the mode between spins."},
];

function FeatureRow({
  title,
  image,
  children,
}: {
  title: string;
  image: string;
  children: ReactNode;
}) {
  return (
    <article className="kk-info-feature">
      <img
        className="kk-info-feature-art"
        src={image}
        alt=""
        width="200"
        height="200"
        loading="lazy"
        decoding="async"
      />
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </article>
  );
}

export function InfoPanel({
  stake,
  round,
  onClose,
  onSettings,
}: {
  stake: number;
  round: { line: number; collect: number; scatter: number };
  onClose: () => void;
  onSettings: () => void;
}) {
  const dismiss = useContext(PanelDismissContext) ?? onClose;
  const cap = splashRoundCap(stake);
  return (
    <>
      <button
        type="button"
        className="kk-info-close"
        onClick={dismiss}
        aria-label="Close game information"
      >
        <X aria-hidden="true" />
      </button>
      <div
        className="kk-info-scroll"
        role="document"
        aria-label="Kilo King paytable, features and game information"
        tabIndex={0}
      >
        <div className="kk-info-content">
          <Paytable stake={stake} />
          <Paylines />
          <section
            className="kk-info-section"
            aria-labelledby="kk-info-features-title"
          >
            <h2 id="kk-info-features-title">Features</h2>
            <FeatureRow title="Fisherman wild" image={ART_ROOT + ART.splash}>
              <p>
                In the base game and Dockside Catch, the fisherman substitutes for
                every paying line symbol, but never for a KING scatter. A full
                line of fishermen pays the tackle-case award.
              </p>
              <p>
                In Dockside Catch, each fisherman collects every contraband package at the
                current collection multiplier. Multiple fishermen collect the
                same packages separately. A fisherman without a contraband package
                pays no collection, but still advances the meter. In the base game, an occasional Dockside Deal adds a collector that gathers visible cargo at ×1. It does not advance the bonus meter.
              </p>
              <p>
                On eligible non-winning base boards with at least two packages and no
                scatters or fisherman, a Catch Respin can hold all existing packages
                for one free respin of the other positions. New packages and fishermen
                can land. Every fisherman collects all final packages once at ×1;
                without a fisherman, packages do not pay. Only the final board is paid,
                and the respin does not charge another bet or trigger free spins.
              </p>
            </FeatureRow>
            <FeatureRow
              title="Dime bags & kilos"
              image={CONTRABAND_ROOT + PACKAGE_META["package-trophy"].file}
            >
              <p>
                Dime bags and wrapped kilos show cash values based on your base
                bet. Fishermen collect them during Dockside Catch and on eligible
                base-game collector landings. They are not scatters. The separate Cash roll symbol pays
                ordinary line wins.
              </p>
              <p>
                Obtainable values:{" "}
                <span className="kk-info-numeric">
                  {MONEY_LADDER.map((value) => `${amount(value)}×`).join(", ")}
                </span>{" "}
                the base bet.
              </p>
              <p>
                Collection = total package value × number of fishermen × current
                collection multiplier. The round payout limit still applies.
              </p>
            </FeatureRow>
            <FeatureRow
              title="KING scatter"
              image={CONTRABAND_ROOT + SCATTER_KING.file}
            >
              <p>
                The KING crown is the only scatter. Each reel can count once.
                Scatter wins pay anywhere on the final base-game screen,
                independently of paylines.
              </p>
              <dl className="kk-info-scatter-awards">
                {[2, 3, 4, 5].map((count) => (
                  <div key={count}>
                    <dt>{count} scatters</dt>
                    <dd>{SCATTER_PAY[count]}× base bet</dd>
                  </div>
                ))}
              </dl>
              <p>
                Exactly two scatter reels lock while the other three reels
                respin once. The final screen determines the line wins, scatter
                award and any free spins. Purchased features do not pay scatter
                awards.
              </p>
            </FeatureRow>
            <FeatureRow
              title="Free spins"
              image={
                FEATURES.find((feature) => feature.id === "scatter-3")!.art
              }
            >
              <div className="kk-info-trigger-awards">
                {FEATURES.filter(
                  (feature) => feature.kind !== "preview" && feature.scatters,
                ).map(
                  (feature) =>
                    feature.kind !== "preview" && (
                      <p key={feature.id}>
                        <strong>{feature.scatters} scatters</strong>
                        <span>{feature.spins} free spins</span>
                      </p>
                    ),
                )}
              </div>
              <p>
                Features use the triggering base bet with no extra charge per spin. Three scatters start Dockside Catch (10 spins); four start Yacht Stash (15 spins); five start Super Yacht Stash (15 spins). The five-scatter feature guarantees a winning ×25 VS on reel one in spin one. Dockside Catch and Yacht Stash have direct buys; Super Yacht is available through five scatters or a Mystery Bonus buy. Yacht uses the existing ten paylines with sticky VS wilds. The Getaway has a single binary result.
              </p>
            </FeatureRow>
            <FeatureRow
              title="Collector meter & retriggers"
              image={ART_ROOT + ART.splash}
            >
              <p>
                In Dockside Catch, every fisherman advances the meter after its spin. At 4, 8 and
                12 total collectors, each milestone adds 10 free spins and
                raises the multiplier for the next spin.
              </p>
              <ol
                className="kk-info-ladder"
                aria-label="Collection multiplier progression"
              >
                {LEVEL_MULT.map((multiplier, index) => (
                  <li key={multiplier}>
                    <strong>×{multiplier}</strong>
                    <span>{index * 4} collectors</span>
                  </li>
                ))}
              </ol>
              <p>
                A milestone reached during a collection does not increase that
                collection. No further retriggers are awarded after ×10. The
                meter resets when the feature ends.
              </p>
            </FeatureRow>
            <FeatureRow title="Marked cargo" image={CONTRABAND_ROOT + PACKAGE_META["package-king"].file}>
              <p>When a Dockside Catch spin has packages but no fisherman, the highest-value eligible package may be marked. Its position and printed value survive exactly one additional spin. A collector on that spin collects it normally; otherwise it expires. The same package cannot renew its hold; a different package may then be marked. The hook does not shift a reserved package.</p>
            </FeatureRow>
            {FEATURES.filter(feature=>feature.kind!=='preview'&&feature.id!=='scatter-3').map(feature=><FeatureRow key={feature.id} title={feature.title} image={feature.art}><p>{feature.detail}</p></FeatureRow>)}
            <FeatureRow title="VS progression & multipliers" image={CONTRABAND_ROOT + PACKAGE_META["package-king"].file}>
              <p>Yacht starts with an opening ×2 VS in the first two spins. Super Yacht instead guarantees a winning ×25 VS on reel one in the very first spin; King or Cop can win it, and the ×25 stays sticky until completion. That ×25 is a wild multiplier, not a guaranteed 25× payout. Further recorded encounters develop during the middle and closing spins, unless the round has already reached its payout limit. Every winning ×2, ×3, ×4, ×5, ×6, ×8 or ×10 reel locks through the feature. King and Cop never combine. Adjacent same-side reels form one continuous wild: ×3 beside ×4 becomes ×12. Each group product is applied once to a winning connection; separate participating groups add together. This feature has no cash collection.</p>
              <p>The Yacht purchase payout limit remains 18,000× base bet. A natural Yacht or Super Yacht stays inside its base or Ante round’s 25,000× total payout limit. Super Yacht from Mystery also has a 25,000× limit. Mystery-selected Dockside and Yacht retain their existing 25,000× and 18,000× limits respectively. The local candidate uses a weighted outcome catalogue with approximately 95.5% return against the 200× purchase price; it is not a certified or published Stake Engine return. All feature state resets at the end of the paid round.</p>
              <p>The Getaway buys exactly one spin for 1,000× base bet. Its only payouts are 25,000× or zero; no second gamble is offered. In this local candidate distribution the max-win probability is 3.82% and loss probability is 96.18%. The exact candidate return is 95.5%; this is not a certified or published Stake Engine return.</p>
            </FeatureRow>
            <FeatureRow title="Hook" image={ART_ROOT + TOOL_PIVOTS.hook.file}>
              <p>
                During Dockside Catch, the hook may activate when packages land
                without a fisherman. It shifts one reel up or down by one
                position to bring in a fisherman. A contraband package must remain for
                the collection.
              </p>
            </FeatureRow>
            <FeatureRow
              title="Dynamite"
              image={ART_ROOT + TOOL_PIVOTS.dynamite.file}
            >
              <p>
                During Dockside Catch, when fishermen land with zero or one package, dynamite may add two or
                three contraband packages. Dynamite package values are{" "}
                <span className="kk-info-numeric">
                  2×, 5×, 10×, 15×, 20×, 25×, 50×, 100× or 200×
                </span>{" "}
                the base bet.
              </p>
            </FeatureRow>
            <FeatureRow
              title="Bazooka"
              image={ART_ROOT + TOOL_PIVOTS.bazooka.file}
            >
              <p>
                When fishermen land with zero or one package, the bazooka may keep the
                fishermen and existing package, then refill the other positions. Any resulting
                collection uses the current multiplier. Tools are not guaranteed
                to activate.
              </p>
            </FeatureRow>
          </section>
          <section
            className="kk-info-section"
            aria-labelledby="kk-info-modes-title"
          >
            <h2 id="kk-info-modes-title">Bet modes</h2>
            <div className="kk-info-modes">
              {MODES.map((mode) => (
                <article key={mode.id} data-mode={mode.id}>
                  <h3>{mode.title}</h3>
                  <p className="kk-info-mode-cost">
                    <strong>{splashCost(100, mode.id) / 100}×</strong> base bet
                    · <strong>{amount(splashCost(stake, mode.id))}</strong> at
                    this bet
                  </p>
                  <p>{mode.description}</p>
                  <p className="kk-info-mode-limit">
                    Maximum round payout at this bet:{" "}
                    <strong>{amount(splashRoundCap(stake, mode.id))}</strong>.
                  </p>
                </article>
              ))}
            </div>
            <div className="kk-info-centered">
              <p>
                Purchases require confirmation of the full charge. The maximum
                single-round charge is{" "}
                <strong>{amount(SPLASH_COST_MAX)}</strong>. A purchase above
                that limit, or above your available balance, is unavailable.
              </p>
              <p>
                Mystery Bonus is an artwork preview in development and cannot currently be played or purchased. The Getaway is the playable Max spins mode. Activating it does not charge the balance; each press of Spin buys one attempt at the displayed cost.
              </p>
            </div>
          </section>
          <section
            className="kk-info-section"
            aria-labelledby="kk-info-information-title"
          >
            <h2 id="kk-info-information-title">Info</h2>
            <div className="kk-info-centered kk-info-facts">
              <h3>Return to player</h3>
              <p>
                Verified theoretical RTP is not yet available for this sandbox.
              </p>
              <dl className="kk-info-rtp">
                {MODES.map((mode) => (
                  <div key={mode.id}>
                    <dt>{mode.title}</dt>
                    <dd>Not verified</dd>
                  </div>
                ))}
              </dl>
              <p className="kk-info-muted">
                RTP describes an expected return over many plays, not the return
                from any individual session. This preview does not publish a
                theoretical percentage.
              </p>
              <h3>Maximum win</h3>
              <p>
                The overall maximum total round payout is{" "}
                <strong>{amount(SPLASH_MAX_MULT)}× the base bet</strong>.
                This is based on the base bet, not the feature purchase price.
              </p>
              <dl className="kk-info-rtp">
                {MODES.map((mode) => (
                  <div key={mode.id}>
                    <dt>{mode.title}</dt>
                    <dd>{amount(SPLASH_MODE_MAX_MULT[mode.id])}× base bet</dd>
                  </div>
                ))}
              </dl>
              <p>
                At your current base bet of <strong>{amount(stake)}</strong>,
                the overall maximum total round payout is <strong>{amount(cap)}</strong>
                . This includes all line wins, scatter wins and collections.
                Reaching the mode's cap ends the round, including remaining free spins,
                and awards no more than the cap.
              </p>
              <h3>Round breakdown</h3>
              <dl className="kk-info-breakdown">
                <div>
                  <dt>Line wins</dt>
                  <dd>{amount(round.line)}</dd>
                </div>
                <div>
                  <dt>Cash collections</dt>
                  <dd>{amount(round.collect)}</dd>
                </div>
                <div>
                  <dt>Scatter wins</dt>
                  <dd>{amount(round.scatter)}</dd>
                </div>
              </dl>
              <p className="kk-info-muted">
                Cumulative figures for the displayed round.
              </p>
              <h3>Sandbox operation</h3>
              <p>
                This private preview uses a local test balance. No real-money
                wallet or Stake Engine game server is connected. Animations and
                spin-speed settings do not alter the recorded round result.
              </p>
              <p>
                The game display is illustrative, not a physical device. Invalid
                or malfunctioning test rounds must not be treated as valid
                awards.
              </p>
            </div>
          </section>
          <section
            className="kk-info-section"
            aria-labelledby="kk-info-controls-title"
          >
            <h2 id="kk-info-controls-title">Controls</h2>
            <dl className="kk-info-controls">
              <div>
                <dt>
                  <RotateCw aria-hidden="true" />
                  Spin / Spacebar
                </dt>
                <dd>
                  Starts one round at the selected wager. During presentation,
                  the same control can skip ahead without changing the result.
                </dd>
              </div>
              <div>
                <dt>
                  <ChevronDown aria-hidden="true" />
                  Bet
                </dt>
                <dd>
                  Open the bet selector or use its steppers. The readout
                  includes the Ante charge when enabled. Ante On / Off is on the
                  Features page.
                </dd>
              </div>
              <div>
                <dt>
                  <RefreshCw aria-hidden="true" />
                  Auto
                </dt>
                <dd>
                  Choose a finite number of spins and confirm to start. Auto
                  stops on a bonus or an unavailable next bet. Stop cancels the
                  remaining queue; the current round completes.
                </dd>
              </div>
              <div>
                <dt>
                  <Zap aria-hidden="true" />
                  Speed
                </dt>
                <dd>
                  Normal, Turbo and Super turbo change presentation speed only.
                  Use the lightning control, Auto screen or Game settings.
                </dd>
              </div>
              <div>
                <dt>
                  <FeatureMark />
                  Features
                </dt>
                <dd>
                  The crown-and-hook control opens the feature catalogue and
                  Ante setting. Review the price and confirm before buying a
                  feature.
                </dd>
              </div>
              <div>
                <dt>
                  <Menu aria-hidden="true" />
                  Menu
                </dt>
                <dd>
                  Opens Info, Music and Sound. Music and Sound have separate
                  controls. Game settings includes speed and motion preferences.
                </dd>
              </div>
              <div>
                <dt>
                  <Volume2 aria-hidden="true" />
                  Audio
                </dt>
                <dd>
                  Toggle music and sound effects independently in the menu.
                  Unavailable audio controls remain disabled until audio is
                  ready.
                </dd>
              </div>
              <div>
                <dt>
                  <Settings2 aria-hidden="true" />
                  Availability
                </dt>
                <dd>
                  Some controls can be unavailable for your session. Small
                  popout views keep Auto and speed options in Game settings.
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="kk-info-settings-link"
              onClick={onSettings}
            >
              Game settings <ArrowRight aria-hidden="true" />
            </button>
          </section>
          <footer className="kk-info-footer">
            Kilo King · Private sandbox
          </footer>
        </div>
      </div>
    </>
  );
}
