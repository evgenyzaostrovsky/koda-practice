# KODA Soft Line UI kit

Source of truth: `apps/web/src/ui/`. Import reusable primitives from its `index.ts`.
The independent `/design-system` gallery is a demonstration; it bypasses authentication and live application effects, has no progress persistence, and loads lazily. Existing live pages and legacy icon exports are unchanged.

## API

Wrap consumers in `.koda-ui` to opt in to the scoped tokens and styles.

```tsx
import { KodaButton, KodaIcon, KodaIconButton } from './ui';

<div className="koda-ui">
  <KodaIcon name="Knowledge" title="База знаний" size={24} />
  <KodaButton icon="Run" loading={pending} onClick={run}>Запустить</KodaButton>
  <KodaIconButton icon="Close" label="Закрыть панель" onClick={close} />
</div>
```

`KodaIcon`: typed semantic `name`, optional `size` (20 default), optional meaningful `title`, native SVG props. Original SVG geometry uses a 24-unit grid, 1.65 rounded strokes and currentColor. Untitled icons are decorative and hidden from accessibility APIs; titled icons expose their own image name.

Names: Home, Practice, Route, Topics, Knowledge, Sandbox, Progress, Achievement, Profile, Settings, Run, Check, Hint, Reset, Search, Close, ChevronDown, ArrowLeft, Save, DataTable.

`KodaButton`: native button props and ref, `type="button"` default, `variant` primary/secondary/quiet/danger, optional icon, `loading` and localized `loadingLabel`. Height44, radius12, font14, gap8, icon20. Loading keeps the original content's footprint, disables repeat input, exposes aria-busy and a readable status. Use native disabled with an adjacent reason and aria-describedby when relevant. Toggle actions use aria-pressed; navigation uses real links.

`KodaIconButton`: same props plus mandatory icon and label, square44 target and native title tooltip. Do not remove its accessible label when replacing the tooltip.

Tokens are scoped to `.koda-ui`: forest #426B54, hover #355843, white surface, border #CBD8CE, quiet sage #EEF4EF and restrained red danger. Focus-visible, pressed and disabled states are distinct. Reduced motion stops spinner animation while keeping its textual status. The gallery's own layout is also scoped.

## Integrated review and verification

PM: reusable code kit plus isolated gallery; no mass replacement of live UI. UX: consistent original shapes, four button priorities, mobile targets and clear labels. Behavioral: visible local outcomes, loading repeat prevention and calm states. Tech: typed primitives, native props/ref, scoped CSS and lazy routes. QA: independent component semantics and browser checks at desktop/mobile, no API/progress writes. Learning, analytics and strategy: no content, event or commercial semantics change.

Typecheck, production build and App smoke passed. Independent QA authored component and browser regressions, identified and prompted fixes for the Chromium loading-button accessible name and muted-text contrast. Final checks executed by the orchestrator passed 7 component tests and 2 browser tests at 1440px/390px, including keyboard activation, targets, loading labels, local interactions, overflow and absence of API/storage writes. QA's final independent sign-off was unavailable because its agent hit a usage limit. Final gallery bundle: DesignSystem-BCYmbGiC.js. Existing production consumers are not migrated.
