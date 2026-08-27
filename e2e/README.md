# E2E (Playwright) — Cotizador Greda

Suite Playwright que corre **contra un ambiente real** (por defecto, producción:
`https://fgreda-web-303244958634.southamerica-west1.run.app`). No usa mocks ni
un backend de prueba: todo lo que hace la suite hace requests reales a BGreda.

## Cómo correrla

```bash
npm run e2e                # todos los proyectos (chromium/firefox/webkit/mobile-ios/mobile-android)
npm run e2e:chromium        # solo chromium (el que corre en CI por PR)
npx playwright test --project=firefox
npx playwright test -g "CASO B"
```

Variables de entorno:

| Variable | Requerida para | Efecto si falta |
|---|---|---|
| `E2E_BASE_URL` | apuntar a un ambiente distinto de producción | usa la URL de producción por defecto |
| `E2E_EMAIL` / `E2E_PASSWORD` | todo lo que necesita sesión (casi toda la suite) | los tests que dependen de login se **saltan** (`test.skip`), nunca fallan en falso |
| `BACKEND_BASE_URL` | `e2e/helpers/api.ts` (conteos de Quemas/Inventario antes/después) | los specs que lo usan documentan su propio fallback |

**Nunca** se hardcodean credenciales ni se versiona un `storageState` con cookies
reales (ver `.gitignore`: `**/.auth/`). Las credenciales de prueba usadas en
esta fase son una cuenta real ya existente (rol Administrador) — la política
del proyecto prohíbe inventar usuarios o contraseñas, así que si no hay
`E2E_EMAIL`/`E2E_PASSWORD` configuradas, la suite completa se salta en vez de
fallar.

## Política de no-mutación

Toda cotización/tercero que un test crea usa el prefijo `E2E-` (`testName()` en
`e2e/helpers/fixtures.ts`) para quedar identificable y no colisionar entre
corridas. La suite:

- No borra registros reales (no hay ningún `DELETE` ni "vaciar" nada).
- No confirma cotizaciones de prueba salvo en el flujo explícito de
  `cotizador.spec.ts` ("flujo completo"), que además verifica —vía
  `e2e/helpers/api.ts`— que el conteo de Quemas e Inventario no cambia antes/
  después (una cotización confirmada no debe disparar producción real).
- Deja borradores `E2E-*` sin anular cuando el propósito del test es solo
  verificar UI (anular también es una mutación, y no es el objetivo del test).

## Cobertura por módulo

| Módulo | Spec | Cubre |
|---|---|---|
| Auth | `auth.spec.ts` | login válido/inválido, persistencia de sesión, nueva pestaña, redirect sin sesión, logout |
| Cotizador | `cotizador.spec.ts` | D2 (bloqueo de Siguiente sin cliente), flujo multiproducto completo, costeo/markup/IGV, PDF, confirmación, no-mutación de Quemas/Inventario |
| Concurrencia | `concurrency.spec.ts` | doble-clic en Confirmar (CASO B), doble-clic en Guardar (CASO D); CASO A y CASO C documentados abajo |
| Terceros | `terceros.spec.ts` | lookup DNI/RUC, autocompletado y persistencia de ubigeo |
| Recetas | `recipes.spec.ts` | listado, detalle, rendimiento, búsqueda, historial de versiones, no-persistencia del simulador |
| Inventario | `inventory.spec.ts` | listado real, saldo no editable inline; bypass de permisos por rol: **NOT_VERIFIED** (ver abajo) |
| Importaciones | `imports.spec.ts` | archivo corrupto → error controlado, nunca 500, nunca llega a confirmar |
| Permisos | `permissions.spec.ts` | **NOT_VERIFIED** en su totalidad (ver abajo) |

## Casos documentados como NOT_VERIFIED / skip permanente

### Permisos por rol (`permissions.spec.ts`, sección "no-admin" de `inventory.spec.ts`)

Requieren una segunda cuenta real con un rol distinto a Administrador. No
existe ninguna en este ambiente y la política del proyecto prohíbe crear
usuarios o contraseñas nuevas para llenar este hueco. Quedan como
`test.skip` con el motivo explícito en el propio test. Para cerrarlos: crear
(por un canal fuera de esta suite, con autorización explícita) una cuenta de
prueba con un rol restringido y exportar sus credenciales como
`E2E_NONADMIN_EMAIL` / `E2E_NONADMIN_PASSWORD`.

### CASO A: edición concurrente del mismo borrador (`concurrency.spec.ts`)

Necesita dos contextos de navegador editando **el mismo** `DRAFT` ya
persistido al mismo tiempo, para observar cómo resuelve el backend un
conflicto de versión (last-write-wins vs. conflicto explícito). Automatizarlo
de punta a punta requeriría crear el borrador, capturar su id, y solo
entonces abrir el segundo contexto — lo cual es viable, pero se dejó como
procedimiento manual en esta fase para no introducir otro punto de
flakiness (el id depende de un create previo) sin antes tener el resto de la
suite estable. Procedimiento manual:

1. Loguearse en dos pestañas/perfiles distintos con la misma cuenta.
2. En la pestaña A, crear un borrador `E2E-Concurrencia-CasoA-...` y anotar su
   `CTZ-...`.
3. En la pestaña B, navegar al mismo borrador (`/cotizador/<id>`).
4. En A, cambiar el nombre y "Guardar borrador". En B, sin recargar, cambiar
   un campo distinto y "Guardar borrador" también.
5. Verificar en el backend (o recargando ambas pestañas) qué versión quedó:
   si el segundo guardado sobrescribe silenciosamente el primero sin aviso,
   es un defecto a reportar; si el backend devuelve 409 o similar, es el
   comportamiento esperado.

### CASO C: dos requests completando dimensiones NULL simultáneamente

Necesita un producto real del catálogo con dimensiones `NULL` en el momento
exacto de la corrida. No se puede garantizar sin mutar deliberadamente el
catálogo de producción (crear o alterar un producto para dejarlo sin
dimensiones), lo cual está fuera del alcance no-destructivo de esta fase.
Queda documentado y saltado hasta que exista un producto así de forma
natural, o se autorice explícitamente crear uno de prueba.

## Físico vs. emulado

Los proyectos `webkit` y `mobile-ios`/`mobile-android` de `playwright.config.ts`
corren sobre los motores que Playwright empaqueta (WebKit headless, emulación
de viewport/UA), **no** sobre Safari real ni un dispositivo físico. Cualquier
reporte de esta suite que diga "Safari" o "iOS/Android" se refiere siempre a
esa emulación — `SAFARI_PHYSICAL` y `MOBILE_PHYSICAL` quedan `NOT_VERIFIED`
hasta que alguien los pruebe en hardware real.
