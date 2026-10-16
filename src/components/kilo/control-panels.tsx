import { useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { splashCost, type SplashMode } from "@/lib/kilo/engine";
import { STAKES, purchaseQuote, type GamePreferences } from "./control-model";

const amount = (n: number) => Math.round(n).toLocaleString("en-US");
export const FEATURES = [
  {
    id: "buy" as const,
    title: "Free spins",
    detail: "10 free spins · Starts at ×1",
    times: "100× base bet",
    art: "/kilo-ui-v11/feature-stash.webp",
  },
  {
    id: "chopper" as const,
    title: "Chopper",
    detail: "10 free spins · Starts at ×2",
    times: "250× base bet",
    art: "/kilo-ui-v11/feature-chopper.webp",
  },
];

export function PanelHeader({
  title,
  onClose,
  onBack,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
}) {
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
        onClick={onClose}
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
          <output aria-live="polite">{amount(draft)}</output>
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

export function FeaturesPanel({
  stake,
  bank,
  ante,
  locked,
  onAnte,
  onEditBet,
  onBuy,
  onClose,
}: {
  stake: number;
  bank: number;
  ante: boolean;
  locked: boolean;
  onAnte: (on: boolean) => void;
  onEditBet: () => void;
  onBuy: (mode: SplashMode) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<(typeof FEATURES)[number] | null>(null);
  const submitted = useRef(false);
  const quote = choice ? purchaseQuote(stake, choice.id, bank) : null;
  return (
    <>
      <PanelHeader
        title={choice ? "Confirm purchase" : "Features"}
        onClose={onClose}
        onBack={choice ? () => setChoice(null) : undefined}
      />
      <div className="kk-dialog-body kk-features-body">
        {choice && quote ? (
          <div
            className="kk-purchase-confirm"
            data-testid="purchase-confirmation"
          >
            <div className="kk-confirm-heading">
              <div className="kk-feature-thumb">
                <img src={choice.art} alt="" />
              </div>
              <div>
                <h2>{choice.title}</h2>
                <p>{choice.detail}</p>
                <span className="kk-muted">
                  The recorded modifier may increase the starting award.
                </span>
              </div>
            </div>
            <dl className="kk-purchase-terms">
              <div>
                <dt>Base bet</dt>
                <dd>{amount(stake)} LGC</dd>
              </div>
              <div>
                <dt>Purchase cost</dt>
                <dd className="kk-purchase-total">{amount(quote.cost)} LGC</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>{amount(bank)} LGC</dd>
              </div>
            </dl>
            <p className="kk-muted">
              Charged once when you confirm. This replaces one base-game spin.
            </p>
            {quote.reason && (
              <p className="kk-unavailable" role="status">
                {quote.reason}
              </p>
            )}
          </div>
        ) : (
          <>
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
              <ChevronRight size={18} />
            </button>
            <div className="kk-ante-row">
              <div>
                <h2>Ante bet</h2>
                <p>Enhanced base-game spin</p>
                <span className="kk-muted">
                  1.5× base bet · {amount(splashCost(stake, "ante"))} LGC per
                  spin
                </span>
              </div>
              <button
                type="button"
                className="kk-switch"
                role="switch"
                aria-checked={ante}
                aria-label="Ante bet"
                disabled={locked}
                onClick={() => onAnte(!ante)}
              >
                <span aria-hidden="true" />
                <b>{ante ? "On" : "Off"}</b>
              </button>
            </div>
            <div className="kk-section-label">Bonus purchases</div>
            <div className="kk-feature-list">
              {FEATURES.map((feature) => {
                const q = purchaseQuote(stake, feature.id, bank);
                return (
                  <article className="kk-feature-row" key={feature.id}>
                    <div className="kk-feature-thumb">
                      <img src={feature.art} alt="" />
                    </div>
                    <div className="kk-feature-copy">
                      <h2>{feature.title}</h2>
                      <p>{feature.detail}</p>
                      <span className="kk-muted">{feature.times}</span>
                      <b className="kk-feature-price">
                        {amount(q.cost)} <small>LGC</small>
                      </b>
                    </div>
                    <button
                      type="button"
                      className="kk-secondary"
                      aria-label={`Review ${feature.title} purchase for ${amount(q.cost)} LGC`}
                      disabled={locked || !q.allowed}
                      onClick={() => setChoice(feature)}
                    >
                      Review
                      <ChevronRight size={16} />
                    </button>
                    {q.reason && <p className="kk-unavailable">{q.reason}</p>}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      {choice && quote ? (
        <div className="kk-dialog-foot kk-confirm-actions">
          <button type="button" className="kk-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="kk-primary"
            data-testid="confirm-purchase"
            disabled={locked || !quote.allowed}
            onClick={() => {
              if (submitted.current) return;
              submitted.current = true;
              onBuy(choice.id);
            }}
          >
            Buy · {amount(quote.cost)} LGC
          </button>
        </div>
      ) : (
        <div className="kk-dialog-foot kk-panel-note">
          Bonus purchases start only after confirmation.
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
