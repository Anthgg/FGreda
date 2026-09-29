# 010Q UX gaps recorded during 010P W4

This is a deferred review list from the 010P W4 integration. W4 preserved the 010O shell and added no commercial rules or redesign. No CRITICAL usability blocker was observed in the completed live W3 regression flows.

## Deferred product UX review

- **MEDIUM — Piezas:** time-per-unit and mold inputs add height to each line card. Review the editing flow at 375 px and reduce visible detail if the cards feel crowded.
- **MEDIUM — Trabajo:** worker, process, assignment origin, and active hours compete for attention. Review hierarchy and scanning order.
- **MEDIUM — Alta rápida:** worker and technique fields unblock the flow but make the section tall. Consider a focused dialog and clearer validation.
- **MEDIUM — Precio:** commercial and real costs appear together. Review whether the distinction remains clear on a narrow screen.
- **LOW — Lotes:** explicit lot selection is safe, but the list may become cumbersome when a prepared material has many lots.
- **MEDIUM — WIP:** the six-column table uses horizontal scrolling on narrow screens. The scroll is usable and remains acceptable for W4; review a compact card or staged mobile presentation.
- **MEDIUM — Entrega:** the action is in the existing stock table, so finished-product eligibility is not clear until selection. W4 fixed keyboard focus by moving focus to the delivery heading when the form opens; review earlier discoverability in 010Q.
- **LOW — Bundle size:** final build remains near the W3 baseline at 1,216.99 kB minified (315.53 kB gzip). Review code splitting in 010Q; no W4-specific growth was identified.

## Closed W4 regression issue

- **Solo Quema — resolved in W4:** the prior W3 note about a missing fixture path was stale. The local browser E2E now completes the supported flow using `line_ref` from GET, with 10 started, 8 good, 2 scrap, no `PRODUCTION_IN`, and unchanged finished-product stock. The broad 70-test revision run is still required for final suite status.

## W4 evidence and limits

- The complete local Playwright revision suite passed **70/70** with zero retries. It includes the retail quote/PDF flow, external 10 h costing, parallel 5 h + 6 h lines, explicit lot selection, the 30 = 27 good + 3 scrap production result, prototype scrap and delivery, WIP entry/exit, and Solo Quema. A focus regression in delivery was fixed and the suite passed after the fix.
- Responsive helper checks cover 375, 768, 1024, 1280, and 1440 px on the exercised screens. Structural checks cover named controls/dialogs and keyboard focus. They are not an axe scan or a complete WCAG conformance audit.
- React Doctor 0.9.14 on the W4 changed scope scanned 7 files and reported **1 warning, 0 errors**: high control-flow complexity in `src/features/inventory/InventoryPage.tsx`. The earlier full-codebase scan had unrelated pre-existing findings.
- The production build passed at **1,217.25 kB minified / 315.67 kB gzip**, compared with the W3 baseline of 1,216.99 / 315.53 kB. Vite still reports the existing >500 kB chunk warning; W4 adds 0.26 kB minified and 0.14 kB gzip.
- Vitest passed **103/103 files, 1,220/1,220 tests**. ESLint and TypeScript passed. Test output still includes existing React `act(...)` warnings and jsdom's unsupported navigation diagnostic.
- The required full-suite pass does not replace every scenario named in the W4 acceptance brief. Browser E2E still lacks the exact two-external-worker aggregate, wholesale accept/decline and worker-preservation cases, passive-space exclusion, 27 → 20 → rejected 8 delivery, custom-piece retry, positive quick-create capability flow, V1 settings immutability, and V2 master-change snapshot scenario. Backend unit/database coverage exists for portions of these flows; keep W4 blocked until the required browser scenarios are exercised or their acceptance is explicitly narrowed.
- No global browser console-error collector or axe scan ran. Several production E2E cases assert zero page/console errors, and the responsive/accessibility helper checks structure and focus; neither proves zero errors or zero serious/critical accessibility findings across every surface. Lighthouse was not run; it is optional in the W4 instructions.
