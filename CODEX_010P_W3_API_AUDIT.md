# CODEX 010P W3 API audit

Audited before frontend edits against backend worktree `C:\Users\anthg\BGreda-010p-w2`, commit `3ce6de0eb563b561e3c2ca1e3142b92b5b764c48`, Alembic `0045`.

## Confirmed contracts

- Quotation line `PUT /quotations-v2/{quotation_id}/products/{line_id}` accepts `production_time_per_unit_minutes` as a decimal number of minutes and `mold_count` as an integer (`>= 1`, default `1`). Its response carries `cycles` and `line_active_minutes`.
- Pricing is separate: `GET` and partial `PUT /quotations-v2/{quotation_id}/pricing`. The response carries `active_production_hours`, commercial and real external labor costs, `labor_cost_gap`, `external_workers[]`, snapshot/override/effective hourly space cost, passive suggestion, wholesale values, line values, and warnings. The input accepts `commercial_factor`, `space_cost_per_hour_override`, and `passive_time_hours`.
- Labor rows return `worker_type`, `worker_name`, `final_hours`, `assignment_origin`, and warnings. Pricing's `external_workers[]` returns `daily_rate`, `workday_hours`, `hourly_equivalent`, `days_paid`, `commercial_cost`, and `real_cost`.
- `GET /quotations-v2/{quotation_id}/confirmation-preview` returns `can_confirm`, `blockers[]`, `warnings[]`, a fingerprint, and the document preview. Pricing remains a separate request.
- Wholesale accept and decline are bodyless `POST`s. Accept returns `{ quotation, warnings }`; decline returns the quotation directly.
- `GET /inventory/lots?product_id=&location_id=` returns `preparation_id`, `preparation_code`, product/location ids, available `quantity`, `uom_code`, prepared timestamp, and solids ratio.
- `POST /production-orders/{order_id}/consumptions` accepts `product_id`, positive `quantity`, `kind`, optional `stock_location_id`, optional `v2_quotation_product_id`, optional note, mandatory `idempotency_key`, and `preparation_id` when the chosen product is prepared material.
- `POST /production-orders/{order_id}/complete` accepts `{ results: [{ line_ref, good_quantity, scrap_quantity, scrap_reason }] }`. `line_ref` identifies a `V2P:<id>` line. The response is `{ order, results }` and result rows carry the backend's `started_quantity`.
- WIP is `GET /production/wip`. Delivery is `POST /inventory/deliveries` with positive `quantity`, `product_id`, `location_id`, optional `v2_quotation_id`, optional `production_order_id`, and optional `reason`.
- Quick create is protected by `MASTERS_QUICK_CREATE` for operators (admins are always allowed). Worker create accepts name/type/daily rate/optional workday/active/notes/technique ids; technique create accepts code/name/default capacity/unit/glaze/manual-hours/active/notes.
- Prototype completion uses scalar `started_quantity`, `good_quantity`, `scrap_quantity`, and `scrap_reason`; it is not the production-order `results[]` contract.

## Contract differences recorded

### CODEX_010P_W3_API_DELTA_1 — Production results

The plan calls for showing `started_quantity`; W2 returns it in each result but does not accept it in the completion request. The UI will display the order line's started quantity and send only `line_ref`, `good_quantity`, `scrap_quantity`, and `scrap_reason`.

### CODEX_010P_W3_API_DELTA_2 — Prepared material lot identity

W2 calls the selected lot key `preparation_id` and its display code `preparation_code`; there is no `lot_id` or generic `code` field. The UI will use those exact names and will not choose a lot automatically.

### CODEX_010P_W3_API_DELTA_3 — Delivery linkage

W2 names quotation linkage `v2_quotation_id`; the delivery request also allows `production_order_id`. The UI will use the exact fields where the current context has those ids.

### CODEX_010P_W3_API_DELTA_4 — Wholesale response shapes

Accept and decline use different response shapes: accept wraps the quotation and warnings; decline returns the quotation. Frontend mutations must normalize neither by assumption and will invalidate/reload the affected quotation and pricing queries.

### CODEX_010P_W3_API_DELTA_5 — Prototype completion

Prototype result fields are scalar top-level fields, not `results[]`. The frontend API currently posts an empty object; W3 must send the explicitly entered quantities.

### CODEX_010P_W3_API_DELTA_6 — Capability exposure

W2 includes `capabilities[]` on authenticated session users; the frontend `SessionUser` type currently omits it. W3 will add that field and gate quick-create UI with the existing role/capability model while leaving backend authorization authoritative.

### CODEX_010P_W3_API_DELTA_7 — Stock product type

W2 stock balance rows do not include `product_type`. Delivery eligibility must be resolved through the product master before showing/enabling a finished-product delivery action; W3 will not infer product type from stock balance shape.

## W3 contract addendum — 2026-09-28

The initial audit above describes W2 at `3ce6de0eb563b561e3c2ca1e3142b92b5b764c48`. The isolated backend W3 contract commit `b5d55caa58a6f7c76df52c666c85858d1467d6e2` extends the public order read:

- `GET /production-orders/{id}` returns authoritative `result_lines[]` with `line_ref` and `started_quantity`, and existing source/product identifiers and labels when available.
- Backend constructs the accepted references for V2 product, V2 firing, and prototype sources. The frontend does not reconstruct these identifiers or infer the started quantity.
- `POST /production-orders/{id}/complete` remains unchanged and validates the reference against the order and `good_quantity + scrap_quantity == started_quantity`.
- The W3 read/complete tests use the returned line data as their input. No database migration was added; Alembic remains at `0045`.

The Solo Quema **browser E2E** remains blocked by the absence of a supported public FQ-to-production-order creation flow in the isolated E2E fixture. This is separate from the read-contract fix; details are in `CODEX_010P_W3_BACKEND_BLOCKER_1.md`.
