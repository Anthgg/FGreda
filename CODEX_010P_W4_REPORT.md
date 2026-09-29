# CODEX 010P W4 — informe de integración y release candidate

STATUS: BLOCKED

BACKEND_010P_RC_SHA: 5bec5abccc7f1ff897d0bf5c4c142cdf47946284
FRONTEND_010P_RC_SHA: a7d95914c642e58a68ec7a5c98aee28d0152021e
BACKEND_BRANCH: feat/010p-w4-integration
FRONTEND_BRANCH: feat/010p-w4-integration
WORKTREES_CLEAN: YES, tras commit local de documentación

## Gates de datos y backend

| Gate | Resultado | Evidencia |
|---|---|---|
| Alembic | PASS | Único head 0045. La cadena 0041 → 0042 → 0043 → 0044 → 0045 está en history. La base desechable del E2E terminó en 0045. W4 no añade migraciones. |
| Migración desde 0041 | PASS | Las pruebas de migración de la suite DB cubren upgrade desde 0041 y continuidad hasta 0045. |
| Roundtrip | PASS | Las pruebas DB de migraciones cubren los downgrade/re-upgrade permitidos y los guards con datos incompatibles. |
| Dataset pre-010P representativo | NOT RUN | No se probó dump sanitizado ni fixture integral con DRAFT, CONFIRMED, CANCELLED, EXPIRED, prototipos y Solo Quema juntos. No se usó producción. |
| Invariantes post-migración | PASS en fixture local | Alembic 0045; 27 movimientos, 2 filas de lote, 14 saldos agregados. Contadores en cero para saldos negativos, relaciones de movimientos, resultados y diferencias agregado/lotes. |
| Reconciliación de lotes | PASS en fixture local | 0 UNRECONCILED; suma reconstruida 190 coincide con saldo agregado 190. Reporte: BGreda/artifacts/010P_W4/lot_reconciliation.json. |
| Backend unit | PASS | 1,489 aprobadas, 0 fallidas. |
| Backend DB full | FAIL | 1,704 aprobadas, 4 fallidas; duración 11,147.13 s (3 h 5 min 47 s). El conteo de skips no quedó preservado en el log disponible. |
| Ruff | PASS | ruff check . |
| Format | PASS | ruff format --check .; 458 archivos ya formateados. |
| Mypy | PASS | Sin errores en 182 archivos fuente. |
| Deadlock regression | PASS | 25 rondas, 0 deadlocks; también pasó la prueba concurrente de lectura/escritura. |
| Stock concurrency | PASS | Las pruebas de carrera de consumo por lote, entrega, finalización y producto personalizado no fallaron en la suite completa. |

La rerun focal de los cuatro fallos DB obtuvo 2 aprobadas y 2 fallidas. Persistieron:

- tests/db/test_production_v2_tracking.py::TestNotasYQuemas::test_el_reintento_devuelve_la_misma_nota: 422 PRODUCTION_NOTE_OCCURRED_AT_INVALID porque la marca de tiempo enviada puede preceder a la creación de la orden.
- tests/db/test_production_v2_tracking.py::TestSeguimiento::test_reune_estados_consumos_notas_y_quemas_en_orden: falla en la secuencia temporal esperada.

Los archivos de esos dos casos y app/services/production.py no difieren respecto a la base W3 08b95e2495ab65b0c9c6e743614bf59f8f2987ad; por tanto, W4 no modificó esas líneas. No se ejecutó la suite sobre W3, así que no se declara probado que los fallos ya ocurrieran antes. El gate DB full sigue fallando y bloquea el RC.

## Gates frontend

| Gate | Resultado | Evidencia |
|---|---|---|
| Vitest | PASS | 103/103 archivos; 1,220/1,220 pruebas; 145.37 s. |
| Lint | PASS | npm run lint. |
| TypeScript | PASS | npm run typecheck. |
| Build | PASS | npm run build; JS 1,220.84 kB minificado / 316.69 kB gzip. Vite mantiene el aviso existente de chunk >500 kB. |
| React Doctor | PASS con warnings | v0.9.14, alcance modificado de 161 archivos, 40 warnings y 0 errors. Incluye complejidad de control en InventoryPage; registrado para 010Q. |
| UX gaps | YES | 010Q_UX_GAPS.md actualizado con hallazgos heredados y límites de evidencia. |

## E2E local

PLAYWRIGHT_TOTAL: 75/75 aprobadas en Chromium; 10.5 min.

El runner inició PostgreSQL y los servicios locales contra una base desechable, ejecutó la suite y el contrato focal de Solo Quema, apagó los servicios y limpió la base. No quedó un contenedor 010P ni listener en el puerto temporal.

| Escenario requerido | Resultado | Evidencia o límite |
|---|---|---|
| Retail | PASS | Emisión, cotización de siete pasos, multiproducto y ciclo de vida. |
| External 10 h | PASS | 120/8 produce 150 comercial, 240 real y brecha 90. |
| Dos externos | PASS | 10 h activas; 300 comercial, 480 real y brecha 180; no duplica al trabajador repetido. |
| Paralelo | PARTIAL | 5 h + 6 h da 6 h activas. No se verificó en el E2E el conjunto completo de sumas por línea de espacio y mano de obra. |
| Wholesale | PASS | Rechazar conserva RETAIL; aceptar aplica defaults; se conserva el trabajador MANUAL y se advierte incompatibilidad de técnica. |
| Space / passive | PARTIAL | Se ve la sugerencia pasiva y el total no cambia al editar horas pasivas. Falta probar el override editable de espacio por línea. |
| Lote explícito | PASS | Se consume del lote B y el lote A queda intacto. |
| Resultado normal 30/27/3 y merma | NOT RUN | Pasaron los casos de prototipo 2/1/1 y Solo Quema 10/8/2, que no sustituyen este flujo normal. |
| Producto personalizado y reintento | NOT RUN | No hay caso de navegador que cree el producto final una vez y compruebe que el reintento no duplica. |
| Prototipo | PASS | 2 iniciados, 1 bueno, 1 merma; movimiento +1 y prototipos anteriores intactos. |
| Solo Quema | PASS | 10 iniciados, 8 buenos, 2 merma; 0 PRODUCTION_IN y stock terminado sin cambio. |
| WIP | NOT RUN | La suite no demuestra las transiciones WIP requeridas ni su salida al completar. |
| Entrega | NOT RUN | No se probó entregar 20 de 27, verificar saldo 7 y rechazar entrega 8. |
| Quick-create y RBAC | PASS | ADMIN y operador con capability crean trabajador/técnica; operador sin capability recibe 403; no se crea usuario ni movimiento; overwrite de costo queda rechazado. |
| Histórico V1 | PASS | Solo lectura; settings actuales no alteran datos ni PDF históricos. |
| PDF | PASS | El flujo retail emite y sirve PDF; también pasa la inmutabilidad del PDF V1. |
| Snapshots | PASS | El caso wholesale cambia settings y tarifa actual tras capturar valores; el borrador conserva sus snapshots. |
| A11y | PARTIAL | Las pantallas escaneadas no añadieron nodos desconocidos. Se encontraron hallazgos serious heredados de contraste (3.59:1 y 2.62:1) y nombre de enlace en superficies seleccionadas; no se auditó todo el conjunto requerido. Detalle en 010Q_UX_GAPS.md. |
| Responsive | PARTIAL | Sin overflow en pantallas ejercitadas a 375, 768, 1024, 1280 y 1440 px; no cubre todas las superficies requeridas. |
| Errores de consola | PARTIAL | 0 errores en los escenarios con collector; no hay collector global para toda la suite. |
| Lighthouse | NOT RUN | Opcional en W4. |
| Auditoría API contract | PARTIAL | Los flujos nuevos comprobados usaron el backend local real; falta una revisión exhaustiva de OpenAPI, campos no usados y supuestos mock-only. |
| Seguridad/RBAC | PASS | Los escenarios de alta rápida validan capability, 403, privacidad de jornales, costo no sobrescribible y ausencia de login/inventario creado. |

Log Playwright: BGreda/artifacts/010P_W4/playwright_revision.log. Contrato focal Solo Quema: BGreda/artifacts/010P_W4/focused_solo_quema_contract.log. Auditoría de inventario: BGreda/artifacts/010P_W4/inventory_invariants.json.

## Bloqueadores del cierre

1. La suite DB completa no quedó verde: 4 fallos en el run completo y 2 fallos repetidos en la focal. El conteo de skips no está preservado.
2. Falta migrar un dataset local representativo pre-010P con los estados y entidades requeridos.
3. Faltan los E2E de producto personalizado/reintento, producción normal 30/27/3, WIP y entrega 20/7/rechazo de 8.
4. Quedan parciales las sumas de allocation por línea, el override de espacio, la cobertura completa de A11y/responsive, el collector global de errores y la auditoría API exhaustiva.

La rama frontend tendrá un commit posterior solo de documentación; FRONTEND_010P_RC_SHA identifica el código y las pruebas evaluadas.
PUSHED: NO
MERGED: NO
DEPLOYED: NO
MIGRATIONS_APPLIED_PROD: NO
READY_FOR_010P_FINAL: NO
FINAL: 010P_W4_BLOCKED

No iniciar 010Q, no hacer push, merge ni deploy hasta nueva autorización y cierre de los bloqueadores.
