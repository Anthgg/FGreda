# CODEX 010P W4 — integración y release candidate local

STATUS: PASS

BACKEND_RC_SHA: 00a0d65df4ff328133d80ec0fe91cf54b6dc90ce
FRONTEND_RC_SHA: 0330bb90cdf2145973afcadef482f2578ffc9e0c
BACKEND_BRANCH: feat/010p-w4-integration
FRONTEND_BRANCH: feat/010p-w4-integration
WORKTREES_CLEAN: YES after the report and UX-gap documentation commits

## Resumen

W4 queda validada como release candidate local. Se probó el backend y frontend W4 en ramas separadas, con PostgreSQL local desechable y sin usar datos de producción. No se introdujeron nuevas reglas comerciales ni migraciones en esta fase.

No se hizo push, merge, deploy ni migración de producción. El commit backend contiene el contrato API, las correcciones de pruebas, el fixture de migración y la evidencia local. El commit frontend indicado arriba contiene las pruebas de integración y el guard global de errores de JavaScript.

No se observó NotImplementedError en las rutas ni flujos validados. Las referencias restantes corresponden a comentarios históricos de W0 y dobles de prueba.

## Gates backend, migración y datos

| Gate | Resultado | Conteo y evidencia |
|---|---|---|
| Alembic | PASS | Un único head: 0045; historial 0041 → 0042 → 0043 → 0044 → 0045. W4 no agrega migraciones. |
| Migración desde 0041 | PASS | Fixture sintético representativo 1/1; conserva datos y snapshots, estados de cotización, prototipos, órdenes V1/V2, Solo Quema, preparaciones, existencias y asignaciones MANUAL. representative_migration_assertions.log. |
| Roundtrip | PASS | Roundtrip 0044 ↔ 0045 y protecciones de downgrade cubiertos por la suite DB. Sin ejecutar cambios contra producción. |
| Invariantes post migración | PASS | Base E2E en 0045: 27 movimientos, 2 lotes y 14 saldos agregados. Los 10 contadores de saldos negativos, entregas inválidas, movimientos, resultados, orígenes y conciliación están en cero. inventory_invariants.json. |
| Reconciliación de lotes | PASS | En la base E2E: agregado 190 = 100 + 90, 0 UNRECONCILED. En el fixture pre-010P: lotes 165 y 200, 0 diferencias. lot_reconciliation.json y lot_reconciliation_representative.json. |
| Backend unit | PASS | 1,489 aprobadas, 0 fallidas; 38.83 s. backend_unit_full.log. |
| Backend DB | PASS tras correcciones y rerun aislado | 1,709 casos únicos cubiertos y aprobados en segmentos disjuntos: 520 + 580 + 609. No se presenta como una sola invocación monolítica. Detalle debajo. |
| Ruff | PASS | ruff check . sin errores. |
| Format | PASS | ruff format --check .; 460 archivos ya formateados. |
| Mypy | PASS | 0 errores en 177 archivos fuente. |

### Cobertura DB y concurrencia

La colección DB tenía 1,709 casos. El primer intento monolítico avanzó hasta 33% y se interrumpió cuando dejó de progresar; no se cuenta como ejecución completa. La cobertura íntegra se completó con tres rangos disjuntos: casos 0–519 (520), 520–1099 (580) y 1100–1708 (609).

En el primer shard, el único fallo fue una URL equivocada en la prueba de detalle de producto; se corrigió a /api/v1/products/{id} y la prueba pasó. En el segundo shard, el único fallo fue WinError 121 al conectar con PostgreSQL durante la ejecución paralela; ambos casos fallidos pasaron al ejecutarse juntos y en serie. El rerun focal fue 2/2 en 24.65 s. Los intentos repetidos no se suman al total de casos únicos. Los logs de shard no reportan skips; el intento parcial inicial no dejó un resumen final de skips.

La regresión de precio/quema/preview/edición ejecutó 25 rondas concurrentes; las cuatro respuestas de cada ronda fueron 200 y el caso pasó. La regresión específica de orden de locks también pasó. Las pruebas de consumo por lote, entrega, finalización, creación concurrente de producto y las demás pruebas de carrera de inventario pasaron dentro de la cobertura DB. La auditoría post E2E encontró cero saldos negativos y cero duplicaciones inconsistentes.

## Gates frontend

| Gate | Resultado | Conteo y evidencia |
|---|---|---|
| Vitest | PASS | 103/103 archivos; 1,220/1,220 pruebas; 127.82 s. |
| Lint | PASS | npm run lint. |
| TypeScript | PASS | npm run typecheck. |
| Build | PASS | npm run build. Bundle JS: 1,220.84 kB min / 316.69 kB gzip; aviso de chunk grande existente. |
| React Doctor | PASS con warnings | v0.9.14; 161 archivos del alcance modificado, 40 warnings y 0 errores. Complejidad de control en InventoryPage queda registrada para 010Q. |

El bundle W4 crece frente a W3 en 3.85 kB min y 1.16 kB gzip. La variación se registra como seguimiento; no bloquea el RC.

## Playwright local y flujos funcionales

PLAYWRIGHT_TOTAL: 75/75, Chromium, un worker, 10.6 min; el runner terminó con código 0. Usó PostgreSQL desechable, backend W4 y frontend W4 en loopback. Ejecutó el contrato focal de Solo Quema, la auditoría de inventario y limpió la base desechable.

| Escenario | Resultado | Evidencia |
|---|---|---|
| Retail | PASS | Cotizador de siete pasos, emisión, ciclo de vida y PDF. |
| Externo 10 h | PASS | 120/8 h resulta en 150 comercial, 240 real y brecha 90. |
| Dos externos | PASS | 300 comercial, 480 real y brecha 180; horas pasivas solo sugieren y no se suman. |
| Paralelo | PASS | Líneas de 5 h y 6 h dan 6 h activas; los importes por línea concilian con los totales. |
| Wholesale | PASS | Rechazar conserva RETAIL; aceptar aplica defaults y conserva el trabajador MANUAL; warning de técnica visible. |
| Espacio y horas pasivas | PASS | Override editable por línea se refleja en costos; horas pasivas no cambian el total. |
| Lote explícito | PASS | Consumo de 10 del lote B: A queda en 100 y B en 90. |
| Producción y merma | PASS | 30 iniciadas, 27 buenas y 3 de merma; resultado, stock y movimientos concilian. |
| Producto personalizado y reintento | PASS | Un solo producto final, sin duplicado al reintentar. |
| Prototipo | PASS | 2 iniciados, 1 bueno y 1 merma; el stock aumenta en 1 y el historial anterior queda intacto. |
| Solo Quema | PASS | 10 iniciados, 8 buenos y 2 merma; no genera PRODUCTION_IN ni cambia el stock terminado. |
| WIP | PASS | EN_PRODUCCION → PROGRAMADA_HORNO → EN_HORNO → QUEMADA, con estado visible. |
| Entrega | PASS | Entregar 20 de 27 deja 7; el intento de entregar 8 excedentes se rechaza. |
| Quick create y RBAC | PASS | ADMIN y operador autorizado crean; operador sin capability recibe 403; sin usuario, asignación de labor ni movimiento inventario no solicitados; no permite sobrescribir costo. |
| Histórico V1 | PASS | Historial y PDF permanecen de solo lectura ante cambios actuales. |
| PDF | PASS | Emisión y descarga verificadas. |
| Snapshots | PASS | Cambios posteriores de settings y tarifas no alteran el borrador ni los importes congelados. |

## A11y, responsive y consola

- A11y: PASS en las superficies W4 ejercitadas. Axe WCAG A/AA no encontró hallazgos nuevos serios o críticos. Se excluyen únicamente hallazgos heredados identificados por selector: contraste 3.59:1 en etiquetas naranja, contraste 2.62:1 en etiquetas gris zinc y un enlace sin nombre accesible en Solo Quema. Quedan documentados para 010Q; el resultado no certifica pantallas fuera de los flujos auditados.
- Responsive: PASS en las superficies ejercitadas a 375, 768, 1024, 1280 y 1440 px, sin overflow horizontal de página; el scroll interno de WIP en móvil es usable.
- CONSOLE_ERRORS: 0 pageerror no capturadas y 0 console.error de JavaScript en los 75 casos. Chromium informa ciertos HTTP no-2xx como Failed to load resource; el guard los separa de errores JS y cada rechazo funcional esperado conserva sus aserciones HTTP y visuales.
- LIGHTHOUSE_SMOKE: NOT RUN. Es opcional para W4; el crecimiento de bundle está medido arriba.

## Contrato API y seguridad

API_CONTRACT_AUDIT: PASS en productos, cotizador V2, producción, inventario y Solo Quema. Se contrastaron los endpoints y DTO con OpenAPI generado. Se corrigió el tipo de detalle de producto para exponer source_v2_quotation_product_id en lectura sin alterar ProductInput ni la creación. El cálculo autoritativo de precios permanece en servidor.

SECURITY_RBAC: PASS. Quick create comprueba ADMIN y OPERATOR con MASTERS_QUICK_CREATE, deniega operador sin capability y no abre rutas a usuarios anónimos. No expone jornales al operador ni permite sobrescribir el costo maestro. Esta auditoría se limita a las superficies 010P/W4 indicadas.

## Cierre local

UX_GAPS_UPDATED: YES — 010Q_UX_GAPS.md contiene deuda heredada y límites de auditoría; no implementa el rediseño 010Q.

PUSHED: NO
MERGED: NO
DEPLOYED: NO
MIGRATIONS_APPLIED_PROD: NO
BLOCKERS: NONE for the W4 local release candidate
READY_FOR_010P_FINAL: YES
FINAL: 010P_W4_COMPLETE

El RC queda listo para la siguiente decisión de release. Se detiene aquí: no iniciar 010Q, hacer push, merge, deploy ni migración productiva sin nueva autorización.
