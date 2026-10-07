# Compact KODA concept — 2026-10-07

Scope: a separate clickable mockup of every existing page, not a production UI migration. Example data and proposed interactions are explicitly marked as demo. The Founder reviews the visual direction before production implementation.

## Integrated decision

Retain the #416D53 brand, original wave, light surfaces and existing sections. Replace full-width stretching with bounded, centered content. Compactness comes from grouping related information and reducing ornamental header space, not tiny fonts. Ordinary pages use 800–980px content widths; coding workspaces can use 1180px. Reading lines remain narrower than dashboards. Buttons remain easy to target on mobile.

## Review perspectives

- Product: preserve the existing learning loop and sections; the artifact must cover all screens, not only a home-page hero.
- UX: bounded widths, consistent alignment, restrained serif titles, predictable navigation and responsive stacking. The UX agent provides the detailed screen specification.
- Learning: keep condition, editor, hints and results distinguishable; articles and cheat sheets remain different reading formats. No new learning content is integrated.
- Behavioral: one dominant next action; supportive feedback, optional hints, no pressure-based streak prompts.
- Technical: isolated static prototype with no execution engine, storage migrations or production CSS changes; original app remains the source of truth.
- QA: inspect every screen at desktop/mobile, verify navigation, overflow, long text and explicit demo status. This is design acceptance, not runtime Python validation.
- Analytics: mocked figures are examples, not observed learning data; no new events are implemented.
- Strategy: establish KODA identity through its wave, calm green palette and learning workspace; avoid unrelated premium or social features.

## Reference principles

[Apple UI design tips](https://developer.apple.com/design/tips/) supports aligned content, nearby controls, readable text and sufficiently sized touch targets. [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout) supports constrained readable content widths. [Material foundations](https://m3.material.io/foundations/) informs consistent spacing, layout and color roles. These are principles, not copied site layouts.

Final screen inventory and verification are recorded after the prototype is complete.

## Designer specification

Direction: a calm working notebook. Sidebar 208px, content padding 28–32px, white cards with 12–16px corners, 16px grid gaps, 28px between sections. Green #416D53, secondary text #626E65, main text #24332B. Serif page titles 32/38px, section titles 24/30px; sans body 15/23px, reading 16/26px, code 13/20px. Controls use at least 44px touch targets. Narrowness must not reduce code space or truncate content.

| Screen | Content width | Composition |
| --- | --- | --- |
| Home | 880px | Short resume hero, small counter, three metrics, compact module rows |
| Catalog | 960px | Filters, two-column cards, progress footers |
| Topic | 900px | Compact introduction and progress, theory/example, ordered task rows |
| Practice | 1180px | Compact heading/route, toolbar, 38/62 condition/editor split, results below code |
| Knowledge | 960px | Search/categories, two-column material cards |
| Cheat sheet | 980px | Mode switch/search, 22/33/45 method/description/example columns |
| Article | 940px | Narrow reading column and sticky contents; light expected-result/error blocks |
| Progress | 800px | Metrics, module rows, activity |
| Errors | 800px | Attempts with type/date and clear retry links |
| Achievements | 960px | Summary/filters, three-column family gallery, bounded dialog |
| Profile | 860px | Identity/metrics, progress/activity, account |
| Settings | 720px | Separate identity/email/password forms with adjacent feedback |
| History | 720px | Compact chronological attempt rows |
| Sandbox | 1180px | Files/editor/output, independently readable output types |
| Authentication | 400px | Centered form, login/register/recovery modes |

At 760px and below, navigation becomes an overlay and grids stack; practice keeps condition → code → actions → result; sandbox switches Files/Code/Result. Long tables/code may scroll locally. Proposed state previews are conceptual and do not imply implemented persistence, authentication or Python execution.

Delivered: isolated static artifact at apps/web/public/compact-design/ with 15 screens and demo interactions. Designer independently reviewed structure and flagged readability, mobile access, standalone login and conceptual additions; corrections were integrated. Production build/typecheck passed. Browser validation captured all 15 screens at 1440px and 390px (30 screenshots), with no document overflow or page errors. Home/practice/article screenshots were visually inspected. This verifies the mockup only; Python, authentication and persistence are explicitly simulated.

Founder icon refinement: preserve the approved stacked original BrandMark above lowercase koda. Prototype icons now use original curved paths with rounded ends, shared 18-unit grid and 1.4 strokes. Applied only to the separate mockup. Build and all 30 desktop/mobile screen checks passed after the change.

Surreal icon exploration: gently melting house/book/document silhouettes, elastic coding brackets and a soft-clock history symbol. Original wave emblem and semantic action icons remain intact. This is an optional prototype direction inspired by surrealist form, not a production rollout. Build and 30-screen responsive checks passed.
