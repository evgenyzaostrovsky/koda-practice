# Home width adjustment

The Founder highlighted the unused right strip beside the dashboard. Two home-only width caps (880px) now use the available main-column width. The existing application shell width and outer gutters remain the same, as do typography, component heights and short text line limits.

This is a trivial, reversible width-token adjustment under the repository's proportional-review exception; it adds no behavior, learning content, events or data changes. Production build passes. Independent read-only QA passes at 1280/1440/390px: dashboard widths 1032/1192/354px, desktop right gutter 20px and mobile gutters 18px, no document or descendant overflow. Heading sizes 32/26px, hero body 13px with its 410px text cap and 28px padding remain unchanged. Screenshots: reports/qa-home-width-{1280,1440,390}.png. The pre-existing pale statistics text is outside this width-only change.
