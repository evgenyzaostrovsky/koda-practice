# Glass trophy progression preview — 2026-10-09

Founder request: a mockup of achievements and progressive upgrades matching transparent glass with green edging in the supplied ivory-room reference.

This is a raster concept sheet, not application implementation. Four distinct motifs (solutions, knowledge, data and time), five visual variants each. Roman numerals identify design stages only; live IDs, thresholds and stage counts are not changed. The small symbols on the left identify families and are not extra stages.

## Integrated review

- Product: a bounded comparison sheet is sufficient to assess style; no catalog expansion.
- UX: preserve clear glass and family identity; enrich silhouette and construction between neighboring stages.
- Learning: clock trophies show accumulated study time, not knowledge mastery; no invented thresholds.
- Behavioral: early stages remain complete rewards; richness grows without neon, guilt or status pressure.
- Strategy: restrained green edges and sculptural forms fit the existing calm KODA identity.
- QA: inspect actual pixels for clear material, four-by-five layout, distinct motifs and stepwise growth. The initial data/clock III–IV transitions required refinement.
- Architecture and analytics: not applicable to this standalone visual preview; no runtime, source-of-truth or event changes.

Decision: ivory limestone shelves, colorless transparent glass bodies, polished muted green rims, soft daylight, subtle flowing clock geometry. Knowledge is deliberately represented by an open glass book for distinctness. Stage improvements add structural layers and folds rather than only color or size.

## Deliverable

Final selected image: [achievement-glass-progression-v3.png](achievement-glass-progression-v3.png).
Earlier v1/v2 sheets are retained as concept iterations. Created using the built-in image_gen tool: generation with the supplied image as a style/material reference, followed by two precise-object edits. Original files remain in the Codex generated_images directory.

Visual inspection: transparent centers, readable green edges, cream palette and all four rows/five stages preserved. Data IV retains III layers and adds a helix; V adds an inner cylinder. Clock IV retains III's broad draped foot and adds layered contours; V adds a swept fold. No application build or behavior tests are required for these standalone image files.

Independent QA visually accepted the final v3: four distinct rows, readable I–V structural growth and corrected clock III–IV progression. This verifies the concept sheet only, not production rendering.

## Prompt set

### Generation

```text
Use case: product-mockup.
Asset type: high-fidelity achievement trophy progression concept sheet for the KODA learning app.
Input image 1: STYLE AND MATERIAL REFERENCE ONLY, not an edit target. Use its thin clear glass trophies with green edges, ivory architecture, soft sunlight, restrained surrealism. Create a NEW mockup board, not a copy of the room.
Primary request: show FOUR recognizably different achievement families, each with FIVE genuinely distinct progressive trophy designs from left to right. Exactly 20 trophies in a clean 4-row by 5-column comparison grid. The purpose is to clearly see both real transparent glass material and structural improvement between every adjacent stage.
Canvas: elegant wide landscape design board, approximately 3:2, high resolution. Warm ivory matte background; four thin cream limestone shelves running horizontally, one beneath each row. Equal unobstructed cells with generous margins, consistent three-quarter camera, same ground plane, comparable sizes. Trophy bases touch shelves. No detailed room panorama competing with the objects.
Materials: physically convincing optically CLEAR COLORLESS THIN GLASS, transparent centers, visible background through every surface, gentle refraction, soft caustics, delicate polished emerald/sage-green EDGES only (#416d53 family), fine white rim highlights. No opaque sage fill. Small restrained ivory or translucent pedestal, not dominant. Close to the provided reference's glass and green contours. Soft daylight from upper right. Calm, airy, tactile, minimal 3D near 2D, with subtly curved surreal geometry reminiscent of Salvador Dali.
Family row 1 labelled exactly "Решения": a green-edged transparent hexagonal glass sculpture with a checkmark motif, NOT arrows. Progress from small clean single glass plane and check, to thicker double plane, to beveled layered hexagonal frame, to interlocking curved glass facets, to a completed sophisticated sculptural double-hexagon with clearly readable central check.
Family row 2 labelled exactly "Знания": an OPEN GLASS BOOK motif with sculptural clear pages. Progress from two simple transparent curved pages, to four pages, to a small fanned book with page ribs, to layered sweeping glass pages, to a beautifully balanced flowing book sculpture. Always unmistakably an open book, not an orb.
Family row 3 labelled exactly "Данные": a GLASS DATABASE CYLINDER motif. Progress from a simple single transparent cylinder with two green rims, to three stacked clear glass discs, to a five-ring dimensional cylinder, to structured layered cylinder with elegant curved data channels, to a refined sculptural cylinder with nested glass volumes and one subtle flowing arc. Retain cylindrical data silhouette.
Family row 4 labelled exactly "Время": softly MELTING GLASS CLOCK motif with readable hands, subtly Dali-inspired. Progress from a simple upright gently asymmetric clock, to thicker curved clock with small folded glass foot, to a softly flowing draped clock, to a layered flowing clock with one nested rim, to a refined sculptural melting timepiece with green-edged translucent folds. Never hourglasses, never mechanical gears, never sharp neon.
Progress rule: stage 1 must already be a beautiful complete reward. Each adjacent stage adds an unmistakable structural element and a more developed silhouette; do not repeat an identical icon five times or merely enlarge/recolor it. Stage 5 is visibly richer but still calm, minimal and transparent. Keep recognizable family motifs across stages. More confidence in green contour toward the right, but colorless glass remains clear at every stage. Do not replace families by common generic rounded medal shells.
Typography: small quiet muted-green typography outside the objects. Main title exactly "Стеклянная коллекция". Column headers exactly "I", "II", "III", "IV", "V". Row labels exactly as given above. Optional single small subtitle exactly "Как растут достижения". No other text, no numerical task thresholds, no invented requirements, no watermarks.
Avoid: opaque plastic blobs, ceramic trophies, solid green medallions, neon glow, gold/chrome, cyberpunk, sparkles, dense ornaments, illegible miniature text, labels touching trophies, uneven grid, repeated clones, floating unsupported trophies.
This is a preview of visual design variants, not a change to live achievement counts or conditions.
```

### Data and clock progression refinement

```text
Use case: precise-object-edit.
Input image 1: EDIT TARGET, the existing KODA glass achievement concept board.
Primary request: correct only the structural progression of the lower two trophy rows so stage IV is visibly richer than III and stage V richer than IV. Keep all other board elements EXACTLY unchanged: title, subtitle, row labels, Roman numeral column labels, all shelf positions, lighting, palette, transparent clear-glass material with thin sage/emerald edges, layout, upper two complete rows, lower rows stages I and II, and lower stages III.
Data row "Данные": keep stage III's existing stack of five green-rimmed clear glass discs. In stage IV preserve that same five-disc cylindrical structure and ADD a single elegant helical green-edged transparent glass ribbon sweeping around the cylinder. It must unmistakably contain the five-disc structure AND added flowing ribbon, rather than replace the five layers by a plain cylinder. In stage V preserve the five-disc outer cylinder and flowing ribbon and ADD a smaller nested three-disc clear cylinder inside, with two subtle connection ribs. Keep clean, airy clear material and readable cylinder motif. Do not make it cluttered or opaque.
Clock row "Время": preserve stage III's existing gracefully draped transparent clock with its folded glass foot. In stage IV keep that same expressive draped silhouette and folded foot and ADD a second thin curved transparent glass rim following the flow, plus one gently layered folded glass edge. In stage V retain the draped clock, folded foot and layered rim and develop one additional elegant swept transparent glass fold emerging beside the clock. Stage III to IV must NEVER lose the fold or become a simpler oval; stage V must be the most sculptural while still restrained. Clock hands and green outline remain readable, no hourglasses or gears.
Constraints: exactly same four-by-five comparison grid, exactly 20 trophy objects and the small family identifiers at left, no text changes, no new objects outside the four specified cells, all trophy pedestals firmly on shelves. Completely transparent colorless thin glass with green edges, no opaque fills, no neon, no gold or chrome. Preserve the existing image quality and reference-matching gentle daylight.
```

### Final localized clock IV correction

```text
Use case: precise-object-edit.
Edit TARGET is the attached progression board. Make exactly ONE localized modification to the trophy at row 4, column IV: the fourth LARGE clock trophy in the bottom row, immediately LEFT of the final V clock and RIGHT of the III clock. Keep its pedestal and position.
Its redesign MUST start by duplicating the silhouette of the adjacent III clock to its left: that III clock has a circular dial atop a DRAPED TRIANGULAR GLASS BODY, with a broad clear folded glass foot spreading out horizontally to both sides at the bottom. Replace the IV clock's current plain rounded/oval outline with this same DRAPED TRIANGULAR CLOCK SILHOUETTE and broad spreading folded glass foot. Keep the three-dimensional upright clear-glass clock face; do NOT make a simpler standalone oval. Then ADD a second thin transparent green-edged glass layer following BOTH SIDES of that draped triangular silhouette and broad glass foot. Add one small further folded clear-glass lip on the right side of this IV foot.
The result for IV must be visibly a more layered, richer version of III, retaining III's flared folded base. This is essential; extra circular rims around an oval without the broad flared foot do NOT meet the request.
Maintain thin optically clear COLORLESS glass with muted green EDGES, ivory pedestal, identical soft lighting, perspective and size comparable with III and V. Glass must remain transparent. Stage V remains unchanged, the most sculptural.
STRICT INVARIANTS: do not alter ANY of the other nineteen large trophies, any small left identifier, typography, title, row labels, Roman numerals, pedestals, shelves, lighting, palette, background, framing or aspect ratio. Only replace bottom-row IV clock and its glass body, within its existing cell. No added objects outside that one cell, no neon, no opaque fills, no gold.
```
