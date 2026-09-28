# CODEX_010P_W3_BACKEND_BLOCKER_1

## Estado del contrato de lectura

El bloqueo original quedó **RESUELTO** en el backend W3 aislado:

- Base W2: `3ce6de0eb563b561e3c2ca1e3142b92b5b764c48`.
- Commit del contrato: `b5d55caa58a6f7c76df52c666c85858d1467d6e2`.
- Rama: `feat/010p-w3-production-order-read-contract`.
- Cambio aditivo en `GET /production-orders/{id}`: `result_lines[]` devuelve el `line_ref` y `started_quantity` autoritativos, junto con identidad/origen disponible.
- `POST /production-orders/{id}/complete` conserva su payload y sus validaciones. No se creó una migración; Alembic permanece en `0045`.

La salida se prueba para líneas V2 de productos, V2 Solo Quema (`V2F:<firing_quotation_line_id>`) y prototipos. El cliente consume los valores devueltos por el GET; React no deriva ni inventa referencias o cantidades.

## Bloqueo restante: Solo Quema E2E

`SOLO_QUEMA_E2E` sigue **BLOCKED**. El servidor E2E aislado y las rutas públicas actuales no ofrecen un flujo soportado para crear una orden de producción desde una cotización FQ/Solo Quema. No se inventará un endpoint ni se insertarán datos internos para simular el flujo de usuario.

Por ello no hay evidencia de navegador para completar 8 buenas + 2 de merma en una orden real Solo Quema y comprobar la ausencia de `PRODUCTION_IN`/incremento de stock terminado. El backend read contract ya no es la causa del bloqueo.
