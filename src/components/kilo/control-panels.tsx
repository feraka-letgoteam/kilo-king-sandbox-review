import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Eye,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { splashCost } from "@/lib/kilo/engine";
import { STAKES, purchaseQuote, type GamePreferences } from "./control-model";

const amount = (n: number) => Math.round(n).toLocaleString("en-US");
import { FEATURES, type BonusFeature } from "./feature-catalog";

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
  onApply,
  onClose,
}: {
  stake: number;
  ante: boolean;
  onApply: (n: number) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(stake);
  const index = STAKES.findIndex((n) => n === draft);
  return (
    <>
      <PanelHeader title="Bet amount" onClose={onClose} />
      <div className="kk-dialog-body kk-bet-panel">
        <span className="kk-field-label">Base bet · LGC</span>
        <div className="kk-bet-adjust">
          <button
            type="button"
            className="kk-icon-button"
            aria-label="Decrease bet"
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
            aria-label="Increase bet"
            disabled={index >= STAKES.length - 1}
            onClick={() => setDraft(STAKES[index + 1]!)}
          >
            <Plus size={21} />
          </button>
        </div>
        <div
          className="kk-denominations"
          role="group"
          aria-label="Base bet amounts"
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
          <span>{ante ? "Per spin · Ante on" : "Per spin"}</span>
          <b>
            {amount(splashCost(draft, ante ? "ante" : "spin"))}{" "}
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
          Apply bet
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
          src="/kilo-contraband-v1/scatter-king.png"
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
      <img src={feature.art} alt="" width="1536" height="1024" />
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

export function FeaturesPanel({
  stake,
  bank,
  ante,
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
  locked: boolean;
  onAnte: (on: boolean) => void;
  onEditBet: () => void;
  onStake: (stake: number) => void;
  onBuy: (mode: "buy" | "chopper") => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<BonusFeature | null>(null);
  const [active, setActive] = useState(0);
  const submitted = useRef(false);
  const gallery = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const lastChoice = useRef<string | null>(null);
  const quote =
    choice?.kind === "purchase"
      ? purchaseQuote(stake, choice.mode, bank)
      : null;

  useEffect(() => {
    if (choice) {
      detail.current?.focus({ preventScroll: true });
      return;
    }
    const root = gallery.current;
    if (!root) return;
    if (lastChoice.current) {
      root
        ?.querySelector<HTMLButtonElement>(
          `[data-feature="${lastChoice.current}"] button`,
        )
        ?.focus();
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
              FEATURES.length - 1,
              Math.max(0, Math.round(root.scrollLeft / step)),
            )
          : 0,
      );
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [choice]);

  const showCard = (index: number) => {
    const root = gallery.current;
    const card = root?.children[index] as HTMLElement | undefined;
    const first = root?.children[0] as HTMLElement | undefined;
    if (root && card && first)
      root.scrollTo({ left: card.offsetLeft - first.offsetLeft });
    setActive(index);
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
              ? "Confirm purchase"
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
            <img
              className="kk-confirm-art"
              src={choice.art}
              width="1536"
              height="1024"
              alt=""
            />
            <h2>{choice.title}</h2>
            <p className="kk-confirm-award">
              {choice.spins} free spins · Starts at ×{choice.multiplier}
            </p>
            <div className="kk-confirm-cost">
              <span>Purchase cost</span>
              <strong>{amount(quote.cost)}</strong>
              <small>LGC</small>
            </div>
            <dl className="kk-confirm-wallet">
              <div>
                <dt>Base bet</dt>
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
                Preview only · No bet is placed.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div
              className="kk-ante-feature"
              data-active={ante ? "true" : undefined}
            >
              <img src="/kilo-contraband-v1/scatter-king.png" alt="" />
              <div className="kk-ante-copy">
                <span className="kk-feature-kind">Spin feature</span>
                <h2>Ante bet</h2>
                <p>1.5× · {amount(splashCost(stake, "ante"))} LGC / spin</p>
              </div>
              <button
                type="button"
                className="kk-ante-action"
                aria-pressed={ante}
                aria-label={ante ? "Deactivate ante bet" : "Activate ante bet"}
                disabled={locked}
                onClick={() => onAnte(!ante)}
              >
                {ante ? "Deactivate" : "Activate"}
              </button>
            </div>
            <div
              className="kk-feature-gallery"
              ref={gallery}
              aria-label="Bonus features"
              onScroll={() => {
                const root = gallery.current;
                if (!root || root.scrollWidth <= root.clientWidth + 1) return;
                const first = root.children[0] as HTMLElement;
                const next = root.children[1] as HTMLElement;
                const step = next.offsetLeft - first.offsetLeft;
                if (step > 0)
                  setActive(
                    Math.min(
                      FEATURES.length - 1,
                      Math.max(0, Math.round(root.scrollLeft / step)),
                    ),
                  );
              }}
            >
              {FEATURES.map((feature) => {
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
                  >
                    <div className="kk-feature-card-head">
                      <span className="kk-feature-kind">
                        {feature.kind === "purchase"
                          ? "Bonus buy"
                          : feature.kind === "trigger"
                            ? "Scatter bonus"
                            : "Art preview"}
                      </span>
                      <h2>{feature.title}</h2>
                    </div>
                    <div className="kk-feature-illustration">
                      <img
                        src={feature.art}
                        alt=""
                        width="1536"
                        height="1024"
                        decoding="async"
                      />
                    </div>
                    <div className="kk-feature-card-copy">
                      <div className="kk-feature-reward">
                        {feature.kind === "preview" ? (
                          <span>In development</span>
                        ) : (
                          <>
                            <b>{feature.spins} free spins</b>
                            <span>Starts at ×{feature.multiplier}</span>
                          </>
                        )}
                      </div>
                      <div className="kk-feature-offer">
                        {q ? (
                          <>
                            <b>
                              {amount(q.cost)} <small>LGC</small>
                            </b>
                            <span>
                              {feature.kind === "purchase"
                                ? feature.multiple
                                : ""}
                              × base bet
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
                            <span>Artwork & design</span>
                          </>
                        )}
                      </div>
                      {q?.reason && (
                        <p className="kk-unavailable" role="status">
                          {q.reason}
                        </p>
                      )}
                      <button
                        type="button"
                        className={
                          q
                            ? "kk-feature-action is-purchase"
                            : "kk-feature-action"
                        }
                        aria-label={
                          q
                            ? `Review ${feature.title} purchase for ${amount(q.cost)} LGC`
                            : `Preview ${feature.title}`
                        }
                        disabled={!!q && (locked || !q.allowed)}
                        onClick={() => select(feature)}
                      >
                        {q ? "Buy feature" : "View preview"}
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <nav className="kk-feature-pager" aria-label="Browse bonuses">
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
                  {FEATURES.map((feature, i) => (
                    <span
                      key={feature.id}
                      data-active={i === active ? "true" : undefined}
                    />
                  ))}
                </div>
                <span aria-live="polite">
                  {active + 1} / {FEATURES.length}
                </span>
              </div>
              <button
                type="button"
                className="kk-icon-button"
                aria-label="Next bonus"
                disabled={active === FEATURES.length - 1}
                onClick={() => showCard(active + 1)}
              >
                <ChevronRight size={20} />
              </button>
            </nav>
            <div className="kk-feature-toolbar">
              <div className="kk-feature-balance">
                <span>Balance</span>
                <b>
                  {amount(bank)} <small>LGC</small>
                </b>
              </div>
              <div
                className="kk-feature-bet-control"
                aria-label="Feature base bet"
              >
                <button
                  type="button"
                  className="kk-icon-button"
                  aria-label="Decrease feature base bet"
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
                  <span>Base bet</span>
                  <b>
                    {amount(stake)} <small>LGC</small>
                  </b>
                </button>
                <button
                  type="button"
                  className="kk-icon-button"
                  aria-label="Increase feature base bet"
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
            <p className="kk-gallery-note">
              Purchases require confirmation. Preview cards place no bet.
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
              Buy · {amount(quote.cost)} LGC
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function SettingsPanel({
  preferences,
  onChange,
  locked,
  mute,
  onMute,
  audioAvailable,
  musicVolume,
  effectsVolume,
  onVolume,
  onRules,
  onClose,
}: {
  preferences: GamePreferences;
  onChange: (p: GamePreferences) => void;
  locked: boolean;
  mute: boolean;
  onMute: () => void;
  audioAvailable: boolean;
  musicVolume: number;
  effectsVolume: number;
  onVolume: (music: number, effects: number) => void;
  onRules: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <PanelHeader title="Settings" onClose={onClose} />
      <div className="kk-dialog-body kk-settings-body">
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
                aria-pressed={preferences.speed === value}
                onClick={() => onChange({ ...preferences, speed: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="kk-setting-hint">
            {locked
              ? "Available after this round."
              : "Faster reels. Feature results remain readable."}
          </p>
        </fieldset>
        <section className="kk-audio-settings">
          <div className="kk-setting-heading">
            <h2>Sound</h2>
            <button
              type="button"
              className="kk-icon-button"
              aria-label={mute ? "Unmute sound" : "Mute sound"}
              aria-pressed={mute}
              disabled={!audioAvailable}
              onClick={onMute}
            >
              {mute ? <VolumeX size={21} /> : <Volume2 size={21} />}
            </button>
          </div>
          {!audioAvailable && (
            <p className="kk-setting-hint" role="status">
              Sound unavailable
            </p>
          )}
          <label className="kk-volume">
            <span>Music</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={musicVolume}
              disabled={!audioAvailable || mute}
              onChange={(e) => onVolume(Number(e.target.value), effectsVolume)}
            />
            <output>{musicVolume}%</output>
          </label>
          <label className="kk-volume">
            <span>Effects</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={effectsVolume}
              disabled={!audioAvailable || mute}
              onChange={(e) => onVolume(musicVolume, Number(e.target.value))}
            />
            <output>{effectsVolume}%</output>
          </label>
        </section>
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
          <span>Rules & paytable</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </>
  );
}
