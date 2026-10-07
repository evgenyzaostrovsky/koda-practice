# KODA Data Glyphs

KODA Practice now uses a small branded SVG icon family for primary navigation and the Practice actions. The glyphs are built from the two-part KODA mark: connected cells, data paths and small directional details. They use the semantic theme colors and remain outline-based so the same language works in dark, light and blue themes.

The source of truth is `apps/web/src/koda-icons.tsx`. Navigation uses `KodaHome`, `KodaCodePath`, `KodaModules`, `KodaBook`, `KodaLab`, `KodaTrace`, `KodaSignal`, `KodaBadge` and `KodaProfile`. Practice uses `KodaRun`, `KodaCheck`, `KodaHint`, `KodaTheory` and `KodaReset`. Lucide remains available for secondary controls such as close, resize and directional affordances.

Glyphs default to 24px and accept the same `size` prop used by the navigation. The shared stylesheet adds a minimum 44px navigation target, a visible focus ring and an accent line for the active route. Icons inside labelled controls are aria-hidden; standalone icon-only controls retain their existing Russian accessible labels.

The visual system is deliberately code-native SVG rather than bitmap artwork: icons need to scale cleanly, inherit theme colors and remain crisp in the editor and mobile layouts. Achievement illustrations remain their existing PNG/WebP system because they carry richer scene content than interface glyphs.
