# GREDA 010P W4 - inventario de cambios frente a producción

- Backend: 99c35b61f805dd8db6b3d1faac820f13fb4d0e07 -> 08b95e2495ab65b0c9c6e743614bf59f8f2987ad; rama feat/010p-w4-integration.
- Frontend: 25da2189a25b4dd62c7bf56a7513880a1ebb312b -> db73e301a5addf96989ff92eadc7c17e12cb9ecb; rama feat/010p-w4-integration.
- Conteos por ruta destino; las renombradas incluyen ruta anterior y nueva.

## Backend

### schema (25)

- A alembic/versions/0042_v2_rules_010p.py
- A alembic/versions/0043_v2_quotation_workers.py
- A alembic/versions/0044_profile_capabilities.py
- A alembic/versions/0045_inventory_lots_and_results.py
- M app/models/__init__.py
- M app/models/inventory.py
- M app/models/masters.py
- M app/models/production.py
- M app/models/profile.py
- M app/models/prototypes.py
- M app/models/quoter_v2.py
- M app/models/quoter_v2_labor.py
- M app/models/quoter_v2_settings.py
- M app/schemas/auth.py
- M app/schemas/inventory.py
- M app/schemas/production.py
- M app/schemas/prototypes.py
- M app/schemas/quoter_v2.py
- M app/schemas/quoter_v2_labor.py
- M app/schemas/quoter_v2_materials.py
- M app/schemas/quoter_v2_pricing.py
- M app/schemas/quoter_v2_processes.py
- M app/schemas/quoter_v2_settings.py
- M app/schemas/recipes.py
- M app/schemas/users.py

### RBAC (4)

- M app/api/deps.py
- M app/services/users.py
- A tests/unit/test_quick_create_rbac_010p.py
- A tests/unit/test_user_capability_schema_010p.py

### inventory (6)

- M app/api/v1/inventory.py
- A app/core/lot_reconciliation.py
- M app/services/inventory.py
- A scripts/lot_reconciliation_report.py
- M tests/db/test_inventory_api.py
- A tests/unit/test_lot_reconciliation.py

### API (3)

- M app/api/v1/masters.py
- M app/api/v1/recipes.py
- M app/api/v1/router.py

### production (26)

- M app/api/v1/production.py
- M app/api/v1/prototypes.py
- A app/core/production_results.py
- M app/services/preparations.py
- M app/services/production.py
- M app/services/prototypes.py
- M tests/db/test_production_audit.py
- M tests/db/test_production_concurrency.py
- M tests/db/test_production_document.py
- M tests/db/test_production_no_side_effects.py
- M tests/db/test_production_orders_api.py
- M tests/db/test_production_payment_gate.py
- M tests/db/test_production_rbac.py
- A tests/db/test_production_results_010p.py
- M tests/db/test_production_start.py
- M tests/db/test_production_v2_communications.py
- M tests/db/test_production_v2_consumption.py
- M tests/db/test_production_v2_origin.py
- M tests/db/test_production_v2_tracking.py
- M tests/db/test_prototype_order_addendum.py
- M tests/db/test_prototype_production_lifecycle.py
- M tests/db/test_prototype_production_order.py
- M tests/db/test_prototype_quotation_bridge.py
- M tests/db/test_prototypes.py
- M tests/db/test_prototypes_guard.py
- A tests/unit/test_production_results_010p.py

### pricing (28)

- M app/api/v1/quoter_v2.py
- M app/api/v1/quoter_v2_materials.py
- M app/api/v1/quoter_v2_pricing.py
- M app/api/v1/quoter_v2_processes.py
- M app/api/v1/quoter_v2_settings.py
- A app/core/quoter_v2_rules_010p.py
- M app/services/quoter_v2.py
- M app/services/quoter_v2_firing.py
- M app/services/quoter_v2_lifecycle.py
- A app/services/quoter_v2_locks.py
- M app/services/quoter_v2_materials.py
- M app/services/quoter_v2_pricing.py
- M app/services/quoter_v2_processes.py
- M app/services/quoter_v2_reductions.py
- M app/services/quoter_v2_settings.py
- A app/services/quoter_v2_wholesale.py
- M tests/db/test_quotation_builder_body_material.py
- A tests/db/test_quoter_v2_deadlock_010p.py
- M tests/db/test_quoter_v2_lifecycle_api.py
- M tests/db/test_quoter_v2_lifecycle_edges_api.py
- M tests/db/test_quoter_v2_pricing_api.py
- M tests/db/test_quoter_v2_processes_api.py
- A tests/db/test_quoter_v2_rules_010p_api.py
- M tests/db/test_quoter_v2_settings_api.py
- M tests/db/test_quoter_v2_worker_techniques_api.py
- M tests/unit/test_quoter_v2_pricing_excel.py
- M tests/unit/test_quoter_v2_reductions_math.py
- A tests/unit/test_quoter_v2_rules_010p.py

### labor (3)

- M app/api/v1/quoter_v2_labor.py
- M app/services/quoter_v2_labor.py
- M tests/db/test_quoter_v2_labor_api.py

### other (2)

- M app/services/masters.py
- M pyproject.toml

### tests (14)

- M tests/db/conftest.py
- M tests/db/test_firing_quotation_v2_api.py
- tests/db/test_quoter_v2_excel_smoke.py -> tests/db/test_legacy_reference_pre_010p.py [R082]
- M tests/db/test_migration_0041_runs.py
- A tests/db/test_migration_0042_runs.py
- A tests/db/test_migration_0043_runs.py
- A tests/db/test_migration_0044_0045_roundtrip.py
- M tests/db/test_tracking_public.py
- A tests/e2e/preparar_solo_quema.py
- M tests/e2e/servidor_revision.py
- A tests/fixtures/LEGACY_REFERENCE_PRE_010P.json
- A tests/unit/test_legacy_reference_pre_010p.py
- M tests/unit/test_migration_0040.py
- M tests/unit/test_models.py

## Frontend

### other (11)

- A 010Q_UX_GAPS.md
- A CODEX_010P_W3_API_AUDIT.md
- A CODEX_010P_W3_BACKEND_BLOCKER_1.md
- A CODEX_010P_W3_CLOSURE_REPORT.md
- A CODEX_010P_W3_FINAL_REPORT.md
- A CODEX_010P_W3_REPORT.md
- M index.html
- M package.json
- M playwright.revision.config.ts
- A scripts/run-solo-quema-e2e.mjs
- M vite.config.ts

### tests (76)

- A e2e/helpers/w3-accessibility.ts
- M e2e/revision/cotizador-v2-ciclo-de-vida.spec.ts
- M e2e/revision/cotizador-v2-flujo.spec.ts
- A e2e/revision/cotizador-v2-next-cliente.spec.ts
- A e2e/revision/cotizador-v2-next-horno.spec.ts
- A e2e/revision/cotizador-v2-next-lista.spec.ts
- A e2e/revision/cotizador-v2-next-piezas.spec.ts
- A e2e/revision/cotizador-v2-next-precio.spec.ts
- A e2e/revision/cotizador-v2-next-revisar.spec.ts
- A e2e/revision/cotizador-v2-next-shell.spec.ts
- A e2e/revision/cotizador-v2-next-trabajo.spec.ts
- M e2e/revision/cotizador-v2-pre010i.spec.ts
- A e2e/revision/cotizador-v2-rediseno-real.spec.ts
- M e2e/revision/produccion-010i.spec.ts
- A e2e/revision/production-w3-explicit-lot.spec.ts
- A e2e/revision/production-w3-labor-parallel.spec.ts
- A e2e/revision/production-w3-prototype-results.spec.ts
- A e2e/revision/solo-quema-real-e2e.spec.ts
- A e2e/revision/support/cotizadorV2NextMocks.ts
- A e2e/revision/support/cotizadorV2Ui.ts
- M src/api/quoterV2.test.ts
- A src/components/ChoiceCardGroup.test.tsx
- A src/components/CustomerSelectField.test.tsx
- M src/components/DecimalField.test.tsx
- A src/components/DeferredTextField.test.tsx
- A src/components/SegmentedControl.test.tsx
- D src/features/cotizadorV2/CotizadorV2Page.test.tsx
- D src/features/cotizadorV2/V2FiringPanel.test.tsx
- D src/features/cotizadorV2/V2LaborLines.test.tsx
- D src/features/cotizadorV2/V2PricingPanel.test.tsx
- D src/features/cotizadorV2/V2ProductLines.test.tsx
- D src/features/cotizadorV2/V2Wizard.test.tsx
- M src/features/cotizadorV2/cicloDeVida.test.tsx
- A src/features/cotizadorV2/clavesPreview.test.ts
- A src/features/cotizadorV2/enTurno.test.ts
- A src/features/cotizadorV2/factor.test.ts
- A src/features/cotizadorV2/moneda.test.ts
- M src/features/cotizadorV2/pasos.test.ts
- M src/features/cotizadorV2Next/CotizadorV2NextPage.test.tsx
- A src/features/cotizadorV2Next/list/V2CreateQuotationDialog.test.tsx
- A src/features/cotizadorV2Next/list/V2NextQuotationList.test.tsx
- A src/features/cotizadorV2Next/shell/V2NextCicloDeVida.test.tsx
- A src/features/cotizadorV2Next/shell/V2NextWizard.test.tsx
- A src/features/cotizadorV2Next/shell/V2PendingList.test.tsx
- A src/features/cotizadorV2Next/shell/V2QuotationSummaryRail.test.tsx
- A src/features/cotizadorV2Next/shell/V2SaveStatus.test.tsx
- A src/features/cotizadorV2Next/shell/V2StepNav.test.tsx
- A src/features/cotizadorV2Next/shell/pasosDelAsistente.test.ts
- M src/features/cotizadorV2Next/steps/V2NextClientStep.test.tsx
- A src/features/cotizadorV2Next/steps/V2NextKilnStep.test.tsx
- A src/features/cotizadorV2Next/steps/V2NextLaborStep.test.tsx
- A src/features/cotizadorV2Next/steps/V2NextMaterialsStep.test.tsx
- A src/features/cotizadorV2Next/steps/V2NextPricingStep.test.tsx
- M src/features/cotizadorV2Next/steps/V2NextProductsStep.test.tsx
- A src/features/cotizadorV2Next/steps/V2NextReviewStep.test.tsx
- A src/features/cotizadorV2Next/steps/kiln/KilnAdvanced.test.tsx
- A src/features/cotizadorV2Next/steps/kiln/KilnChamberGauge.test.tsx
- A src/features/cotizadorV2Next/steps/kiln/KilnOptionCard.test.tsx
- A src/features/cotizadorV2Next/steps/pricing/CostBreakdownBar.test.tsx
- A src/features/cotizadorV2Next/steps/pricing/FactorControl.test.tsx
- A src/features/cotizadorV2Next/steps/products/QuantityStepper.test.tsx
- A src/features/cotizadorV2Next/steps/review/EmitirCotizacion.test.tsx
- A src/features/firings/labels.test.ts
- A src/features/inventory/InventoryPage.test.tsx
- A src/features/production/DialogoResultadosProduccion.test.tsx
- M src/features/production/Produccion010I.test.tsx
- A src/features/production/ProductionOrdersPage.test.tsx
- M src/features/prototypes/PrototypePages.test.tsx
- M src/test/quoterV2Fixtures.ts
- M src/test/setup.ts
- A src/test/v2next/kilnFixtures.ts
- A src/test/v2next/laborFixtures.ts
- A src/test/v2next/listFixtures.ts
- A src/test/v2next/materialsFixtures.ts
- A src/test/v2next/productsFixtures.ts
- A src/test/v2next/shellFixtures.ts

### frontend (97)

- M src/api/masters.ts
- M src/api/production.ts
- M src/api/prototypes.ts
- M src/api/quoterV2.ts
- A src/components/ChoiceCardGroup.tsx
- A src/components/CustomerSelectField.tsx
- M src/components/DecimalField.tsx
- A src/components/DeferredTextField.tsx
- A src/components/SegmentedControl.tsx
- M src/features/auth/capabilities.ts
- D src/features/cotizadorV2/CotizadorV2Page.tsx
- M src/features/cotizadorV2/V2CicloDeVida.tsx
- D src/features/cotizadorV2/V2ClienteStep.tsx
- M src/features/cotizadorV2/V2DocumentoEmitido.tsx
- D src/features/cotizadorV2/V2EmitirCotizacion.tsx
- M src/features/cotizadorV2/V2ExtrasPanel.tsx
- D src/features/cotizadorV2/V2FiringPanel.tsx
- D src/features/cotizadorV2/V2LaborLines.tsx
- D src/features/cotizadorV2/V2PricingPanel.tsx
- D src/features/cotizadorV2/V2ProductLines.tsx
- M src/features/cotizadorV2/V2ReductionsPanel.tsx
- D src/features/cotizadorV2/V2ResumenStep.tsx
- D src/features/cotizadorV2/V2Wizard.tsx
- M src/features/cotizadorV2/claves.ts
- A src/features/cotizadorV2/factor.ts
- M src/features/cotizadorV2/fechaLima.ts
- M src/features/cotizadorV2/mensajesCicloDeVida.ts
- A src/features/cotizadorV2/moneda.ts
- M src/features/cotizadorV2/pasos.ts
- M src/features/cotizadorV2/useQuoterV2.ts
- M src/features/cotizadorV2/useQuoterV2Firing.ts
- M src/features/cotizadorV2/useQuoterV2Labor.ts
- M src/features/cotizadorV2/useQuoterV2Lifecycle.ts
- M src/features/cotizadorV2/useQuoterV2Materials.ts
- M src/features/cotizadorV2/useQuoterV2Pricing.ts
- M src/features/cotizadorV2/useQuoterV2Processes.ts
- M src/features/cotizadorV2Next/CotizadorV2NextPage.tsx
- D src/features/cotizadorV2Next/V2NextQuotationList.tsx
- D src/features/cotizadorV2Next/V2NextWizard.tsx
- A src/features/cotizadorV2Next/list/V2CreateQuotationDialog.tsx
- A src/features/cotizadorV2Next/list/V2NextQuotationList.tsx
- A src/features/cotizadorV2Next/shell/V2NextWizard.tsx
- A src/features/cotizadorV2Next/shell/V2PendingList.tsx
- A src/features/cotizadorV2Next/shell/V2QuotationHeader.tsx
- A src/features/cotizadorV2Next/shell/V2QuotationSummaryRail.tsx
- A src/features/cotizadorV2Next/shell/V2SaveStatus.tsx
- A src/features/cotizadorV2Next/shell/V2StepNav.tsx
- A src/features/cotizadorV2Next/shell/pasosDelAsistente.ts
- A src/features/cotizadorV2Next/shell/rutas.ts
- D src/features/cotizadorV2Next/steps/AddProductModal.tsx
- M src/features/cotizadorV2Next/steps/V2NextClientStep.tsx
- A src/features/cotizadorV2Next/steps/V2NextKilnStep.tsx
- A src/features/cotizadorV2Next/steps/V2NextLaborStep.tsx
- A src/features/cotizadorV2Next/steps/V2NextMaterialsStep.tsx
- A src/features/cotizadorV2Next/steps/V2NextPricingStep.tsx
- M src/features/cotizadorV2Next/steps/V2NextProductsStep.tsx
- A src/features/cotizadorV2Next/steps/V2NextReviewStep.tsx
- A src/features/cotizadorV2Next/steps/kiln/KilnAdvanced.tsx
- A src/features/cotizadorV2Next/steps/kiln/KilnChamberGauge.tsx
- A src/features/cotizadorV2Next/steps/kiln/KilnOptionCard.tsx
- A src/features/cotizadorV2Next/steps/materials/MaterialLineCard.tsx
- A src/features/cotizadorV2Next/steps/materials/V2NextMaterialsPanel.tsx
- A src/features/cotizadorV2Next/steps/pricing/CostBreakdownBar.tsx
- A src/features/cotizadorV2Next/steps/pricing/FactorControl.tsx
- A src/features/cotizadorV2Next/steps/pricing/PricePerPieceTable.tsx
- A src/features/cotizadorV2Next/steps/pricing/formato.ts
- A src/features/cotizadorV2Next/steps/products/AddPieceDialog.tsx
- A src/features/cotizadorV2Next/steps/products/PieceCard.tsx
- A src/features/cotizadorV2Next/steps/products/QuantityStepper.tsx
- A src/features/cotizadorV2Next/steps/review/ChecklistDePasos.tsx
- A src/features/cotizadorV2Next/steps/review/DocumentoDelCliente.tsx
- A src/features/cotizadorV2Next/steps/review/EmitirCotizacion.tsx
- A src/features/cotizadorV2Next/steps/review/vigencia.ts
- M src/features/firings/labels.ts
- M src/features/inventory/InventoryPage.tsx
- M src/features/masters/useMasters.ts
- M src/features/production/DialogoConsumo.tsx
- A src/features/production/DialogoResultadosProduccion.tsx
- M src/features/production/OrdenV2.tsx
- M src/features/production/ProductionOrderDetailPage.tsx
- M src/features/production/ProductionOrdersPage.tsx
- M src/features/production/mensajesProduccion.ts
- M src/features/production/readiness.ts
- A src/features/production/resumenResultadosProduccion.ts
- M src/features/production/useProductionOrders.ts
- M src/features/prototypes/PrototypeDetailPage.tsx
- M src/features/prototypes/usePrototypes.ts
- M src/index.css
- M src/routes/AppRoutes.tsx
- M src/types/auth.ts
- M src/types/masters.ts
- M src/types/production.ts
- M src/types/prototypes.ts
- M src/types/quoterV2.ts
- M src/types/quoterV2Labor.ts
- M src/types/quoterV2Materials.ts
- M src/types/quoterV2Pricing.ts

## Revisión de alcance

- La comparación se hace contra los SHA productivos fijados en la autorización y los HEAD finales W3 verificados, no por nombres de rama.
- El único cambio de nombre backend detectado es el smoke del Excel 010J, ahora preservado como referencia histórica pre-010P en tests/db/test_legacy_reference_pre_010p.py; los importes históricos, incluido S/ 11,864.90, siguen intactos en el fixture tests/fixtures/LEGACY_REFERENCE_PRE_010P.json.
- Delta local de W4 sobre el HEAD W3: el borrador de tiempo por pieza protege lo tecleado antes de salir del campo; la entrega enfoca su encabezado al abrir; los casos de cotización se alinean al contrato vigente de minutos por pieza y conservan S/ 11,864.90 solo como referencia histórica; el helper responsive suma 1280 px y detecta elementos visibles con `getClientRects()`; el runner PDF fija Python local. No se añadieron reglas comerciales ni rediseño.
- El delta backend de W4 contiene solo SQL/JSON locales de auditoría de inventario y el resultado de reconciliación de lotes; no modifica código de negocio ni aplica migraciones productivas.
- `010Q_UX_GAPS.md` registra los problemas observados y la cobertura que sigue abierta. No se implementa funcionalidad 010Q en W4.
