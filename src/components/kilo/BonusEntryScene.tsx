import { FEATURE_NAMES } from '@/lib/kilo/feature-math';
import {
  collectMult,
  type SplashMod,
  type SplashScript,
} from "@/lib/kilo/engine";
import { IntegratedBackdrop } from "./IntegratedScene";
import { SCENES, type SceneId } from "./scene-system";
import "./scene-entry.css";
import { AuthoredArt } from "./AuthoredArt";
import { V79_ENTRY_ART } from './authored-surface-clips';

/** Keep the recorded modifier vocabulary identical to the existing Pixi intro. */
export const ENTRY_MODIFIER_NAMES: Record<SplashMod, string> = {
  moreFish: "More packages",
  moreWilds: "More fishermen",
  moreTools: "More tools",
  extraSpins: "+2 spins",
  level2: "Starts one level higher",
};

export type BonusEntrySceneProps = {
  scene: SceneId;
  round: SplashScript;
  reducedMotion: boolean;
  /** Turbo, super turbo and Skip reveal all copy immediately. */
  immediate?: boolean;
};

/** The host mounts this takeover only during its existing intro phase. It has
 * no input interception, promises, timers, award changes or phase callbacks. */
export function BonusEntryScene({
  scene,
  round,
  reducedMotion,
  immediate = false,
}: BonusEntrySceneProps) {
  const modifiers = round.mods
    .map((mod) => ENTRY_MODIFIER_NAMES[mod])
    .join(" · ");
  return (
    <section
      className="ks-bonus-entry"
      data-scene={scene}
      data-reduced={reducedMotion}
      data-immediate={immediate}
      role="status"
      aria-label="Bonus entry"
      data-testid="bonus-entry-scene"
    >
      <IntegratedBackdrop
        scene={scene}
        phase="entry"
        reducedMotion={reducedMotion}
      />
      <div className="ks-entry-shade" aria-hidden="true" />
      <div className="ks-entry-copy">
        <p className="ks-entry-destination">{round.feature?FEATURE_NAMES[round.feature]:SCENES[scene].title}</p>
        <div className="ks-entry-hero">
          <AuthoredArt
            className="ks-entry-art"
            fallback={V79_ENTRY_ART[scene] ?? V79_ENTRY_ART['scatter-3']}
            clipKey={`entry-${scene}`}
            reduced={reducedMotion || immediate}
            duration={700}
          />
          <div className="ks-entry-award">
            <strong data-testid="entry-spins">{round.feature==='getaway'?(round.version===4?1:3):round.awarded}</strong>
          </div>
        </div>
        <h2 className="ks-entry-heading">{round.feature==='getaway'?(round.version===4?'Max win or nothing':'Cases · three checkpoints'):'Free spins'}</h2>
        {round.version===3&&round.feature&&round.feature!=='dock'?<p className="ks-entry-modifiers">{({yacht:"Lock cargo · dispatch shipments · improve the next load",yacht25:"Reel one starts with a winning ×25 VS",route:"Follow the pickup column · build ×5 delivery routes",getaway:"Double the cases · reveal your extraction multiplier"} as const)[round.feature]}</p>:<p className="ks-entry-multiplier">
          <span>{round.feature==='yacht25'?'Reel 1 · first spin':'Starting multiplier'}</span>
          <strong data-testid="entry-multiplier">
            ×{round.feature==='yacht25'?25:collectMult(round.banked)}
          </strong>
        </p>}
        {modifiers && (
          <p className="ks-entry-modifiers" data-testid="entry-modifiers">
            {modifiers}
          </p>
        )}
      </div>
    </section>
  );
}
