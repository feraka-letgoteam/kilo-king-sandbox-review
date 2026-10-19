import { MAX_RIG_URLS } from './max-boat-performance';
import { MAX_BOAT_URL } from './max-spin-motion';
import { useEffect, useRef } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { IntegratedBackdrop } from "./IntegratedScene";
import { AuthoredArt } from './AuthoredArt';
import { preloadAuthoredArt } from './preload-authored-art';
import { KILO_BRAND } from './brand-layout';
import { CHARACTER_RIG_URLS } from './character-rig-model';
import { FEATURE_ART_URLS } from './feature-presentation';
import { VS_ART_URLS } from './vs-art';
import { STAGE_KING_URLS } from './stage-character-life';
import { V79_ENTRY_ART } from './authored-surface-clips';
import { ImpactPrint } from './ImpactPrint';
import "./scene-screens.css";

const amount = (value: number) => Math.round(value).toLocaleString("en-US");

export const SCENE_SCREEN_ARTWORK = [
  KILO_BRAND.wide,
  KILO_BRAND.stacked,
  ...CHARACTER_RIG_URLS,
  ...FEATURE_ART_URLS,
  ...VS_ART_URLS,
  MAX_BOAT_URL, ...MAX_RIG_URLS,
  "/kilo-v59/environment/getaway-desktop.webp",
  "/kilo-v59/environment/getaway-portrait.webp",
  ...STAGE_KING_URLS,
  ...Object.values(V79_ENTRY_ART),
] as const;
let screenArtworkReady: Promise<void> | null = null;

/** Decode branding and playable feature crests before the host unlocks Enter. A failure
 * clears the cache so the existing Retry action starts a real fresh request. */
export function preloadSceneScreenArtwork(): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  preloadAuthoredArt();
  screenArtworkReady ??= Promise.all(
    SCENE_SCREEN_ARTWORK.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const artwork = new Image();
          let finished = false;
          const finish = (error?: Error) => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timer);
            artwork.onload = null;
            artwork.onerror = null;
            if (error) reject(error);
            else resolve();
          };
          const timer = window.setTimeout(
            () => finish(new Error(`Artwork preparation timed out: ${url}`)),
            15_000,
          );
          artwork.decoding = "async";
          artwork.onload = () => {
            void artwork.decode().then(
              () => finish(),
              () => finish(new Error(`Unable to decode artwork: ${url}`)),
            );
          };
          artwork.onerror = () =>
            finish(new Error(`Unable to load artwork: ${url}`));
          artwork.src = url;
        }),
    ),
  )
    .then(() => undefined)
    .catch((error: unknown) => {
      screenArtworkReady = null;
      throw error;
    });
  return screenArtworkReady;
}

export type LoadingScreenProps = {
  ready: boolean;
  artReady: boolean;
  error: string;
  onRetry: () => void;
  onEnter: () => void;
  reducedMotion: boolean;
};

/** Readiness comes from the host's existing asset and reel gates. This screen
 * cannot start, charge, or settle a round. The two progress steps are real gates. */
export function LoadingScreen({
  ready,
  artReady,
  error,
  onRetry,
  onEnter,
  reducedMotion,
}: LoadingScreenProps) {
  const enter = useRef<HTMLButtonElement>(null);
  const unlocked = ready && artReady && !error;
  const progress = (artReady ? 1 : 0) + (ready ? 1 : 0);
  const status =
    error ||
    (!artReady
      ? "Preparing Miami"
      : !ready
        ? "Preparing the reels"
        : "Ready to enter");
  useEffect(() => {
    if (unlocked) enter.current?.focus({ preventScroll: true });
  }, [unlocked]);
  return (
    <section
      className="ks-loading"
      role="dialog"
      aria-modal="true"
      aria-label="Kilo King loading"
      data-reduced={reducedMotion}
    >
      <IntegratedBackdrop
        scene="loading"
        phase="loading"
        reducedMotion={reducedMotion}
      />
      <div className="ks-loading-shade" aria-hidden="true" />
      <div className="ks-loading-content">
        <div className="ks-loading-brand">
          <p className="ks-eyebrow">Miami after dark</p>
          <img
            className="ks-loading-logo"
            src={KILO_BRAND.wide}
            alt="Kilo King"
            fetchPriority="high"
          />
          <p className="ks-loading-tagline">The king of the waterfront.</p>
        </div>
        <div className="ks-loading-gate">
          <p className="ks-loading-status" role={error ? "alert" : "status"}>
            {status}
          </p>
          <div
            className="ks-loading-track"
            role="progressbar"
            aria-label="Game readiness"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={error ? 0 : progress}
            aria-valuetext={status}
          >
            <span data-complete={!error && artReady} />
            <span data-complete={!error && ready} />
          </div>
          {error ? (
            <button type="button" className="ks-primary" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              Retry loading
            </button>
          ) : (
            <button
              ref={enter}
              type="button"
              className="ks-primary"
              disabled={!unlocked}
              onClick={() => {
                if (unlocked) onEnter();
              }}
            >
              {unlocked ? "Enter" : "Loading"}
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export type CompletionScreenContentProps = {
  payout: number;
  purchaseCost: number | null;
  celebrate: boolean;
  bonusName: string;
  onContinue: () => void;
  reducedMotion: boolean;
};

/** Amounts are already final host values. No animated counter or delayed credit
 * can disagree with settlement. A purchased return is never labelled profit. */
export function CompletionScreenContent({
  payout,
  purchaseCost,
  celebrate,
  bonusName,
  onContinue,
  reducedMotion,
}: CompletionScreenContentProps) {
  return (
    <div
      className="ks-completion"
      data-celebrate={celebrate}
      data-reduced={reducedMotion}
    >
      <IntegratedBackdrop
        scene="completion"
        phase="complete"
        reducedMotion={reducedMotion}
        paused={!celebrate}
      />
      <div className="ks-completion-shade" aria-hidden="true" />
      <div className="ks-completion-content">
        <img
          className="ks-completion-logo"
          src={KILO_BRAND.wide}
          alt="Kilo King"
        />
        <p className="ks-eyebrow">{bonusName}</p>
        <h1>Bonus complete</h1>
        <AuthoredArt
          className="ks-completion-case"
          clipKey="completion"
          fallback="/kilo-v79/surfaces/completion.webp"
          duration={640}
          reduced={reducedMotion}
          active={celebrate}
        />
        <div className="ks-completion-award">
          {celebrate&&<ImpactPrint/>}
          <span>Total return</span>
          <strong data-testid="summary-return">{amount(payout)}</strong>
        </div>
        {purchaseCost !== null && (
          <p className="ks-completion-cost" data-testid="summary-cost">
            Purchase cost <b>{amount(purchaseCost)}</b>
          </p>
        )}
        <button
          type="button"
          className="ks-primary"
          data-testid="continue-feature"
          onClick={onContinue}
        >
          Continue
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
