# Kilo King feature illustrations — v12

Six original production illustrations generated with OpenAI imagegen on 2026-10-16 for this project. Each was generated independently, reviewed as an image, and encoded to WebP at quality 88 without compositing, cropping, resizing or painted edits. All are 1536 × 1024. No text, price, button or UI is baked into the art; those remain responsive DOM text.

Art direction: polished stylized 3D-painted night marina; navy/black materials, warm brass/gold fittings, wet decking, yachts and palms. Large readable silhouettes, restrained environmental detail. Cargo bundles and the existing fisherman preserve the game's identity. No provider artwork was copied.

| File           | Identity             | Generation brief / reference                                                                                                                                                                                                              |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scatter-3.webp | Teal stash case      | Open midnight-blue/gold hard case of ivory wrapped cargo, teal internal glow, wet dock. Based on the approved Kilo King visual concept.                                                                                                   |
| scatter-4.webp | Amber cargo haul     | Stacked reinforced cases, open amber-lit cargo, bronze hardware and anchor seals. Uses the 3-scatter illustration as style reference.                                                                                                     |
| scatter-5.webp | Crimson crown vault  | Black/gold open vault with crown crest and red internal light. Uses the 3-scatter illustration as style reference.                                                                                                                        |
| chopper.webp   | Cyan/copper airlift  | Black/gold helicopter lifting a wrapped cargo bundle over the marina. Uses the 3-scatter illustration as style reference.                                                                                                                 |
| mystery.webp   | Violet sealed case   | Sealed charcoal case with a crown badge, violet seam light and smoke. No implied awards or mechanics. Uses the 3-scatter illustration as style reference.                                                                                 |
| god-mode.webp  | Gold/white fisherman | Existing bearded fisherman, knit cap, orange jacket and crown pendant with gold crown halo and cyan lightning. Uses public/kilo-ui-v11/hero-bust.webp as the character reference and the 3-scatter illustration as environment reference. |

## Integration

`feature-catalog.ts` defines availability independently of artwork. Only the existing `buy` and `chopper` modes may start purchases. 4/5 scatters describe existing natural triggers. Mystery and God Mode are design previews only. The compact Features cards use contained illustration wells with a CSS mask to soften environmental edges; the source images have not been cropped or repainted. Purchase confirmation uses a small art well and live cost text. `BonusArtwork` provides the larger entry-style composition for non-purchasable previews. Existing in-round entry and win animations are not replaced by these images yet.

No new price, multiplier, probability, payout or bonus gameplay is specified by these assets.
