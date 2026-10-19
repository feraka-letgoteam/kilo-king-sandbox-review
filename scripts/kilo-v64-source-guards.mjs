import assert from 'node:assert/strict';

/** Allow-list only the explicit background routing/preload/prop edits. Undo
 * them for historical whole-file payment/UI guards; everything else must
 * still compare byte-for-byte with the checkpoint. New routing has its own
 * executable v64 tests (not the historical forced-base expectation). */
export function withoutV64BackgroundRouting(source) {
  if (!source.includes("import { environmentForPresentation, isFeatureEnvironment }")) return source;
  const edits = [
    ["import { environmentForPresentation, isFeatureEnvironment } from './feature-environments';\n", ''],
    ["  const environmentId: SceneId = environmentForPresentation({ round: visualRound, maxSpinMode,\n    active: !!hud?.active, summary: !!summary, busy, reviewing });\n  const featureBackground = isFeatureEnvironment(environmentId) && environmentId !== 'max-win' ? environmentId : undefined;",
      `  const environmentId: SceneId = maxSpinMode || ((busy || reviewing) && visualRound && isMaxSpinRound(visualRound)) ? 'max-win' : reelFeature ? 'base' : summary
    ? "completion"
    : hud?.active
      ? sceneForRound(visualRound)
      : "base";`],
    ['    // Decode dedicated destinations before entry. The base actor/camera stays\n    // mounted while a feature background is shown behind it.',
      '    // V4 advanced features stay on the base board. Only the unchanged\n    // Dockside flow needs a separate destination and completion backdrop.'],
    ['          "scatter-3",\n          "scatter-4",\n          "chopper",\n          "max-win",\n          "completion",', '          "scatter-3",\n          "completion",'],
    ["const sceneReady = preloadIntegratedScene(isMaxSpinRound(script) ? 'max-win' : sceneForRound(script), {",
      "const sceneReady = preloadIntegratedScene(isMaxSpinRound(script) ? 'max-win' : script.version === 4 ? 'base' : sceneForRound(script), {"],
    ["            scene={featureBackground ? 'base' : environmentId}\n            backgroundScene={featureBackground}", '            scene={environmentId}'],
  ];
  for (const [before, after] of edits) {
    assert.equal(source.split(before).length, 2, 'Only one known presentation edit: ' + before.slice(0,90));
    source = source.replace(before, after);
  }
  return source;
}
