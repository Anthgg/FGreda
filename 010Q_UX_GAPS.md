# 010Q UX gaps recorded during 010P W3

This is a capture list for the later UX review. W3 keeps the 010O shell and only adds the controls needed to use the 010P backend.

- **Piezas:** time-per-unit and mold inputs add height to each line card; review the editing flow at 375 px and reduce the amount of visible detail if it feels crowded.
- **Trabajo:** worker, process, assignment origin, and active hours compete for attention; review the hierarchy and scanning order.
- **Alta rápida:** worker and technique fields are useful to unblock the flow but make the section tall; consider a focused dialog and clearer validation in 010Q.
- **Precio:** commercial and real costs are now shown together; review whether the distinction remains clear on a narrow screen.
- **Lotes:** explicit lot selection is safe, but the available-lot list may become cumbersome when a prepared material has many lots.
- **WIP:** the six-column table needs horizontal scrolling on narrow screens; review a compact card or staged mobile presentation.
- **Entrega:** the inventory action is in the existing stock table and verifies product type after selection; review how to make finished-product eligibility clearer before opening the form.
- **Solo quema:** the detail UI now reads authoritative V2F references and started quantities from the W3 backend contract. The real browser E2E remains blocked because the isolated fixture has no supported public FQ-to-production-order flow; see `CODEX_010P_W3_BACKEND_BLOCKER_1.md`.

## W3 evidence and deferred review

- Responsive E2E passed at 375, 768, 1024, and 1440 px on live local-backend flows for quotation pieces/work/price, explicit lot selection, WIP, production completion, prototype results, inventory, and delivery. No document-level horizontal overflow was found; the WIP table scrolls inside its card at 375 px.
- Playwright structural checks passed for accessible button names, labeled controls, named dialogs, error associations when present, visible focus after keyboard Tab, and focus contained within an open dialog. This is a scoped semantic/focus check, not an axe scan or full WCAG conformance audit. Do not describe it as zero serious axe violations.
- React Doctor 0.9.14 exited 0 on the final changed scope (2 files, zero issues). The broader W3 scan recorded 15 warnings and 0 errors across 9 changed/added files. No score or telemetry was produced. Its earlier `prefer-html-dialog` warning did not account for the shared `useDialogoAccesible` hook: the hook wraps Tab/Shift+Tab at both dialog boundaries and restores focus on close, now asserted in Playwright. Other complexity/effect warnings remain review debt for 010Q; no W3 runtime defect was found by these E2Es.
- The final build's JavaScript chunk is 1,216.97 kB minified (315.52 kB gzip). Keep code splitting in 010Q/cleanup; it was not expanded into W3.
- Solo Quema remains an API workflow blocker: the local E2E fixture has no supported public FQ-to-production-order creation path. See `CODEX_010P_W3_BACKEND_BLOCKER_1.md`.
