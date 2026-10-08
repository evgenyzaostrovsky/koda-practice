# Shared content spacing

The Founder requests a smaller sidebar-to-content distance across all sections, especially more useful Sandbox code/result width. Eight-role review approved a bounded refinement of the existing compact theme.

| Role | Conclusion |
| --- | --- |
| Product | One consistent leading edge; preserve functionality. |
| UX | Use a 20px desktop gutter, existing 18px mobile gutter; align headers and bodies. |
| Learning | Preserve readable article caps and code/result associations. |
| Behavioral | Preserve controls, focus, draft and result across resize/sidebar toggle. |
| Tech | Remove repeated horizontal auto margins in compact.css; expand final Sandbox caps; retain theme guards. |
| QA | Measure real descendant bounds, all route families, collapsed navigation and mobile. |
| Analyst | No new learning events; geometry is acceptance evidence. |
| Strategy | Shared usability refinement, no wider redesign or monetization work. |

Baseline Chromium at 1440px: sidebar right208; Home content gap176; Catalog/Knowledge/Sandbox gap136. The 1440px outer shell remains centered at larger viewports. Repeated centered reading containers, rather than main padding alone, cause the excess gap. Sandbox's effective page/grid cap is960px.

Decision: 20px desktop main inset, left-aligned existing capped reading containers and headers; unchanged mobile18px and outer shell/navigation geometry. Sandbox uses the full available main width while preserving stacked files/code/result flow, editor height, and file dialog. Scope is CSS only: content, progress, execution and analytics semantics are unchanged.

Acceptance: all desktop section wrappers/headers share the leading edge, Sandbox editor/result gain width, long tables scroll locally, descendant bounds and controls fit mobile. Independent QA must verify final served production build. Status: independent runtime QA PASS. Three Chromium regressions cover 13 routes at 1440/1920/390px, desktop gutter20±2, descendant containment, Sandbox editor/result widths, collapsed navigation and existing draft preservation on resize. Actual8014 read-only browsing confirmed Home gap20 and Sandbox gap20/width1192, with zero horizontal overflow. Typecheck, production build and lint passed. Sandbox execution is unchanged and was not rerun for this CSS-only refinement.
