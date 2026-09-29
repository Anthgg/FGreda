# 010Q UX gaps recorded during 010P W4

W4 kept the existing 010O visual direction. The 75-test local Playwright revision run passed; this list records observed accessibility debt and follow-up review items. W4 remains blocked by backend and acceptance-evidence gates documented in CODEX_010P_W4_REPORT.md.

## HIGH — inherited accessibility findings

- The explicit-lot, prototype-result, and Solo Quema scans reported serious color-contrast findings: required labels at 3.59:1 and muted gray labels at 2.62:1 against white, below 4.5:1.
- The Solo Quema scan also reported a link without an accessible name.
- These exact findings were present in the pre-010P baseline; the relevant styles and Solo Quema page were not introduced by W4. The E2E helper filters only those known baseline nodes, and still fails on unrecognized nodes. Review and correct the inherited findings in 010Q.

## MEDIUM — review in 010Q

- Inventory delivery is reachable from the stock table. W4 moves keyboard focus to the delivery heading when the form opens; review whether the action is discoverable before a product is selected.
- The WIP table uses internal horizontal scrolling at narrow widths. The tested page avoids document-level overflow; review a compact mobile presentation if workshop use makes the table difficult to scan.
- React Doctor 0.9.14 scanned 161 changed-scope files and reported 40 warnings with 0 errors. The inventory page has a control-flow-complexity warning; review during cleanup.

## LOW — bundle

- The final JavaScript bundle is 1,220.84 kB minified / 316.69 kB gzip, compared with the W3 baseline of 1,216.99 / 315.53 kB (+3.85 / +1.16 kB). Review code splitting in 010Q; the existing large-chunk warning remains.

## Evidence boundaries

- Responsive checks ran at 375, 768, 1024, 1280, and 1440 px on selected exercised screens. They do not constitute a visual review of every production, inventory, WIP, delivery, prototype, and quick-create surface.
- Axe checks ran only on exercised flows. Known inherited findings are reported above; a complete WCAG audit across every named surface remains open.
- Console and page-error assertions are scenario-specific. There is no global collector covering all browser flows.
- Lighthouse was not run; it is optional for W4.
- The local E2E suite did not exercise custom-piece retry, normal production 30 = 27 good + 3 scrap, WIP transitions, or delivery of 20 followed by rejection of 8. These are W4 release blockers recorded in the final report, not UX redesign work.

No CRITICAL usability blocker was observed in the flows that completed. Do not begin 010Q until separately authorized.
