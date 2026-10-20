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
import { ART, TOOL_PIVOTS, artUrl } from "./art-map";
import { CONTRABAND_ROOT, PACKAGE_META, SCATTER_KING } from "./fish-art";
import { PanelDismissContext } from "./control-panels";
import { FEATURES } from "./feature-catalog";

import { Paytable, Paylines } from "./paytable";
import { FeatureMark } from "./StageSurround";
import "./info-panel.css";
import { t } from "@/lib/kilo/copy";

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
    title: t("label.anteBet"),
    description:
      t("info.modeDesc.ante"),
  },
  {
    id: "buy",
    title: t("info.modeTitle.buy"),
    description:
      t("info.modeDesc.buy"),
  },
  {id:"yacht",title:t("info.modeTitle.yacht"),description:"15 free spins. Every VS becomes a sticky wild reel. Its duel multiplier remains through the final spin. Wins use paylines only."},
  {id:"mystery",title:t("info.modeTitle.mystery"),description:t("info.modeDesc.mystery")},
  {id:"getaway",title:"Max spins · The Getaway",description:t("info.modeDesc.getaway")},
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
        aria-label={t("info.documentAria")}
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
            <FeatureRow title="Fisherman wild" image={artUrl(ART.splash)}>
              <p>{t("info.wild.substitutes")}</p>
              <p>{t("info.wild.collects")}</p>
              <p>{t("info.wild.respin")}</p>
            </FeatureRow>
            <FeatureRow
              title="Dime bags & kilos"
              image={CONTRABAND_ROOT + PACKAGE_META["package-trophy"].file}
            >
              <p>{t("info.packages.values")}</p>
              <p>
                Obtainable values:{" "}
                <span className="kk-info-numeric">
                  {MONEY_LADDER.map((value) => `${amount(value)}×`).join(", ")}
                </span>{" "}
                the {t("unit.baseBet")}.
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
              <p>{t("info.scatter.anywhere")}</p>
              <dl className="kk-info-scatter-awards">
                {[2, 3, 4, 5].map((count) => (
                  <div key={count}>
                    <dt>{count} scatters</dt>
                    <dd>{SCATTER_PAY[count]}× {t("unit.baseBet")}</dd>
                  </div>
                ))}
              </dl>
              <p>{t("info.scatter.respin")}</p>
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
              <p>{t("info.freeSpins")}</p>
            </FeatureRow>
            <FeatureRow
              title="Collector meter & retriggers"
              image={artUrl(ART.splash)}
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
              <p>{t("info.vs.progression")}</p>
              <p>{t("info.vs.limits")}</p>
              <p>{t("info.vs.getaway")}</p>
            </FeatureRow>
            <FeatureRow title="Hook" image={artUrl(TOOL_PIVOTS.hook.file)}>
              <p>
                During Dockside Catch, the hook may activate when packages land
                without a fisherman. It shifts one reel up or down by one
                position to bring in a fisherman. A contraband package must remain for
                the collection.
              </p>
            </FeatureRow>
            <FeatureRow
              title="Dynamite"
              image={artUrl(TOOL_PIVOTS.dynamite.file)}
            >
              <p>
                During Dockside Catch, when fishermen land with zero or one package, dynamite may add two or
                three contraband packages. Dynamite package values are{" "}
                <span className="kk-info-numeric">
                  2×, 5×, 10×, 15×, 20×, 25×, 50×, 100× or 200×
                </span>{" "}
                the {t("unit.baseBet")}.
              </p>
            </FeatureRow>
            <FeatureRow
              title="Bazooka"
              image={artUrl(TOOL_PIVOTS.bazooka.file)}
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
            <h2 id="kk-info-modes-title">{t("info.modes.title")}</h2>
            <div className="kk-info-modes">
              {MODES.map((mode) => (
                <article key={mode.id} data-mode={mode.id}>
                  <h3>{mode.title}</h3>
                  <p className="kk-info-mode-cost">
                    <strong>{splashCost(100, mode.id) / 100}×</strong>{" "}
                    {t("unit.baseBet")} ·{" "}
                    <strong>{amount(splashCost(stake, mode.id))}</strong>{" "}
                    {t("info.modes.atThisBet")}
                  </p>
                  <p>{mode.description}</p>
                  <p className="kk-info-mode-limit">
                    {t("info.modes.maxPayout")}{" "}
                    <strong>{amount(splashRoundCap(stake, mode.id))}</strong>.
                  </p>
                </article>
              ))}
            </div>
            <div className="kk-info-centered">
              <p>
                {t("info.modes.confirm")}{" "}
                <strong>{amount(SPLASH_COST_MAX)}</strong>
                {t("info.modes.aboveLimit")}
              </p>
              <p>{t("info.modes.mysteryNote")}</p>
            </div>
          </section>
          <section
            className="kk-info-section"
            aria-labelledby="kk-info-information-title"
          >
            <h2 id="kk-info-information-title">Info</h2>
            <div className="kk-info-centered kk-info-facts">
              <h3>Return to player</h3>
              <p>{t("info.rtp.intro")}</p>
              <dl className="kk-info-rtp">
                {MODES.map((mode) => (
                  <div key={mode.id}>
                    <dt>{mode.title}</dt>
                    <dd>{t("info.rtp.value")}</dd>
                  </div>
                ))}
              </dl>
              <p className="kk-info-muted">{t("info.rtp.note")}</p>
              <h3>Maximum win</h3>
              <p>
                The overall maximum total round payout is{" "}
                <strong>
                  {amount(SPLASH_MAX_MULT)}
                  {t("info.max.theBaseBet")}
                </strong>
                . {t("info.max.basis")}
              </p>
              <dl className="kk-info-rtp">
                {MODES.map((mode) => (
                  <div key={mode.id}>
                    <dt>{mode.title}</dt>
                    <dd>
                      {amount(SPLASH_MODE_MAX_MULT[mode.id])}× {t("unit.baseBet")}
                    </dd>
                  </div>
                ))}
              </dl>
              <p>
                {t("info.max.atCurrent")} <strong>{amount(stake)}</strong>,
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
                  <dt>{t("label.cashCollections")}</dt>
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
              <p>{t("info.sandbox")}</p>
              <p>
                The game display is illustrative, not a physical device. Invalid
                or malfunctioning test rounds must not be treated as valid
                awards.
              </p>
              <h3>{t("info.disclaimerTitle")}</h3>
              <p data-testid="general-disclaimer">{t("info.disclaimer")}</p>
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
                <dd>{t("info.controls.spin")}</dd>
              </div>
              <div>
                <dt>
                  <ChevronDown aria-hidden="true" />
                  {t("label.betShort")}
                </dt>
                <dd>{t("info.controls.bet")}</dd>
              </div>
              <div>
                <dt>
                  <RefreshCw aria-hidden="true" />
                  Auto
                </dt>
                <dd>{t("info.controls.auto")}</dd>
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
                <dd>{t("info.controls.features")}</dd>
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
