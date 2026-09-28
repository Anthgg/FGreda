# 010Q UX gaps recorded during 010P W3

This is a capture list for the later UX review. W3 keeps the 010O shell and only adds the controls needed to use the 010P backend.

- **Piezas:** time-per-unit and mold inputs add height to each line card; review the editing flow at 375 px and reduce the amount of visible detail if it feels crowded.
- **Trabajo:** worker, process, assignment origin, and active hours compete for attention; review the hierarchy and scanning order.
- **Alta rápida:** worker and technique fields are useful to unblock the flow but make the section tall; consider a focused dialog and clearer validation in 010Q.
- **Precio:** commercial and real costs are now shown together; review whether the distinction remains clear on a narrow screen.
- **Lotes:** explicit lot selection is safe, but the available-lot list may become cumbersome when a prepared material has many lots.
- **WIP:** the six-column table needs horizontal scrolling on narrow screens; review a compact card or staged mobile presentation.
- **Entrega:** the inventory action is in the existing stock table and verifies product type after selection; review how to make finished-product eligibility clearer before opening the form.
- **Solo quema:** completion remains blocked by `CODEX_010P_W3_BACKEND_BLOCKER_1`; this is an API gap, not a UX-only change.

Responsive smoke: `/produccion` and `/inventario` were checked at 375, 768, 1024, and 1440 px with local API mocks. The document had no horizontal overflow at any width; at 375 px the WIP table scrolls inside its card. This is a route-mocked UI smoke, not a live production check. An automated accessibility audit remains pending.
