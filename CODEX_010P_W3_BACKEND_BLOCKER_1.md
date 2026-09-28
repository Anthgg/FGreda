# CODEX_010P_W3_BACKEND_BLOCKER_1

## Bloqueo: resultados de órdenes Solo quema

**Backend examinado:** BGreda W2 `3ce6de0eb563b561e3c2ca1e3142b92b5b764c48`.

**Endpoint:** `GET /production-orders/{id}` seguido de `POST /production-orders/{id}/complete`.

**Request de cierre:** `ProductionOrderCompleteIn.results[]`, con `line_ref`, `good_quantity`, `scrap_quantity` y `scrap_reason`.

**Actual:** el servicio de cierre construye las líneas de una orden Solo quema con referencias `V2F:<id>` de `V2FiringQuotationLine`. La respuesta pública `ProductionOrderOut` no incluye esos IDs ni las cantidades iniciadas de las líneas V2F; sólo expone `lines` y `v2_pieces`.

**Esperado:** que el frontend pueda mostrar cada línea V2F y su cantidad iniciada, y enviar las referencias exactas que valida `complete`.

**Impacto:** la UI no ofrece un cierre que invente una referencia `POL` o envíe cantidades calculadas localmente. La orden Solo quema muestra el bloqueo y no puede registrar buenas/merma desde W3. Enviar `POL:<id>` no satisface el conjunto de referencias V2F que exige el servicio.

**Reproducción:** crear una cotización V2 de Solo quema, enviarla a producción, consultar la orden y revisar que no hay líneas V2F en `ProductionOrderOut`; después comparar con `ProductionOrderService.complete`, que exige referencias `V2F:<id>`.

**Evidencia de contrato W2:** `app/schemas/production.py` (`ProductionOrderOut`, `ProductionOrderCompleteIn`) y `app/services/production.py` (`ProductionOrderService.complete`). No se modificó BGreda.

**Cambio requerido en backend:** exponer en la lectura de la orden las líneas V2F congeladas con su identificador y `started_quantity`, o añadir un endpoint de lectura equivalente. Después se puede integrar la captura en W3 y probar la salida sin inventario de Solo quema.
