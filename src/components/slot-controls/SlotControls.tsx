import { useId, type CSSProperties, type ReactNode, type Ref } from "react";
import {
  Zap,
  Menu,
  RefreshCw,
  SkipForward,
  Square,
  ChevronDown,
  ChevronUp,
  Gem,
  LockKeyhole,
  X,
} from "lucide-react";
import {
  controlPlacement as place,
  type ControlLayout,
  type ControlRect,
} from "./layout";
import {
  controlAvailability,
  controlThemeStyle,
  CONTROL_TOKENS,
  DEFAULT_CONTROL_THEME,
  type ControlJurisdiction,
  type ControlTheme,
} from "./tokens";
import {
  controlReadoutTextStyle,
  controlReadoutOverflows,
  controlBetInset,
} from "./typography";
import "./controls.css";

export type ControlIcons = Partial<
  Record<
    | "turbo"
    | "menu"
    | "auto"
    | "spin"
    | "skip"
    | "stop"
    | "buy"
    | "minus"
    | "plus"
    | "locked"
    | "close",
    ReactNode
  >
>;
const DEFAULT_ICONS: Required<ControlIcons> = {
  turbo: <Zap />,
  menu: <Menu />,
  auto: <RefreshCw />,
  spin: (
    <svg
      className="sc-spin-arrow"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M19.5 25.4A10 10 0 1 1 26 16"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path d="M20.5 15.5 26 22 31.5 15.5Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  skip: <SkipForward />,
  stop: <Square />,
  buy: <Gem />,
  minus: <ChevronDown />,
  plus: <ChevronUp />,
  locked: <LockKeyhole />,
  close: <X />,
};
export type SlotControlState = {
  balance: string;
  win: string;
  bet: string;
  /** Actual per-spin wager when Ante is active; supplied by the host. */
  wager?: string;
  currency: string;
  ante: boolean;
  speed: "normal" | "turbo" | "super";
  menuOpen?: boolean;
  feature?: { remaining: number; multiplier: number; label?:string };
  busy: boolean;
  autoRemaining: number;
  ready: boolean;
  locked: boolean;
  spinDisabled: boolean;
  /** Host-owned explanation; exposed accessibly without text on the Spin face. */
  spinDisabledReason?: string;
  minimumBet: boolean;
  maximumBet: boolean;
  charge: { amount: string } | { label: string };
  awardLanded?: boolean;
  reducedMotion?: boolean;
};
export type SlotControlActions = {
  menu: () => void;
  turbo: () => void;
  bet: () => void;
  minus: () => void;
  plus: () => void;
  auto: () => void;
  spin: () => void;
  buy: () => void;
};
export type SlotControlsProps = {
  layout: ControlLayout;
  state: SlotControlState;
  actions: SlotControlActions;
  theme?: ControlTheme;
  icons?: ControlIcons;
  jurisdiction?: ControlJurisdiction;
  spinRef?: Ref<HTMLButtonElement>;
  menuRef?: Ref<HTMLButtonElement>;
  menuPopupId?: string;
  /** Optional integration anchors for a host's win-flight renderer. */
  bonusAnchorClassName?: string;
};

export function SlotControls({
  layout: d,
  state: s,
  actions: a,
  theme = DEFAULT_CONTROL_THEME,
  icons,
  jurisdiction,
  spinRef,
  menuRef,
  menuPopupId,
  bonusAnchorClassName = "",
}: SlotControlsProps) {
  const chargeId = useId(),
    reasonId = useId(),
    icon = { ...DEFAULT_ICONS, ...icons };
  // Center Auto's ink in the exposed part of the joined plate. Its 44px hit
  // target stays fixed; the spacing to Spin makes that target asymmetric
  // within the visible plate on desktop, portrait and landscape.
  const autoJoined = d.actionPlate.w > 0;
  const autoInkOffset = {
    x: !autoJoined
      ? 0
      : d.actionJoin === "left"
        ? (d.actionPlate.x + d.spin.x) / 2 - (d.auto.x + d.auto.w / 2)
        : d.actionJoin === "right"
          ? (d.spin.x + d.spin.w + d.actionPlate.x + d.actionPlate.w) / 2 -
            (d.auto.x + d.auto.w / 2)
          : 0,
    y:
      autoJoined && d.actionJoin === "top"
        ? (d.actionPlate.y + d.spin.y) / 2 - (d.auto.y + d.auto.h / 2)
        : 0,
  };
  const speedName =
    s.speed === "super"
      ? "Super turbo"
      : s.speed === "turbo"
        ? "Turbo"
        : "Normal";
  function restrictionReason(
    message: string | undefined,
    id: string,
    r: ControlRect,
  ) {
    if (!message) return null;
    const width = Math.min(CONTROL_TOKENS.reasonWidth, d.width);
    return (
      <span
        className="sc-control-reason"
        id={id}
        role="tooltip"
        style={{
          width,
          left:
            Math.max(0, Math.min(r.x + r.w / 2 - width / 2, d.width - width)) -
            r.x,
          ...(r.y < 80
            ? { top: `calc(100% + ${CONTROL_TOKENS.gap}px)` }
            : { bottom: `calc(100% + ${CONTROL_TOKENS.gap}px)` }),
        }}
      >
        {message}
      </span>
    );
  }
  function circle(key: "turbo" | "menu" | "auto" | "buy", r: ControlRect) {
    const restriction =
      key === "menu"
        ? { hidden: false, disabled: false, reason: undefined }
        : controlAvailability(key, jurisdiction);
    if (
      !r.w ||
      restriction.hidden ||
      (s.feature && (key === "auto" || key === "buy"))
    )
      return null;
    const foldedSpeed =
      key === "menu" &&
      d.drawer.turbo &&
      !controlAvailability("turbo", jurisdiction).disabled;
    const label =
      key === "menu"
        ? s.menuOpen
          ? "Close game menu"
          : `Game menu: info, music and sound${foldedSpeed ? `. Spin speed: ${speedName}` : ""}`
        : key === "turbo"
          ? `Spin speed: ${speedName}. Change speed`
          : key === "buy"
            ? "Buy feature"
            : s.autoRemaining
              ? `Stop auto spins, ${s.autoRemaining} remaining`
              : "Auto spins: choose a finite count";
    const disabled =
      restriction.disabled ||
      (key === "menu"
        ? false
        : key === "auto" && s.autoRemaining
          ? false
          : s.locked || !s.ready);
    return (
      <button
        type="button"
        key={key}
        ref={key === "menu" ? menuRef : undefined}
        className={`sc-button sc-circle${key === "auto" && autoJoined ? " sc-auto-joined" : ""}`}
        data-control={key}
        data-captioned={key === "buy" || undefined}
        style={
          {
            ...place(r),
            ...(key === "auto"
              ? {
                  "--sc-auto-ink-x": `${autoInkOffset.x}px`,
                  "--sc-auto-ink-y": `${autoInkOffset.y}px`,
                }
              : {}),
          } as CSSProperties
        }
        data-focus-fallback={key === "menu" || undefined}
        aria-label={label}
        aria-expanded={key === "menu" ? !!s.menuOpen : undefined}
        aria-controls={key === "menu" ? menuPopupId : undefined}
        title={restriction.disabled ? undefined : label}
        aria-haspopup={
          key === "menu" ||
          key === "buy" ||
          (key === "auto" && !s.autoRemaining)
            ? "dialog"
            : undefined
        }
        aria-pressed={
          key === "turbo"
            ? s.speed !== "normal"
            : key === "auto"
              ? s.autoRemaining > 0
              : undefined
        }
        aria-disabled={restriction.disabled || undefined}
        aria-describedby={restriction.reason ? `${reasonId}-${key}` : undefined}
        disabled={disabled && !restriction.disabled}
        onClick={(event) => {
          if (disabled) {
            if (restriction.disabled) event.currentTarget.focus();
            return;
          }
          a[key]();
        }}
      >
        <span className="sc-icon" aria-hidden="true">
          {key === "menu" && s.menuOpen
            ? icon.close
            : key === "auto" && s.autoRemaining
              ? icon.stop
              : icon[key]}
        </span>
        {key === "auto" && !s.autoRemaining && (
          <span className="sc-auto-letter" aria-hidden="true">
            A
          </span>
        )}
        {key === "buy" && (
          <span className="sc-control-caption" aria-hidden="true">
            Buy
          </span>
        )}
        {(key === "turbo" || foldedSpeed) && !restriction.disabled && (
          <b
            className={`sc-badge${foldedSpeed ? " sc-badge-speed" : ""}`}
            data-active={s.speed !== "normal"}
            aria-hidden="true"
          >
            {foldedSpeed && <span className="sc-icon">{icon.turbo}</span>}
            {s.speed === "super" ? "3" : s.speed === "turbo" ? "2" : "1"}
          </b>
        )}
        {key === "auto" && s.autoRemaining > 0 && (
          <b className="sc-badge">{s.autoRemaining}</b>
        )}
        {restriction.disabled && (
          <span className="sc-restriction-mark" aria-hidden="true">
            {icon.locked}
          </span>
        )}
        {restrictionReason(restriction.reason, `${reasonId}-${key}`, r)}
      </button>
    );
  }
  const wideDesktop = d.variant === "desktop" && d.spin.w >= 128;
  const readoutSize = wideDesktop
    ? 24
    : d.variant === "desktop"
      ? 22
      : d.variant === "compact" || d.variant === "portrait"
        ? 18
        : 20;
  const readoutLineHeight = wideDesktop
    ? 28
    : d.variant === "desktop"
      ? 26
      : d.variant === "portrait"
        ? 21
        : 23;
  const betSize =
    d.variant === "compact" || d.variant === "portrait" || d.betButton.w < 64
      ? 18
      : d.variant === "desktop"
        ? wideDesktop
          ? 24
          : 22
        : 20;
  const betLineHeight = wideDesktop
    ? 28
    : d.variant === "desktop"
      ? 26
      : d.variant === "portrait"
        ? 21
        : 23;
  const betValue = s.wager ?? s.bet;
  const betInset = controlBetInset(betValue, d.betButton.w, betSize);
  const readoutCard = {
    x: Math.min(d.balance.x, d.win.x),
    y: Math.min(d.balance.y, d.win.y),
    w:
      Math.max(d.balance.x + d.balance.w, d.win.x + d.win.w) -
      Math.min(d.balance.x, d.win.x),
    h:
      Math.max(d.balance.y + d.balance.h, d.win.y + d.win.h) -
      Math.min(d.balance.y, d.win.y),
  };
  const well = (name: "balance" | "win", value: string, r: ControlRect) => (
    <div
      className={`sc-well sc-readout${name === "win" && s.feature ? ` ${bonusAnchorClassName}` : ""}`}
      data-module={name}
      data-landed={(name === "win" && s.awardLanded) || undefined}
      style={place(r)}
    >
      <span className="sc-label">
        {name === "balance" ? "Balance" : s.feature ? "Bonus win" : "Win"}
      </span>
      <strong
        data-testid={
          name === "balance" ? "balance" : s.feature ? "bonus-win" : "last-win"
        }
        className="sc-number"
        style={{
          ...controlReadoutTextStyle(
            value,
            r.w - 20,
            readoutSize,
            readoutLineHeight,
          ),
          width: r.w - (d.variant === "compact" ? 8 : 20),
        }}
      >
        {controlReadoutOverflows(
          value,
          r.w - (d.variant === "compact" ? 8 : 20),
          readoutSize,
        ) ? (
          <>
            <span className="sc-sr-only" aria-hidden="true">
              {value}
            </span>
            <input
              className="sc-overflow-amount"
              type="text"
              readOnly
              value={value}
              aria-label={`${name === "balance" ? "Balance" : s.feature ? "Bonus win" : "Win"}, ${s.currency}`}
              title={`${value} ${s.currency}. Full amount: use arrow keys or select the text to read across.`}
            />
          </>
        ) : (
          value
        )}
      </strong>
    </div>
  );
  const primary = s.autoRemaining ? "stop" : s.busy ? "skip" : "spin";
  const disabledReason = s.spinDisabled ? s.spinDisabledReason : undefined;
  return (
    <aside
      className="sc-system"
      data-variant={d.variant}
      data-wide={wideDesktop || undefined}
      data-feature={!!s.feature}
      data-reduced={!!s.reducedMotion}
      aria-label="Game controls"
      data-testid="control-bar"
      style={
        {
          ...controlThemeStyle(theme),
          width: d.width,
          height: d.height,
        } as CSSProperties
      }
    >
      {d.variant !== "portrait" && (
        <div role="group" aria-label="Utilities" className="sc-module-group">
          {circle("turbo", s.feature ? d.featureTurbo : d.turbo)}
          {circle("menu", s.feature ? d.featureMenu : d.menu)}
        </div>
      )}
      <div
        role="group"
        aria-label="Balance and win"
        className="sc-module-group"
      >
        <div
          className="sc-well sc-readout-card"
          data-module="readouts"
          aria-hidden="true"
          style={place(readoutCard)}
        />
        {well("balance", s.balance, d.balance)}
        {well("win", s.win, d.win)}
      </div>
      {s.feature ? (
        <div
          className="sc-well sc-feature-counter"
          data-module="free-spins"
          style={place(d.counter)}
        >
          <span className="sc-label">{s.feature.label??'Free spins'}</span>
          <strong>
            {s.feature.remaining}
            <small>left</small>
            <em>×{s.feature.multiplier}</em>
          </strong>
        </div>
      ) : (
        <div
          className="sc-well sc-bet"
          data-module="bet"
          role="group"
          aria-label="Bet controls"
          style={place(d.bet)}
        >
          <button
            type="button"
            className="sc-button sc-bet-value"
            style={{ ...place(d.betButton), paddingLeft: betInset }}
            disabled={s.locked}
            onClick={a.bet}
            aria-label={`Change base bet, ${s.bet} ${s.currency}${s.ante ? ", Ante On" : ""}`}
            aria-haspopup="dialog"
          >
            <span className="sc-label">Bet</span>
            <strong
              className="sc-number sc-bet-number"
              data-testid="bet-readout"
              title={`Base bet ${s.bet}${s.ante ? `. Ante On; per spin ${betValue}` : ""}`}
              style={{
                ...controlReadoutTextStyle(
                  betValue,
                  d.betButton.w,
                  betSize,
                  betLineHeight,
                ),
                maxWidth: d.betButton.w - betInset,
              }}
            >
              {betValue}
            </strong>
          </button>
          {(["minus", "plus"] as const).map(
            (key) =>
              d[key].w > 0 && (
                <button
                  key={key}
                  type="button"
                  className="sc-button sc-step"
                  style={place(d[key])}
                  aria-label={`${key === "minus" ? "Decrease" : "Increase"} base bet`}
                  disabled={
                    s.locked || (key === "minus" ? s.minimumBet : s.maximumBet)
                  }
                  onClick={a[key]}
                >
                  <span className="sc-icon" aria-hidden="true">
                    {icon[key]}
                  </span>
                </button>
              ),
          )}
        </div>
      )}
      <div role="group" aria-label="Play actions" className="sc-module-group">
        {!s.feature &&
          d.actionPlate.w > 0 &&
          !controlAvailability("auto", jurisdiction).hidden && (
            <div
              className="sc-well sc-action-plate"
              data-join={d.actionJoin}
              aria-hidden="true"
              style={place(d.actionPlate)}
            />
          )}
        {d.variant !== "portrait" && circle("auto", d.auto)}
        <div
          className="sc-spin-group"
          data-module="action"
          style={place(d.spin)}
        >
          <button
            type="button"
            className="sc-button sc-spin"
            ref={spinRef}
            data-testid="spin-button"
            aria-describedby={`${chargeId}${disabledReason ? ` ${reasonId}` : ""}`}
            aria-label={
              primary === "stop"
                ? "Stop auto spins"
                : primary === "skip"
                  ? "Skip animation"
                  : "Spin"
            }
            title={disabledReason}
            disabled={s.spinDisabled}
            onClick={a.spin}
          >
            <span className="sc-icon" aria-hidden="true">
              {icon[primary]}
            </span>
            <span className="sc-sr-only">{primary}</span>
          </button>
          <span id={chargeId} className="sc-sr-only" data-testid="charge-note">
            {"amount" in s.charge ? `Cost ${s.charge.amount}` : s.charge.label}
          </span>
          {disabledReason && (
            <span id={reasonId} className="sc-sr-only" role="status">
              {disabledReason}
            </span>
          )}
        </div>
        {d.variant !== "portrait" && circle("buy", d.buy)}
      </div>
      {d.variant === "portrait" && (
        <div
          role="group"
          aria-label="Secondary controls"
          className="sc-module-group"
        >
          {circle("auto", d.auto)}
          {circle("buy", d.buy)}
          {circle("turbo", s.feature ? d.featureTurbo : d.turbo)}
          {circle("menu", s.feature ? d.featureMenu : d.menu)}
        </div>
      )}
    </aside>
  );
}
