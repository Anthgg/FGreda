# 010Q UX gaps recorded during 010P W4

This document records inherited accessibility debt and follow-up items observed in the full local W4 run. The 010P W4 release candidate passed its 75/75 Playwright suite against local frontend/backend services and disposable PostgreSQL. No 010Q redesign was implemented.

## HIGH — inherited accessibility findings

- Axe WCAG A/AA reported inherited contrast ratios of 3.59:1 for small orange labels and 2.62:1 for muted zinc labels against white.
- The Solo Quema surface also contains an inherited link without an accessible name.
- W4 scoped Axe assertions filter only these known baseline findings and still fail on unrecognized findings. No new serious or critical finding appeared in the exercised W4 surfaces. Correct the inherited findings in 010Q.

## MEDIUM — usability review

- Inventory delivery is reachable from the stock table. W4 moves keyboard focus to the delivery heading when the form opens; review whether the action is discoverable before a product is selected.
- The WIP table uses internal horizontal scrolling at narrow widths. The tested page avoids document-level overflow; review a compact mobile presentation if workshop use makes the table difficult to scan.
- React Doctor 0.9.14 reported 40 warnings across 161 changed-scope files, with 0 errors. InventoryPage has a control-flow-complexity warning.

## LOW — bundle size

- W4 JavaScript is 1,220.84 kB minified / 316.69 kB gzip, versus W3 at 1,216.99 / 315.53 kB: +3.85 kB minified and +1.16 kB gzip. The existing Vite large-chunk warning remains; review splitting during 010Q.

## Evidence boundaries

- Responsive checks ran on the named exercised surfaces at 375, 768, 1024, 1280, and 1440 px. WIP uses an internal table scroller on mobile.
- Axe checks ran in the requested exercised flows, with exact known baseline findings filtered. This is not an audit of unrelated app pages.
- The full revision run passed 75/75. The global guard saw 0 uncaught page errors and 0 JavaScript console.error; browser-generated network diagnostics for non-2xx responses were treated separately, and expected negative flows checked their visual state.
- Lighthouse was not run; it was optional for W4.
- API contract review covered products, quotation V2, production, inventory, and Solo Quema, not unrelated API modules.

No critical usability blocker was found in the flows exercised by W4. Keep inherited accessibility and mobile usability work in 010Q, which requires separate authorization.
