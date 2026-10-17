# Kilo King — marina scene v14

Created with the built-in image-generation tool from the existing Kilo King marina artwork. These are integrated runtime assets, not mockup screenshots. The existing character, logo, cargo and symbol artwork are retained.

- `marina-night.webp`: above-water marina background, 1672 × 941. Animated water is a runtime Canvas2D layer; the image itself is static.
- `pier-foreground.webp`: transparent shared timber foreground, 2172 × 724. Original alpha is preserved. Its position is tied to the game cabinet, so the fisherman and cargo share a standing surface.

Original generated PNGs were encoded to WebP for delivery without rescaling or compositing. The earlier artwork remains untouched.

## Background prompt

Use case: stylized-concept. Asset type: production background plate for the Kilo King illustrated slot game, wide 16:9 landscape.
Input image 1 is the existing marina environment style reference and edit target. Retain the same richly illustrated glossy game-art finish, tropical night marina, navy sky, teal water, warm amber lamps and restrained magenta highlights. Change the CAMERA and spatial composition: entirely ABOVE WATER, standing on a marina looking across the harbor. No underwater cross section, no seabed, no bubbles or submerged rocks.
A low distant shoreline with silhouetted palms at upper third; marina warehouses, moored speedboats and wooden pilings frame far left and far right, lamps at the edges. Center 65% intentionally quieter, dark and low contrast for a large game cabinet to be composited later. Foreground is calm dark surface water with subtle horizontal reflections, never an underwater viewpoint. Moon above and to right, coherent warm light from left and cool teal light from right. Strong atmosphere and depth but restrained small detail, premium polished game background.
Do not add the character, logo, slot reels, symbols, typography, interface, foreground platform, or buttons. This is an environment asset, not a screenshot or concept board. Edge-to-edge image.

## Foreground prompt

Use case: stylized-concept. Asset type: transparent foreground dock layer for the Kilo King illustrated marina game.
Input image is a lighting and art-style reference only. Create ONE wide wooden marina pier platform viewed from just above its front edge, straight-on level camera, shallow perspective. Wide landscape approximately 3:1. The platform runs continuously across the entire image, left edge to right edge. Broad weathered dark walnut planks with restrained glossy wet grain, navy shadows, small muted brass fasteners, warm amber edge light at left and faint teal edge light at right. Rear edge nearly horizontal at 16% of image height, top walking surface from 16% to 75%, thick darker front fascia from 75% to 98%. The central deck should be dark and calm. Enough clean surface for an adult character to stand at far right and cargo at far left, these will be separate sprites.
Style: polished richly illustrated game artwork matching the reference, tangible thick timber construction, strong material read at small screen sizes. No photoreal mismatch.
Genuinely transparent background above and outside the wooden platform. No water, environment, sky, characters, cargo, signs, text, rope piles, lamps, posts, reels, symbols or interface. No drop shadow painted outside the platform. Do not make a floating isolated island or show perspective receding at the left/right ends; planks continue seamlessly off both lateral edges.

