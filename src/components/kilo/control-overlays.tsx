import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  Check,
  Info,
  Repeat,
  Music2,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { PanelDismissContext } from "./control-panels";
import { AUTO_COUNTS } from "./auto-spins";
import { QUICK_MENU, quickMenuLayout } from "./control-overlays-layout";
import "./control-overlays.css";

const amount = (n: number) => Math.round(n).toLocaleString("en-US");

export function AutoSpinsPanel({
  count,
  cost,
  disabled,
  disabledReason,
  onCount,
  onStart,
  onClose,
}: {
  count: number;
  cost: number;
  disabled: boolean;
  disabledReason?: string;
  onCount: (count: number) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const dismiss = useContext(PanelDismissContext) ?? onClose;
  return (
    <>
      <button
        type="button"
        className="kk-auto-close"
        aria-label="Close auto spins"
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </button>
      <div className="kk-autoplay-card">
        <section className="kk-auto-rounds">
          <h2 id="kk-auto-rounds-title">Number of rounds</h2>
          <div
            className="kk-auto-count-grid"
            role="group"
            aria-labelledby="kk-auto-rounds-title"
          >
            {AUTO_COUNTS.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={count === value}
                onClick={() => onCount(value)}
              >
                {value}
                {count === value && <Check aria-hidden="true" />}
              </button>
            ))}
          </div>
        </section>
        <div className="kk-auto-stop-policy">
          <span>Stop on bonus</span>
          <div
            className="kk-auto-stop-status"
            aria-label="Stop on bonus is always on"
          >
            <span>
              <Check aria-hidden="true" /> On
            </span>
          </div>
        </div>
        <footer className="kk-auto-start-area">
          {disabledReason && (
            <p
              className="kk-auto-unavailable"
              role="status"
              id="kk-auto-disabled-reason"
            >
              {disabledReason}
            </p>
          )}
          <button
            type="button"
            className="kk-auto-start"
            disabled={disabled}
            aria-describedby={`kk-auto-cost${disabledReason ? " kk-auto-disabled-reason" : ""}`}
            aria-label={`Start ${count} auto spins`}
            onClick={onStart}
          >
            Start autoplay
          </button>
          <p className="kk-auto-cost" id="kk-auto-cost">
            <strong>{amount(cost)}</strong> per spin · Stop anytime
          </p>
        </footer>
      </div>
    </>
  );
}

type AudioChannel = "music" | "effects";
type QuickSettingsContentProps = {
  audioAvailable: boolean;
  musicVolume: number;
  effectsVolume: number;
  onVolume: (music: number, effects: number) => void;
  onInfo: () => void;
  onResetBalance?: () => void;
  resetBalanceDisabled?: boolean;
  /** Short layouts fold Auto spins out of the dock; this row opens the same
   * Auto spins confirmation panel. Absent when the dock shows the button. */
  onAuto?: () => void;
  autoDisabled?: boolean;
  autoTitle?: string;
  onClose: () => void;
};

export function QuickSettings({
  anchorRef,
  anchorKey,
  audioAvailable,
  musicVolume,
  effectsVolume,
  onVolume,
  onInfo,
  onClose,
  onResetBalance,
  resetBalanceDisabled,
  onAuto,
  autoDisabled,
  autoTitle,
}: QuickSettingsContentProps & {
  anchorRef: RefObject<HTMLButtonElement | null>;
  anchorKey: string;
}) {
  const [expanded, setExpanded] = useState<AudioChannel | null>(null);
  const [placement, setPlacement] = useState<ReturnType<
    typeof quickMenuLayout
  > | null>(null);
  const positioned = placement !== null;
  const root = useRef<HTMLDivElement>(null);
  const expandedRef = useRef(expanded);
  const closeRef = useRef(onClose);
  expandedRef.current = expanded;
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const controls = anchor.closest(".sc-system");
    const update = () => {
      const a = anchor.getBoundingClientRect(),
        v = window.visualViewport;
      // Clear the actual wells, rims and badges, not just the smaller Menu
      // target. Landscape controls occupy two rails, so keep individual boxes.
      const avoid = controls
        ? [
            ...controls.querySelectorAll<HTMLElement>(
              "[data-module], [data-control], .sc-step, .sc-badge, .sc-action-plate",
            ),
          ]
            .map((node) => {
              const r = node.getBoundingClientRect();
              return { x: r.left, y: r.top, width: r.width, height: r.height };
            })
            .filter((r) => r.width > 0 && r.height > 0)
        : [];
      setPlacement(
        quickMenuLayout(
          {
            x: v?.offsetLeft ?? 0,
            y: v?.offsetTop ?? 0,
            width: v?.width ?? window.innerWidth,
            height: v?.height ?? window.innerHeight,
          },
          { x: a.left, y: a.top, width: a.width, height: a.height },
          !!expanded,
          avoid,
          (onResetBalance ? 1 : 0) + (onAuto ? 1 : 0),
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    if (controls) observer.observe(controls);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchorRef, anchorKey, expanded, onResetBalance, !!onAuto]);
  useEffect(() => {
    const panel = root.current,
      anchor = anchorRef.current;
    if (!panel || !positioned) return;
    const targets = () =>
      [...panel.querySelectorAll<HTMLElement>("button, input")].filter(
        (n) => !n.matches(":disabled"),
      );
    // Put initial focus on the dialog, avoiding a large highlighted Info row
    // on pointer opening. Tab still enters the first control normally.
    panel.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      // A feature summary can arrive while this menu is open. Let the new
      // foreground dialog own dismissal and focus until it has closed.
      if (
        document
          .querySelector(".kk-modal-root.is-blocking")
          ?.contains(document.activeElement)
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (expandedRef.current) {
          panel
            .querySelector<HTMLButtonElement>(
              `[data-channel="${expandedRef.current}"]`,
            )
            ?.focus();
          setExpanded(null);
        } else closeRef.current();
      } else if (event.key === "Tab") {
        const list = targets(),
          first = list[0],
          last = list.at(-1);
        if (document.activeElement === panel) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (!panel.contains(document.activeElement)) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      queueMicrotask(() => {
        if (
          !document.querySelector(".kk-modal-root.is-blocking, .kk-quick-root")
        )
          anchor?.focus({ preventScroll: true });
      });
    };
  }, [anchorRef, positioned]);
  return (
    <QuickSettingsView
      rootRef={root}
      placement={placement}
      expanded={expanded}
      onExpand={setExpanded}
      audioAvailable={audioAvailable}
      musicVolume={musicVolume}
      effectsVolume={effectsVolume}
      onVolume={onVolume}
      onInfo={onInfo}
      onClose={onClose}
      onResetBalance={onResetBalance}
      resetBalanceDisabled={resetBalanceDisabled}
      onAuto={onAuto}
      autoDisabled={autoDisabled}
      autoTitle={autoTitle}
    />
  );
}

/** Pure view shared by the live popup and source-level responsive verification. */
export function QuickSettingsView({
  rootRef,
  placement,
  expanded,
  onExpand,
  audioAvailable,
  musicVolume,
  effectsVolume,
  onVolume,
  onInfo,
  onClose,
  onResetBalance,
  resetBalanceDisabled,
  onAuto,
  autoDisabled,
  autoTitle,
}: QuickSettingsContentProps & {
  rootRef?: RefObject<HTMLDivElement | null>;
  placement: ReturnType<typeof quickMenuLayout> | null;
  expanded: AudioChannel | null;
  onExpand: (channel: AudioChannel | null) => void;
}) {
  const style = {
    left: placement?.x ?? 0,
    top: placement?.y ?? 0,
    width: placement?.width ?? QUICK_MENU.width,
    maxHeight: placement?.height,
    visibility: placement ? "visible" : "hidden",
    transformOrigin: placement?.origin,
    "--quick-row": `${QUICK_MENU.row}px`,
    "--quick-padding": `${QUICK_MENU.padding}px`,
    "--quick-slider-height": `${QUICK_MENU.sliderHeight}px`,
    "--quick-flyout-width": `${QUICK_MENU.flyoutWidth}px`,
    "--quick-flyout-offset": `${QUICK_MENU.gap + QUICK_MENU.padding + QUICK_MENU.border}px`,
  } as CSSProperties;
  return (
    <div className="kk-quick-root">
      <div className="kk-quick-dismiss" aria-hidden="true" onClick={onClose} />
      <div
        ref={rootRef}
        id="kilo-quick-settings"
        className="kk-quick-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Game menu"
        tabIndex={-1}
        style={style}
        data-inline={placement?.inline ?? true}
        data-side={placement?.side ?? "right"}
        data-scroll={placement?.scroll ?? false}
      >
        <button type="button" className="kk-quick-row" onClick={onInfo}>
          <Info aria-hidden="true" />
          <span>Info</span>
        </button>
        {onAuto && (
          <button
            type="button"
            className="kk-quick-row"
            data-testid="quick-auto-spins"
            aria-label="Auto spins: choose a finite count"
            disabled={autoDisabled}
            title={autoTitle}
            onClick={onAuto}
          >
            <Repeat aria-hidden="true" />
            <span>Auto spins</span>
          </button>
        )}
        {(
          [
            ["music", "Music"],
            ["effects", "Sound"],
          ] as const
        ).map(([channel, label]) => {
          const open = expanded === channel,
            level = channel === "music" ? musicVolume : effectsVolume;
          return (
            <div className="kk-quick-audio-row" key={channel}>
              <button
                type="button"
                className="kk-quick-row"
                data-channel={channel}
                aria-expanded={open}
                aria-controls={`kk-volume-${channel}`}
                aria-disabled={!audioAvailable || undefined}
                aria-label={
                  !audioAvailable
                    ? `${label}. Audio files did not load`
                    : undefined
                }
                title={
                  !audioAvailable
                    ? "Audio files did not load"
                    : `${label} volume: ${level}%`
                }
                onClick={() => {
                  if (audioAvailable) onExpand(open ? null : channel);
                }}
              >
                {open ? (
                  <X aria-hidden="true" />
                ) : channel === "music" ? (
                  <Music2 aria-hidden="true" />
                ) : level === 0 || !audioAvailable ? (
                  <VolumeX aria-hidden="true" />
                ) : (
                  <Volume2 aria-hidden="true" />
                )}
                <span>{label}</span>
              </button>
              {open && (
                <div id={`kk-volume-${channel}`} className="kk-quick-volume">
                  <label className="kk-quick-range">
                    <span className="kk-visually-hidden">{label} volume</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      disabled={!audioAvailable}
                      value={level}
                      aria-valuetext={`${level}%`}
                      style={{ "--volume-fill": `${level}%` } as CSSProperties}
                      onChange={(event) =>
                        onVolume(
                          channel === "music"
                            ? Number(event.target.value)
                            : musicVolume,
                          channel === "effects"
                            ? Number(event.target.value)
                            : effectsVolume,
                        )
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
        {onResetBalance && (
          <button
            type="button"
            className="kk-quick-row kk-quick-reset"
            data-testid="reset-preview-balance"
            disabled={resetBalanceDisabled}
            onClick={onResetBalance}
            title={
              resetBalanceDisabled
                ? "Finish the current round or autoplay first"
                : "Restore the local preview balance to 500,000"
            }
          >
            <RotateCcw aria-hidden="true" />
            <span>
              Reset balance<small>500,000 · Preview</small>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
