import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ART, artUrl } from './art-map';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Eye,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { splashCost } from "@/lib/kilo/engine";
import { STAKES, purchaseQuote, type GamePreferences } from "./control-model";

const amount = (n: number) => Math.round(n).toLocaleString("en-US");
import {
  FEATURES,
  FEATURE_GROUPS,
  featuresForGroup,
  type BonusFeature,
  type FeatureGroup,
} from "./feature-catalog";
import "./feature-panel.css";
import { t } from "@/lib/kilo/copy";

type ArtworkStatus = "ready" | "error";
const artworkStatus = new Map<string, ArtworkStatus>();
const artworkLoads = new Map<string, Promise<void>>();
let artworkPreload: Promise<void> | null = null;

function decodeFeatureArtwork(src: string): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  const existing = artworkLoads.get(src);
  if (existing) return existing;
  const pending = new Promise<void>((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = (status: ArtworkStatus) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      artworkStatus.set(src, status);
      resolve();
    };
    // A failed or stalled image must not leave an unusable loading panel.
    const timeout = window.setTimeout(() => finish("error"), 12000);
    image.decoding = "async";
    image.fetchPriority = "low";
    image.onload = () => {
      image.decode().then(
        () => finish("ready"),
        () => finish(image.naturalWidth > 0 ? "ready" : "error"),
      );
    };
    image.onerror = () => finish("error");
    image.src = src;
  });
  artworkLoads.set(src, pending);
  return pending;
}

/** Warm and decode the existing artwork while the game enters, once per page. */
export function preloadFeatureArtwork(): Promise<void> {
  artworkPreload ??= Promise.all(
    FEATURES.map((feature) => decodeFeatureArtwork(feature.art)),
  ).then(() => undefined);
  return artworkPreload;
}

function FeatureImage({
  feature,
  className = "",
}: {
  feature: BonusFeature;
  className?: string;
}) {
  const [status, setStatus] = useState<ArtworkStatus | "loading">(
    artworkStatus.get(feature.art) ?? "loading",
  );
  useEffect(() => {
    let current = true;
    void decodeFeatureArtwork(feature.art).then(() => {
      if (current) setStatus(artworkStatus.get(feature.art) ?? "error");
    });
    return () => {
      current = false;
    };
  }, [feature.art]);
  return (
    <div className={`kk-feature-image ${className}`} data-art-status={status}>
      <img
        src={feature.art}
        alt=""
        width="1536"
        height="1024"
        decoding="async"
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
      {status !== "ready" && (
        <span className="kk-art-fallback">
          {status === "loading" ? "Loading artwork" : "Artwork unavailable"}
        </span>
      )}
    </div>
  );
}

/** Dialog owns the dismissal timing; panels keep their normal close fallback. */
export const PanelDismissContext = createContext<(() => void) | null>(null);

export function PanelHeader({
  title,
  onClose,
  onBack,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  const dismiss = useContext(PanelDismissContext) ?? onClose;
  return (
    <div className="kk-dialog-head">
      {onBack && (
        <button
          type="button"
          className="kk-icon-button"
          aria-label="Back"
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <strong>{title}</strong>
      <button
        type="button"
        className="kk-icon-button"
        aria-label="Close"
        onClick={dismiss}
      >
        <X size={21} />
      </button>
    </div>
  );
}

export function BetPanel({
  stake,
  ante,
  maxMode = false,
  onApply,
  onClose,
}: {
  stake: number;
  ante: boolean;
  maxMode?: boolean;
  onApply: (n: number) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(stake);
  const index = STAKES.findIndex((n) => n === draft);
  return (
    <>
      <PanelHeader title={t("bet.panelTitle")} onClose={onClose} />
      <div className="kk-dialog-body kk-bet-panel">
        <span className="kk-field-label">{t("bet.baseLabel")}</span>
        <div className="kk-bet-adjust">
          <button
            type="button"
            className="kk-icon-button"
            aria-label={t("bet.decrease")}
            disabled={index <= 0}
            onClick={() => setDraft(STAKES[index - 1]!)}
          >
            <Minus size={21} />
          </button>
          <output
            className="kk-bet-value-display"
            key={draft}
            aria-live="polite"
          >
            <b>{amount(draft)}</b>
            <small>LGC</small>
          </output>
          <button
            type="button"
            className="kk-icon-button"
            aria-label={t("bet.increase")}
            disabled={index >= STAKES.length - 1}
            onClick={() => setDraft(STAKES[index + 1]!)}
          >
            <Plus size={21} />
          </button>
        </div>
        <div
          className="kk-denominations"
          role="group"
          aria-label={t("bet.amounts")}
        >
          {STAKES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={n === draft}
              onClick={() => setDraft(n)}
            >
              {amount(n)}
            </button>
          ))}
        </div>
        <div className="kk-cost-line">
          <span>{maxMode ? "Per spin · Max mode" : ante ? "Per spin · Ante on" : "Per spin"}</span>
          <b>
            {amount(splashCost(draft, maxMode ? "getaway" : ante ? "ante" : "spin"))}{" "}
            <small>LGC</small>
          </b>
        </div>
      </div>
      <div className="kk-dialog-foot">
        <button
          type="button"
          className="kk-primary"
          onClick={() => onApply(draft)}
        >
          {t("bet.apply")}
        </button>
      </div>
    </>
  );
}

function ScatterMarks({ count }: { count: number }) {
  return (
    <span className="kk-scatter-marks" aria-label={`${count} scatters`}>
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          src={artUrl(ART.bars)}
          alt=""
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** The entry composition is also the art preview; it never starts a round. */
export function BonusArtwork({ feature }: { feature: BonusFeature }) {
  return (
    <div className="kk-bonus-artwork" data-tone={feature.tone}>
      <FeatureImage feature={feature} />
      <div className="kk-bonus-artwork-copy">
        <span className="kk-art-kicker">
          {feature.kind === "preview" ? "Artwork preview" : feature.subtitle}
        </span>
        <h2>{feature.title}</h2>
        {feature.kind !== "preview" && feature.scatters && (
          <ScatterMarks count={feature.scatters} />
        )}
        {feature.kind !== "preview" ? (
          <div className="kk-art-award">
            <b>{feature.spins}</b>
            <span>
              free spins<small>Starts at ×{feature.multiplier}</small>
            </span>
          </div>
        ) : (
          <span className="kk-art-development">In development</span>
        )}
      </div>
    </div>
  );
}

export function FeatureCard({
  feature,
  stake,
  bank,
  locked,
  onSelect,
}: {
  feature: BonusFeature;
  stake: number;
  bank: number;
  locked: boolean;
  onSelect: (feature: BonusFeature) => void;
}) {
  const q =
    feature.kind === "purchase"
      ? purchaseQuote(stake, feature.mode, bank)
      : null;
  return (
    <article
      className="kk-feature-card"
      key={feature.id}
      data-feature={feature.id}
      data-tone={feature.tone}
      tabIndex={-1}
      aria-label={feature.title}
    >
      <div className="kk-feature-hero">
        <FeatureImage feature={feature} className="kk-feature-illustration" />
        <div className="kk-feature-card-head">
          <span className="kk-feature-kind">
            {feature.kind === "purchase"
              ? t("feature.kindBonusBuy")
              : feature.kind === "trigger"
                ? "Scatter bonus"
                : "In development"}
          </span>
          <h2>{feature.title}</h2>
        </div>
      </div>
      <div className="kk-feature-card-copy">
        <div className="kk-feature-reward">
          {feature.kind === "preview" ? (
            <span>Artwork & design preview</span>
          ) : (
            <>
              <b>
                <strong>{feature.spins}</strong> free spins
              </b>
              <span>Starts at ×{feature.multiplier}</span>
            </>
          )}
        </div>
        <div className="kk-feature-offer" data-purchase={!!q}>
          {q ? (
            <>
              <span className="kk-feature-price-label">
                {t("feature.purchasePrice")}
              </span>
              <b>
                {amount(q.cost)} <small>LGC</small>
              </b>
              <span>
                {feature.kind === "purchase" ? feature.multiple : ""}×{" "}
                {t("unit.baseBet")}
              </span>
            </>
          ) : feature.kind === "trigger" ? (
            <>
              <ScatterMarks count={feature.scatters} />
              <span>Land {feature.scatters} scatters</span>
            </>
          ) : (
            <>
              <Eye size={22} aria-hidden="true" />
              <span>Gameplay in development</span>
            </>
          )}
        </div>
        <div className="kk-feature-decision" data-unavailable={!!q?.reason}>
          <button
            type="button"
            className={
              q ? "kk-feature-action is-purchase" : "kk-feature-action"
            }
            aria-label={
              q
                ? t("feature.reviewAria")(feature.title, amount(q.cost))
                : `Preview ${feature.title}`
            }
            disabled={!!q && (locked || !q.allowed)}
            aria-describedby={
              q?.reason ? `feature-${feature.id}-reason` : undefined
            }
            onClick={() => onSelect(feature)}
          >
            {q ? t("label.buyFeature") : "View preview"}
            <ChevronRight size={17} />
          </button>
          <div
            className="kk-feature-availability"
            data-unavailable={!!q?.reason}
          >
            {q?.reason && (
              <p
                id={`feature-${feature.id}-reason`}
                className="kk-unavailable"
                role="status"
              >
                {q.reason}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function FeaturesPanel({
  stake,
  bank,
  ante,
  anteRestriction = { hidden: false, disabled: false },
  anteOnly = false,
  locked,
  onAnte,
  onEditBet,
  onStake,
  onBuy,
  onClose,
}: {
  stake: number;
  bank: number;
  ante: boolean;
  anteRestriction?: { hidden: boolean; disabled: boolean; reason?: string };
  anteOnly?: boolean;
  locked: boolean;
  onAnte: (on: boolean) => void;
  onEditBet: () => void;
  onStake: (stake: number) => void;
  onBuy: (mode: import("@/lib/kilo/engine").PurchaseMode) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<BonusFeature | null>(null);
  const [group, setGroup] = useState<FeatureGroup>("buy");
  const [readyGroup, setReadyGroup] = useState<FeatureGroup | null>(null);
  const [active, setActive] = useState(0);
  const submitted = useRef(false);
  const gallery = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const lastChoice = useRef<string | null>(null);
  const visibleFeatures = featuresForGroup(group);
  const artworkReady =
    readyGroup === group ||
    visibleFeatures.every((feature) => artworkStatus.has(feature.art));
  const quote =
    choice?.kind === "purchase"
      ? purchaseQuote(stake, choice.mode, bank)
      : null;

  useEffect(() => {
    void preloadFeatureArtwork();
  }, []);
  useEffect(() => {
    let current = true;
    void Promise.all(
      visibleFeatures.map((feature) => decodeFeatureArtwork(feature.art)),
    ).then(() => {
      if (current) setReadyGroup(group);
    });
    return () => {
      current = false;
    };
  }, [group]);

  useEffect(() => {
    if (choice) {
      detail.current?.focus({ preventScroll: true });
      return;
    }
    const root = gallery.current;
    if (!root) return;
    if (lastChoice.current) {
      const index = visibleFeatures.findIndex(
        (feature) => feature.id === lastChoice.current,
      );
      if (index >= 0) showCard(index, true);
    }
    // Rotation can remove the overflow without emitting a scroll event.
    // Keep the phone pager tied to the visible card after either breakpoint.
    const observer = new ResizeObserver(() => {
      const first = root.children[0] as HTMLElement | undefined;
      const next = root.children[1] as HTMLElement | undefined;
      const step = first && next ? next.offsetLeft - first.offsetLeft : 0;
      setActive(
        root.scrollWidth > root.clientWidth + 1 && step > 0
          ? Math.min(
              visibleFeatures.length - 1,
              Math.max(0, Math.round(root.scrollLeft / step)),
            )
          : 0,
      );
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [choice, group, artworkReady]);

  const changeGroup = (next: FeatureGroup) => {
    setGroup(next);
    setActive(0);
    lastChoice.current = null;
  };

  const showCard = (index: number, focusCard = false) => {
    const root = gallery.current;
    const card = root?.children[index] as HTMLElement | undefined;
    const first = root?.children[0] as HTMLElement | undefined;
    if (root && card && first)
      root.scrollTo({ left: card.offsetLeft - first.offsetLeft });
    setActive(index);
    if (focusCard && card) {
      // Arrow navigation changes both the visible offer and keyboard target.
      // A disabled offer receives focus on its article, never its old neighbor.
      const button = card.querySelector<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      (button ?? card).focus({ preventScroll: true });
    }
  };
  const select = (feature: BonusFeature) => {
    lastChoice.current = feature.id;
    submitted.current = false;
    setChoice(feature);
  };

  return (
    <>
      <PanelHeader
        title={
          choice
            ? choice.kind === "purchase"
              ? t("label.confirmPurchase")
              : "Bonus preview"
            : "Features"
        }
        onClose={onClose}
        onBack={choice ? () => setChoice(null) : undefined}
      />
      <div
        key={choice?.id ?? "gallery"}
        data-view={choice ? "detail" : "gallery"}
        className={`kk-dialog-body kk-features-body${choice ? " is-detail" : ""}`}
      >
        {choice?.kind === "purchase" && quote ? (
          <div
            className="kk-purchase-confirmation"
            ref={detail}
            tabIndex={-1}
            data-testid="purchase-confirmation"
            data-tone={choice.tone}
          >
            <FeatureImage feature={choice} className="kk-confirm-art" />
            <h2>{choice.title}</h2>
            <p className="kk-confirm-award">
              {choice.spins} free spins · Starts at ×{choice.multiplier}
            </p>
            <div className="kk-confirm-cost">
              <span>{t("label.purchaseCost")}</span>
              <strong>{amount(quote.cost)}</strong>
              <small>LGC</small>
            </div>
            <dl className="kk-confirm-wallet">
              <div>
                <dt>{t("label.baseBet")}</dt>
                <dd>{amount(stake)} LGC</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>{amount(bank)} LGC</dd>
              </div>
            </dl>
            <p className="kk-muted">
              The bonus modifier may increase the starting award.
              <br />
              Charged once when you confirm.
            </p>
            {quote.reason && (
              <p className="kk-unavailable" role="status">
                {quote.reason}
              </p>
            )}
          </div>
        ) : choice ? (
          <div
            className="kk-feature-detail"
            ref={detail}
            tabIndex={-1}
            data-testid="bonus-art-preview"
          >
            <BonusArtwork feature={choice} />
            <div className="kk-feature-detail-copy">
              <span className="kk-field-label">
                {choice.kind === "trigger" ? "Scatter bonus" : "Design preview"}
              </span>
              <h2>{choice.title}</h2>
              <p>{choice.detail}</p>
              <p className="kk-preview-note">
                <Eye size={17} aria-hidden="true" />
                {t("feature.previewNoBet")}
              </p>
            </div>
          </div>
        ) : (
          <>
            {!anteOnly && (
              <>
                <div
                  className="kk-feature-tabs"
                  role="tablist"
                  aria-label="Feature categories"
                >
                  {FEATURE_GROUPS.map((item) => (
                    <button
                      key={item.id}
                      id={`feature-tab-${item.id}`}
                      type="button"
                      role="tab"
                      aria-selected={group === item.id}
                      aria-controls="feature-gallery-panel"
                      tabIndex={group === item.id ? 0 : -1}
                      onClick={() => changeGroup(item.id)}
                      onKeyDown={(event) => {
                        const index = FEATURE_GROUPS.findIndex(
                          (entry) => entry.id === group,
                        );
                        const next =
                          event.key === "ArrowRight"
                            ? (index + 1) % FEATURE_GROUPS.length
                            : event.key === "ArrowLeft"
                              ? (index + FEATURE_GROUPS.length - 1) %
                                FEATURE_GROUPS.length
                              : event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? FEATURE_GROUPS.length - 1
                                  : -1;
                        if (next < 0) return;
                        event.preventDefault();
                        const target = FEATURE_GROUPS[next]!;
                        changeGroup(target.id);
                        event.currentTarget.parentElement
                          ?.querySelector<HTMLButtonElement>(
                            `#feature-tab-${target.id}`,
                          )
                          ?.focus();
                      }}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <section
                  id="feature-gallery-panel"
                  role="tabpanel"
                  aria-labelledby={`feature-tab-${group}`}
                  aria-busy={!artworkReady}
                  className="kk-feature-group"
                  data-group={group}
                >
                  {!artworkReady ? (
                    <div className="kk-feature-loading" role="status">
                      <span className="kk-art-loader" aria-hidden="true" />
                      <strong>Loading features</strong>
                      <span>Preparing the artwork</span>
                    </div>
                  ) : (
                    <>
                      <div
                        className="kk-feature-gallery"
                        key={group}
                        data-count={visibleFeatures.length}
                        ref={gallery}
                        aria-label="Bonus features"
                        onKeyDown={(event) => {
                          const root = gallery.current;
                          if (!root || root.scrollWidth <= root.clientWidth + 1)
                            return;
                          if (
                            event.key !== "ArrowRight" &&
                            event.key !== "ArrowLeft"
                          )
                            return;
                          event.preventDefault();
                          showCard(
                            Math.max(
                              0,
                              Math.min(
                                visibleFeatures.length - 1,
                                active + (event.key === "ArrowRight" ? 1 : -1),
                              ),
                            ),
                            true,
                          );
                        }}
                        onScroll={() => {
                          const root = gallery.current;
                          if (!root || root.scrollWidth <= root.clientWidth + 1)
                            return;
                          const first = root.children[0] as HTMLElement;
                          const next = root.children[1] as HTMLElement;
                          const step = next.offsetLeft - first.offsetLeft;
                          if (step > 0)
                            setActive(
                              Math.min(
                                visibleFeatures.length - 1,
                                Math.max(0, Math.round(root.scrollLeft / step)),
                              ),
                            );
                        }}
                      >
                        {visibleFeatures.map((feature) => (
                          <FeatureCard
                            key={feature.id}
                            feature={feature}
                            stake={stake}
                            bank={bank}
                            locked={locked}
                            onSelect={select}
                          />
                        ))}
                      </div>
                      <nav
                        className="kk-feature-pager"
                        aria-label="Browse bonuses"
                      >
                        <button
                          type="button"
                          className="kk-icon-button"
                          aria-label="Previous bonus"
                          disabled={active === 0}
                          onClick={() => showCard(active - 1)}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <div className="kk-feature-pagination">
                          <div className="kk-feature-dots" aria-hidden="true">
                            {visibleFeatures.map((feature, i) => (
                              <span
                                key={feature.id}
                                data-active={i === active ? "true" : undefined}
                              />
                            ))}
                          </div>
                          <span aria-live="polite">
                            {active + 1} / {visibleFeatures.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="kk-icon-button"
                          aria-label="Next bonus"
                          disabled={active === visibleFeatures.length - 1}
                          onClick={() => showCard(active + 1)}
                        >
                          <ChevronRight size={20} />
                        </button>
                      </nav>
                    </>
                  )}
                </section>
              </>
            )}
            <div className="kk-feature-utilities">
              {!anteRestriction.hidden && (
                <div
                  className="kk-ante-feature"
                  data-active={ante ? "true" : undefined}
                >
                  <div className="kk-ante-copy">
                    <h2>{t("label.anteBet")}</h2>
                    <p>
                      1.5× {t("unit.baseBet")} ·{" "}
                      {amount(splashCost(stake, "ante"))} LGC /
                      spin
                    </p>
                  </div>
                  <button
                    type="button"
                    className="kk-ante-action"
                    aria-pressed={ante}
                    aria-label={
                      ante ? t("feature.anteAriaOn") : t("feature.anteAriaOff")
                    }
                    disabled={locked || anteRestriction.disabled}
                    title={anteRestriction.reason}
                    onClick={() => {
                      if (!anteRestriction.disabled) onAnte(!ante);
                    }}
                  >
                    <span className="kk-ante-switch" aria-hidden="true" />
                    {ante ? "Ante On" : "Ante Off"}
                  </button>
                </div>
              )}
              <div className="kk-feature-toolbar">
                <div className="kk-feature-balance">
                  <span>Balance</span>
                  <b>
                    {amount(bank)} <small>LGC</small>
                  </b>
                </div>
                <div
                  className="kk-feature-bet-control"
                  aria-label={t("bet.featureGroup")}
                >
                  <button
                    type="button"
                    className="kk-icon-button"
                    aria-label={t("bet.featureDecrease")}
                    disabled={locked || stake === STAKES[0]}
                    onClick={() =>
                      onStake(
                        STAKES[
                          Math.max(0, STAKES.findIndex((n) => n === stake) - 1)
                        ]!,
                      )
                    }
                  >
                    <Minus size={18} />
                  </button>
                  <button
                    type="button"
                    className="kk-feature-bet"
                    onClick={onEditBet}
                    disabled={locked}
                  >
                    <span>{t("label.baseBet")}</span>
                    <b>
                      {amount(stake)} <small>LGC</small>
                    </b>
                  </button>
                  <button
                    type="button"
                    className="kk-icon-button"
                    aria-label={t("bet.featureIncrease")}
                    disabled={locked || stake === STAKES.at(-1)}
                    onClick={() =>
                      onStake(
                        STAKES[
                          Math.min(
                            STAKES.length - 1,
                            STAKES.findIndex((n) => n === stake) + 1,
                          )
                        ]!,
                      )
                    }
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>
            <p className="kk-gallery-note">
              {anteOnly
                ? t("feature.anteNote")
                : t("feature.galleryNote")}
            </p>
          </>
        )}
      </div>
      {choice && (
        <div className="kk-dialog-foot kk-confirm-actions">
          <button
            type="button"
            className="kk-secondary"
            onClick={() => setChoice(null)}
          >
            {choice.kind === "purchase" ? "Back" : "Back to features"}
          </button>
          {choice.kind === "purchase" && quote && (
            <button
              type="button"
              className="kk-primary"
              data-testid="confirm-purchase"
              disabled={locked || !quote.allowed}
              onClick={() => {
                if (submitted.current || locked || !quote.allowed) return;
                submitted.current = true;
                onBuy(choice.mode);
              }}
            >
              {t("feature.confirmBuy")(amount(quote.cost))}
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function SettingsPanel({
  compactActions,
  disabledTurbo = false,
  preferences,
  onChange,
  locked,
  onRules,
  onClose,
  onBack,
}: {
  compactActions?: ReactNode;
  disabledTurbo?: boolean;
  preferences: GamePreferences;
  onChange: (p: GamePreferences) => void;
  locked: boolean;
  onRules: () => void;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <PanelHeader title="Game settings" onClose={onClose} onBack={onBack} />
      <div className="kk-dialog-body kk-settings-body">
        {compactActions}
        <fieldset disabled={locked}>
          <legend>Spin speed</legend>
          <div className="kk-segmented">
            {(
              [
                ["normal", "Normal"],
                ["turbo", "Turbo"],
                ["super", "Super turbo"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                disabled={disabledTurbo && value !== "normal"}
                aria-pressed={preferences.speed === value}
                onClick={() => onChange({ ...preferences, speed: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="kk-setting-hint">
            {disabledTurbo
              ? "Turbo speeds are unavailable in this jurisdiction."
              : locked
                ? "Available after this round."
                : "Faster reels. Feature results remain readable."}
          </p>
        </fieldset>
        <fieldset disabled={locked}>
          <legend>Reduced motion</legend>
          <div className="kk-segmented">
            {(
              [
                ["system", "System"],
                ["reduce", "On"],
                ["full", "Off"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={preferences.motion === value}
                onClick={() => onChange({ ...preferences, motion: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="kk-setting-hint">
            Limits reel motion, count-ups and decorative effects.
          </p>
        </fieldset>
        <button type="button" className="kk-menu-link" onClick={onRules}>
          <BookOpen size={20} />
          <span>{t("menu.rules")}</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </>
  );
}
